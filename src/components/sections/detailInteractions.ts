import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { localAssetUrl } from "@/lib/assets";
import journalCategories from "@/data/journal-articles.json";
import detailMedia from "@/data/detail-media.json";

/** Rehydrates the source site's controls without replacing its markup or scoped styles. */
export function initializeDetailInteractions(root: HTMLElement, navigate: (url: string) => void): () => void {
  const cleanups: (() => void)[] = [];
  let disposed = false;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = (seconds: number) => reduced ? 0 : seconds;
  const all = <T extends HTMLElement = HTMLElement>(scope: ParentNode, selector: string) => Array.from(scope.querySelectorAll<T>(selector));
  const listen = (target: EventTarget | null, type: string, callback: (event: Event) => void, options?: AddEventListenerOptions) => {
    if (!target) return;
    target.addEventListener(type, callback, options);
    cleanups.push(() => target.removeEventListener(type, callback, options));
  };
  const button = (element: HTMLElement, callback: () => void, label?: string) => {
    if (element.tagName !== "BUTTON" && element.tagName !== "A") {
      element.tabIndex = 0;
      element.setAttribute("role", "button");
      listen(element, "keydown", event => {
        const key = (event as KeyboardEvent).key;
        if (key === "Enter" || key === " ") { event.preventDefault(); callback(); }
      });
    }
    if (label) element.setAttribute("aria-label", label);
    listen(element, "click", event => { event.preventDefault(); callback(); });
  };
  const swipe = (element: HTMLElement, previous: () => void, next: () => void) => {
    let start: { x: number; y: number } | null = null;
    listen(element, "pointerdown", event => {
      const pointer = event as PointerEvent;
      if (pointer.pointerType === "mouse" && pointer.button !== 0) return;
      start = { x: pointer.clientX, y: pointer.clientY };
    });
    listen(element, "pointerup", event => {
      if (!start) return;
      const pointer = event as PointerEvent;
      const dx = pointer.clientX - start.x, dy = pointer.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.25) dx < 0 ? next() : previous();
    });
    listen(element, "pointercancel", () => { start = null; });
  };
  const setActive = (element: HTMLElement, active: boolean) => {
    element.toggleAttribute("data-active", active);
    if (element.classList.contains("picture-item") || element.classList.contains("highlight")) element.setAttribute("aria-hidden", String(!active));
    else element.setAttribute("aria-current", String(active));
  };
  const updateQuery = (values: Record<string, string | null>) => {
    const url = new URL(window.location.href);
    Object.entries(values).forEach(([key, value]) => value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  };

  const context = gsap.context(() => {
    // Product CTA buttons live inside anchors in the original server-rendered HTML.
    listen(root, "click", event => {
      const mouse = event as MouseEvent;
      if (event.defaultPrevented || mouse.button !== 0 || mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('[data-component="product-card"] a, [data-component="journal-card"] a, [data-component="journal-list-item"] a');
      if (!anchor || !root.contains(anchor) || anchor.target === "_blank") return;
      const url = anchor.getAttribute("href");
      if (url?.startsWith("/en/")) { event.preventDefault(); event.stopPropagation(); navigate(url); }
    });

    all(root, '[data-component="products-list"]').forEach(section => {
      const desktop = section.querySelector<HTMLElement>('[data-component="product-category-list"]');
      const mobile = section.querySelector<HTMLElement>('[data-component="product-category-list-mobile"]');
      const cards = section.querySelector<HTMLElement>('[data-component="product-cards-list"]');
      if (!desktop || !mobile || !cards) return;
      const mainItems = all(desktop, ".main-category-list > .list > .item");
      const openedItems = all(desktop, ".main-category-list-open > .list > .item");
      const mobileItems = all(mobile, ".main-categories-container > .list > .item");
      const mobileSubLists = all(mobile, ".lists-container > .list");
      const cardItems = all(cards, ".list > .item");
      const categories = mainItems.map(item => item.querySelector<HTMLElement>('[data-component="product-category"]')?.getAttribute("slug") || "");
      const subcategories = openedItems.map(item => all(item, ".sub-category-list [slug]").map(category => category.getAttribute("slug") || ""));
      let category = -1, subcategory = -1, draftCategory = -1, draftSubcategory = -1;
      let filterTween: gsap.core.Tween | null = null;
      const panel = mobile.querySelector<HTMLElement>(".categories-container");
      const originalOverflow = document.body.style.overflow;
      const mobileToggle = (open: boolean) => {
        mobile.classList.toggle("is-active", open);
        mobile.querySelector(".btn-filter")?.setAttribute("aria-expanded", String(open));
        document.body.style.overflow = open ? "hidden" : originalOverflow;
      };
      cleanups.push(() => { document.body.style.overflow = originalOverflow; });
      const showDraft = () => {
        mobileItems.forEach((item, index) => {
          item.classList.toggle("active", index === draftCategory);
          item.querySelector("[data-component=product-category]")?.setAttribute("data-force-active", String(index === draftCategory));
        });
        mobileSubLists.forEach((list, index) => {
          list.classList.toggle("active", index === draftCategory);
          all(list, "[data-component=tag]").forEach((tag, subindex) => tag.setAttribute("data-force-active", String(subindex === draftSubcategory)));
        });
        if (panel) {
          panel.setAttribute("data-active", draftCategory < 0 ? "false" : String(draftCategory));
          const list = mobileSubLists[draftCategory];
          panel.style.setProperty("--subCat-height", `${list ? list.offsetHeight + (panel.querySelector<HTMLElement>(".title-label")?.offsetHeight || 0) + 24 : 0}px`);
        }
      };
      const showDesktop = (animate: boolean) => {
        openedItems.forEach((item, index) => {
          item.classList.toggle("active", index === category);
          all(item, ".sub-category-list [data-component=product-category]").forEach((sub, subindex) => sub.setAttribute("data-force-active", String(index === category && subindex === subcategory)));
        });
        mainItems.forEach((item, index) => {
          const selected = index === category;
          item.querySelector("[data-component=product-category]")?.setAttribute("data-force-active", String(selected));
          let x = 0;
          if (selected) {
            const destination = openedItems[index]?.querySelector<HTMLElement>(".main-cat");
            if (destination) x = destination.getBoundingClientRect().left - item.getBoundingClientRect().left + Number(gsap.getProperty(item, "x") || 0);
          }
          gsap.to(item, { x, opacity: category < 0 || selected ? 1 : 0, duration: animate ? duration(1) : 0, ease: "power2.inOut", overwrite: true });
          item.style.pointerEvents = category < 0 ? "" : "none";
        });
        if (animate && category >= 0) gsap.fromTo(all(openedItems[category], ".close, .sub-item"), { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: duration(.75), stagger: .1, ease: "power2.inOut", overwrite: true });
      };
      const apply = (animate = true, writeUrl = true) => {
        showDesktop(animate);
        draftCategory = category; draftSubcategory = subcategory; showDraft();
        const visible = cardItems.filter(item => {
          const href = item.querySelector("a")?.getAttribute("href") || "";
          const parts = href.split("/");
          return category < 0 || (parts[3]?.toLowerCase() === categories[category].toLowerCase() && (subcategory < 0 || parts[4]?.toLowerCase() === subcategories[category][subcategory]?.toLowerCase()));
        });
        const update = () => {
          cardItems.forEach(item => { item.hidden = !visible.includes(item); item.style.display = item.hidden ? "none" : ""; });
          cards.style.setProperty("--productCardsList-height", `${cards.querySelector<HTMLElement>(".list")?.offsetHeight || 0}px`);
          if (animate) gsap.fromTo(cards.querySelector(".g-row"), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: duration(1), ease: "power2.inOut", overwrite: true });
          ScrollTrigger.refresh();
        };
        filterTween?.kill();
        if (animate && !reduced) filterTween = gsap.to(cards.querySelector(".g-row"), { opacity: 0, duration: .35, ease: "power2.inOut", overwrite: true, onComplete: update });
        else update();
        const countLabel = mobile.querySelector(".btn-filter .sub-label");
        if (countLabel) countLabel.textContent = `(${category < 0 ? "All" : visible.length})`;
        if (writeUrl) updateQuery({ category: categories[category] || null, subcategory: subcategories[category]?.[subcategory] || null });
      };
      mainItems.forEach((item, index) => button(item, () => { category = index; subcategory = -1; apply(); }));
      openedItems.forEach((item, index) => {
        const close = item.querySelector<HTMLElement>(".close");
        if (close) button(close, () => { if (subcategory >= 0) subcategory = -1; else category = -1; apply(); }, "Back to product categories");
        all(item, ".sub-item").forEach((sub, subindex) => button(sub, () => { category = index; subcategory = subindex; apply(); }));
      });
      mobileItems.forEach((item, index) => button(item, () => { draftCategory = draftCategory === index ? -1 : index; draftSubcategory = -1; showDraft(); }));
      mobileSubLists.forEach(list => all(list, ".sub-item").forEach((item, index) => button(item, () => { draftSubcategory = draftSubcategory === index ? -1 : index; showDraft(); })));
      const open = mobile.querySelector<HTMLElement>(".btn-filter");
      if (open) button(open, () => { draftCategory = category; draftSubcategory = subcategory; showDraft(); mobileToggle(true); });
      [mobile.querySelector<HTMLElement>(".btn-close"), mobile.querySelector<HTMLElement>(":scope > .bg")].forEach(close => { if (close) button(close, () => mobileToggle(false)); });
      const confirm = mobile.querySelector<HTMLElement>(".apply-container button");
      if (confirm) button(confirm, () => { category = draftCategory; subcategory = draftSubcategory; apply(); mobileToggle(false); window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" }); });
      listen(document, "keydown", event => { if ((event as KeyboardEvent).key === "Escape") mobileToggle(false); });
      const readQuery = () => {
        const url = new URL(window.location.href);
        category = categories.indexOf(url.searchParams.get("category") || "");
        subcategory = category < 0 ? -1 : subcategories[category].findIndex(slug => slug.toLowerCase() === (url.searchParams.get("subcategory") || "").toLowerCase());
        apply(false, false);
      };
      listen(window, "popstate", readQuery); listen(window, "resize", () => { showDesktop(false); showDraft(); }); readQuery();
      cleanups.push(() => filterTween?.kill());
    });

    // The pill's moving background follows the measured source labels on both layouts.
    all(root, '[data-component="button-switch"]').forEach(control => {
      const items = all(control, ":scope > .list > .item");
      if (!items.length) return;
      let active = Math.max(0, items.findIndex(item => item.classList.contains("active")));
      const update = (hover = active) => {
        const list = control.querySelector<HTMLElement>(":scope > .list");
        if (!list) return;
        const listRect = list.getBoundingClientRect();
        [["activeBtn", active], ["hoverBtn", hover]].forEach(([name, index]) => {
          const rect = items[Number(index)]?.getBoundingClientRect();
          if (rect) { control.style.setProperty(`--${name}-width`, `${rect.width}px`); control.style.setProperty(`--${name}-offset`, `${rect.left - listRect.left}px`); }
        });
        items.forEach((item, index) => { item.classList.toggle("active", index === active); item.classList.remove("prev", "next", "current"); item.setAttribute("aria-selected", String(index === active)); });
        [active, hover].forEach(index => { items[index]?.classList.add("current"); items[index - 1]?.classList.add("prev"); items[index + 1]?.classList.add("next"); });
      };
      items.forEach((item, index) => {
        listen(item, "mouseenter", () => update(index)); listen(item, "mouseleave", () => update());
        if (item.querySelector("a")) return;
        button(item, () => {
          active = index; update();
          const preparation = control.closest('[data-component="preparation"]');
          if (preparation) all(preparation, ".steps-container > .step").forEach((step, stepindex) => { step.classList.toggle("active", stepindex === index); step.setAttribute("aria-hidden", String(stepindex !== index)); });
        });
      });
      control.classList.add("active"); update(); listen(window, "resize", () => update());
      document.fonts?.ready.then(() => { if (!disposed && root.isConnected) update(); });
    });

    all(root, '[data-component="bullet-slider"]').forEach(slider => {
      const pictures = all(slider, ".picture-frame > .picture-item");
      if (!pictures.length) return;
      const bullets = all(slider, ".bullet");
      const progress = all(slider, ".bullet .progress");
      const preparation = slider.closest('[data-component="preparation"]');
      const productMedia = detailMedia as Record<string, { url: string; duration: number }[]>;
      const media = productMedia[window.location.pathname.replace(/\/$/, "")] || [];
      if (preparation && root.querySelector('[data-component="product"]')) pictures.forEach((picture, index) => {
        const video = picture.querySelector<HTMLVideoElement>("video");
        const source = media[index];
        if (video && source && !video.getAttribute("src") && !video.querySelector("source")) { video.src = localAssetUrl(source.url); video.preload = "metadata"; video.load(); }
      });
      let current = 0, inView = false, timer: gsap.core.Tween | null = null;
      const pause = () => { timer?.pause(); pictures[current].querySelector<HTMLVideoElement>("video")?.pause(); };
      const resume = () => { if (reduced || document.hidden || !inView) return; timer?.play(); void pictures[current].querySelector<HTMLVideoElement>("video")?.play().catch(() => {}); };
      const select = (index: number) => {
        current = (index + pictures.length) % pictures.length;
        timer?.kill(); gsap.set(progress, { scaleX: 0 });
        pictures.forEach((picture, pictureindex) => {
          const active = pictureindex === current; setActive(picture, active);
          gsap.set(picture, { opacity: active ? 1 : 0, zIndex: active ? 1 : 0, pointerEvents: active ? "auto" : "none" });
          const video = picture.querySelector<HTMLVideoElement>("video");
          if (video) { video.muted = true; video.playsInline = true; if (!active) video.pause(); else { try { video.currentTime = 0; } catch {} } }
        });
        bullets.forEach(bullet => { const active = Number(bullet.dataset.index) === current; setActive(bullet, active); bullet.setAttribute("aria-label", `Show slide ${Number(bullet.dataset.index) + 1}`); });
        const caption = slider.querySelector(".caption");
        if (caption) caption.textContent = pictures[current].dataset.title || "";
        const video = pictures[current].querySelector<HTMLVideoElement>("video");
        const seconds = Number.isFinite(video?.duration) ? video!.duration : preparation ? media[current]?.duration || 4 : 4;
        const activeProgress = bullets.filter(bullet => Number(bullet.dataset.index) === current).map(bullet => bullet.querySelector(".progress")).filter(Boolean);
        timer = gsap.to(activeProgress, { scaleX: 1, duration: seconds, ease: "none", paused: true, onComplete: () => select(current + 1) });
        if (reduced) gsap.set(activeProgress, { scaleX: 1 }); else resume();
      };
      const previous = slider.querySelector<HTMLElement>(".prev-btn"), next = slider.querySelector<HTMLElement>(".next-btn");
      if (previous) button(previous, () => select(current - 1), "Previous slide"); if (next) button(next, () => select(current + 1), "Next slide");
      bullets.forEach(bullet => button(bullet, () => select(Number(bullet.dataset.index))));
      swipe(slider, () => select(current - 1), () => select(current + 1));
      const observer = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; inView ? resume() : pause(); }, { threshold: .12 });
      observer.observe(slider); cleanups.push(() => { observer.disconnect(); timer?.kill(); pictures.forEach(picture => picture.querySelector<HTMLVideoElement>("video")?.pause()); });
      listen(document, "visibilitychange", () => document.hidden ? pause() : resume()); select(0);
    });

    all(root, '[data-component="circles-slider"]').forEach(slider => {
      const items = all(slider, ".list-container > .list > .item");
      if (!items.length) return;
      let current = Math.max(0, items.findIndex(item => item.classList.contains("active")));
      const circles = all(slider, ".circles-container .circle");
      const groups = [".list-mobile > .item", ".description-container > .item", ".current > .item"].map(selector => all(slider, selector));
      const bullets = all(slider, ".mobile-controller .bullet");
      const select = (index: number, animate = true) => {
        current = (index + items.length) % items.length;
        items.forEach((item, itemindex) => item.classList.toggle("active", itemindex === current));
        groups.forEach(group => group.forEach((item, itemindex) => { item.style.display = itemindex === current ? "" : "none"; item.setAttribute("aria-hidden", String(itemindex !== current)); }));
        const value = Number(items[current].dataset.value);
        circles.forEach((circle, circleindex) => gsap.to(circle, { scale: circleindex <= value ? 1 : 1.1, opacity: circleindex <= value ? 1 : 0, duration: animate ? duration(1) : 0, delay: animate ? circleindex * .025 : 0, ease: "power4.out", overwrite: true }));
        bullets.forEach((bullet, index) => { setActive(bullet, index === current); gsap.set(bullet.querySelector(".progress"), { scaleX: index === current ? 1 : 0 }); });
      };
      items.forEach((item, index) => { listen(item, "mouseenter", () => select(index)); button(item, () => select(index)); });
      const arrows = all(slider, ".mobile-controller > button");
      if (arrows[0]) button(arrows[0], () => select(current - 1), "Previous characteristic"); if (arrows[1]) button(arrows[1], () => select(current + 1), "Next characteristic");
      bullets.forEach((bullet, index) => button(bullet, () => select(index)));
      swipe(slider, () => select(current - 1), () => select(current + 1)); slider.classList.add("active"); select(current, false);
    });

    all(root, '[data-component="product"] > [data-component="transition-logo-mask"] .slot-wrapper > header').forEach(header => {
      const toggle = header.querySelector<HTMLElement>(".dropdown-btn"), viewer = header.querySelector<HTMLElement>('[data-component="products-viewer"]'), background = header.querySelector<HTMLElement>(".products-viewer-bg");
      if (!toggle || !viewer || !background) return;
      const position = () => {
        const title = header.querySelector<HTMLElement>(".title-container");
        if (!title) return;
        const top = title.getBoundingClientRect().bottom - header.getBoundingClientRect().top + 16;
        viewer.style.top = `${top}px`; viewer.style.left = "";
        viewer.style.setProperty("--productsViewer-max-height", `${Math.max(150, window.innerHeight - title.getBoundingClientRect().bottom - 36)}px`);
        background.style.top = `${top}px`; background.style.left = ""; background.style.width = `${viewer.offsetWidth}px`; background.style.height = `${viewer.offsetHeight}px`;
      };
      const open = (active: boolean) => { header.classList.toggle("viewer-open", active); toggle.classList.toggle("is-active", active); viewer.classList.toggle("is-active", active); background.classList.toggle("is-active", active); toggle.setAttribute("aria-expanded", String(active)); viewer.setAttribute("aria-hidden", String(!active)); if (active) position(); };
      button(toggle, () => open(!viewer.classList.contains("is-active")), "Products in the same category");
      listen(document, "click", event => { if (!viewer.contains(event.target as Node) && !toggle.contains(event.target as Node)) open(false); });
      listen(viewer, "click", event => { if ((event.target as Element).closest("a")) open(false); });
      listen(document, "keydown", event => { if ((event as KeyboardEvent).key === "Escape") open(false); });
      listen(window, "resize", () => { open(false); position(); }); open(false); position();
    });

    // Origin badges and sensorial slices share the original mouse-following popup.
    all(root, '[data-component="popup-area"]').forEach(area => {
      const popup = area.querySelector<HTMLElement>('[data-component="popup"]');
      const content = popup?.querySelector<HTMLElement>(".content");
      if (!popup || !content) return;
      const items = all(content, ":scope > .item");
      let active: HTMLElement | null = null;
      const hide = () => { active = null; gsap.to(popup, { autoAlpha: 0, scale: .8, rotation: 10, duration: duration(.15), overwrite: true }); };
      const position = (x: number, y: number, touch = false) => {
        const rect = area.getBoundingClientRect();
        gsap.to(popup, { x: x - rect.left - popup.offsetWidth / 2, y: y - rect.top - popup.offsetHeight - (touch ? 16 : 48), rotation: 0, duration: duration(.2), overwrite: "auto" });
      };
      all(area, "[data-popup-content]").forEach(trigger => {
        const show = (event?: MouseEvent | PointerEvent) => {
          const index = Number(trigger.dataset.popupContent);
          const item = items[index]; if (!item) return;
          active = trigger;
          items.forEach((entry, itemindex) => entry.classList.toggle("active", index === itemindex));
          item.style.width = "max-content"; item.style.maxWidth = `${Math.min(window.innerWidth - 48, 460)}px`;
          content.style.setProperty("--content-width", `${item.offsetWidth}px`); content.style.setProperty("--content-height", `${item.offsetHeight}px`);
          const rect = trigger.getBoundingClientRect(); const touch = !event || !window.matchMedia("(hover: hover)").matches;
          position(touch ? rect.left + rect.width / 2 : event!.clientX, touch ? rect.top : event!.clientY, touch);
          gsap.to(popup, { autoAlpha: 1, scale: 1, rotation: 0, duration: duration(.75), ease: "power4.inOut", overwrite: "auto" });
        };
        listen(trigger, "mouseenter", event => show(event as MouseEvent));
        listen(trigger, "mouseleave", hide);
        button(trigger, () => active === trigger ? hide() : show(), items[Number(trigger.dataset.popupContent)]?.textContent?.trim() || "Show coffee origin");
        listen(trigger, "mousemove", event => { const mouse = event as MouseEvent; if (active === trigger) position(mouse.clientX, mouse.clientY); });
      });
      listen(document, "click", event => { if (active && !active.contains(event.target as Node)) hide(); });
      listen(window, "scroll", hide, { passive: true }); listen(document, "keydown", event => { if ((event as KeyboardEvent).key === "Escape") hide(); }); hide();
    });

    initializeJournal();
    initializeDraggableLists();
  }, root);

  function initializeJournal() {
    const journal = root.querySelector<HTMLElement>('[data-component="journal"]');
    if (!journal) return;
    const header = journal.querySelector<HTMLElement>('[data-component="header"]');
    if (header) {
      const slides = all(header, ".highlight"), previews = all(header, ".preview-item"), info = header.querySelector<HTMLElement>(".highlight-info");
      let current = 0, inView = true, progress: gsap.core.Timeline | null = null, first = true;
      const select = (index: number) => {
        if (!slides.length || !info) return;
        const previous = current; current = (index + slides.length) % slides.length; progress?.kill();
        slides.forEach((slide, slideindex) => {
          const active = slideindex === current; setActive(slide, active);
          if (active) {
            gsap.fromTo(slide, { xPercent: first ? 0 : -100, zIndex: 3, opacity: 1 }, { xPercent: 0, duration: first ? 0 : duration(1.66), ease: "power2.inOut", overwrite: true });
            gsap.fromTo(slide.querySelector("img"), { xPercent: first ? 0 : 33 }, { xPercent: 0, duration: duration(1.66), ease: "power2.inOut", overwrite: true });
          } else gsap.to(slide, { xPercent: 100, zIndex: slideindex === previous ? 2 : 1, duration: first ? 0 : duration(1.66), ease: "power2.inOut", overwrite: true });
          slide.style.pointerEvents = active ? "" : "none";
        });
        const updateInfo = () => {
          info.querySelector(".highlight-title")!.textContent = slides[current].dataset.title || "";
          info.querySelector(".highlight-tag .label")!.textContent = slides[current].dataset.tag || "";
          const href = slides[current].querySelector("a")?.getAttribute("href") || "#";
          all<HTMLAnchorElement>(info, "a").forEach(anchor => anchor.setAttribute("href", href));
        };
        if (first || reduced) updateInfo();
        else gsap.to(info, { opacity: 0, x: "100vw", filter: "blur(3px)", duration: .6, ease: "power2.in", overwrite: true, onComplete: () => { updateInfo(); gsap.fromTo(info, { x: "-25vw", opacity: 0 }, { x: 0, opacity: 1, filter: "blur(0px)", duration: .925, delay: .15, ease: "power2.out", overwrite: true }); } });
        previews.forEach((preview, previewindex) => {
          const active = previewindex === current; setActive(preview, active);
          gsap.to(preview, { width: active ? "50%" : "25%", duration: duration(.6), ease: "power2.inOut", overwrite: true });
          gsap.set(preview.querySelector(".progress-bar"), { left: "0%", opacity: active ? 1 : 0 }); gsap.set(preview.querySelector(".progress-grad"), { right: "100%" });
        });
        first = false;
        if (!reduced && previews[current]) {
          progress = gsap.timeline({ paused: !inView || document.hidden, onComplete: () => select(current + 1) })
            .to(previews[current].querySelector(".progress-bar"), { left: "100%", duration: 6, ease: "none" }, 0)
            .to(previews[current].querySelector(".progress-grad"), { right: "0%", duration: 6, ease: "none", overwrite: true }, 0);
        }
      };
      const previous = header.querySelector<HTMLElement>(".prev-btn"), next = header.querySelector<HTMLElement>(".next-btn");
      if (previous) button(previous, () => select(current - 1), "Previous news"); if (next) button(next, () => select(current + 1), "Next news");
      previews.forEach((preview, index) => { button(preview, () => select(index), `Show news ${index + 1}`); listen(preview, "mouseenter", () => { if (index !== current) gsap.to(preview, { width: "33%", duration: duration(.6), overwrite: true }); }); listen(preview, "mouseleave", () => { if (index !== current) gsap.to(preview, { width: "25%", duration: duration(.6), overwrite: true }); }); });
      swipe(header, () => select(current - 1), () => select(current + 1));
      const observer = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; if (inView && !document.hidden) progress?.resume(); else progress?.pause(); }); observer.observe(header);
      listen(document, "visibilitychange", () => { if (inView && !document.hidden) progress?.resume(); else progress?.pause(); }); cleanups.push(() => { observer.disconnect(); progress?.kill(); }); select(0);
    }
    const listing = journal.querySelector<HTMLElement>('[data-component="listing"]');
    const container = listing?.querySelector<HTMLElement>(".article-container");
    if (!listing || !container) return;
    const originalNodes = Array.from(container.childNodes);
    const tags = all(listing, ".category-wrap [data-category]");
    const template = listing.querySelector<HTMLElement>('[data-component="journal-card"]');
    if (!template) return;
    let active = "all", page = 1, transition: gsap.core.Tween | null = null;
    const scope = (element: HTMLElement, id: string) => { element.setAttribute(`data-v-${id}`, ""); return element; };
    const render = () => {
      const category = journalCategories.find(category => category.slug === active);
      tags.forEach(tag => tag.toggleAttribute("data-selected", tag.dataset.category === active));
      container.replaceChildren();
      if (!category) { container.append(...originalNodes); return; }
      const wrapper = scope(document.createElement("div"), "59fdad6a"); wrapper.className = "list-wrapper";
      const holder = scope(document.createElement("div"), "59fdad6a"); holder.className = "article-holder g-row";
      const headingWrap = scope(document.createElement("div"), "59fdad6a"); headingWrap.className = "g-col category-title xxl-24 sm-14";
      const heading = scope(document.createElement("h2"), "59fdad6a"); heading.className = "-mix-title-3"; heading.textContent = category.title; headingWrap.append(heading);
      const articleWrapper = scope(document.createElement("div"), "59fdad6a"); articleWrapper.className = "article-wrapper";
      const articles = category.articles.slice((page - 1) * 9, page * 9);
      for (let offset = 0; offset < articles.length; offset += 3) {
        const row = scope(scope(document.createElement("div"), "fcdcd1bb"), "59fdad6a"); row.className = "g-col xxl-24 lg-27 md-30 sm-14"; row.dataset.component = "journal-cards-list";
        const cardWrap = scope(document.createElement("div"), "fcdcd1bb"); cardWrap.className = "card-list-wrap";
        const list = scope(document.createElement("ul"), "fcdcd1bb"); list.className = "normal card-list";
        articles.slice(offset, offset + 3).forEach(article => {
          const card = template.cloneNode(true) as HTMLElement; card.className = "small";
          const anchor = card.querySelector<HTMLAnchorElement>("a")!; anchor.href = article.url;
          const image = card.querySelector<HTMLImageElement>("img");
          if (image) { image.src = localAssetUrl(article.image || "/imgs/placeholder.jpg"); image.removeAttribute("srcset"); image.width = article.width || 791; image.height = article.height || 1000; image.alt = article.title; image.loading = "eager"; }
          card.querySelector("h3")!.textContent = article.title;
          card.querySelector("[data-component=tag] .label")!.textContent = article.category;
          const date = card.querySelector("time")!; date.dateTime = article.date; date.textContent = article.date;
          const item = scope(document.createElement("li"), "fcdcd1bb"); item.append(card); list.append(item);
        });
        while (list.childElementCount < 3) list.append(scope(document.createElement("li"), "fcdcd1bb"));
        cardWrap.append(list); row.append(cardWrap); articleWrapper.append(row);
      }
      holder.append(headingWrap, articleWrapper); wrapper.append(holder); container.append(wrapper);
      if (category.articles.length > 9) {
        const pagination = scope(scope(document.createElement("div"), "275725c0"), "59fdad6a"); pagination.dataset.component = "pagination";
        const indexes = scope(document.createElement("div"), "275725c0"); indexes.className = "index-wrapper";
        const pages = Math.ceil(category.articles.length / 9);
        for (let index = 1; index <= pages; index++) {
          const item = scope(document.createElement("div"), "275725c0"); item.className = "index-container"; item.tabIndex = 0; item.setAttribute("role", "button"); item.dataset.page = String(index); item.toggleAttribute("data-active", index === page);
          const label = scope(document.createElement("span"), "275725c0"); label.className = "-sans-text-2-medium"; label.textContent = String(index);
          const background = scope(document.createElement("div"), "275725c0"); background.className = "index-bg"; item.append(label, background); indexes.append(item);
        }
        const paginationArrow = (direction: "left" | "right") => {
          const original = header?.querySelector<HTMLButtonElement>(direction === "left" ? ".prev-btn" : ".next-btn");
          if (!original) return null;
          const arrow = scope(original.cloneNode(true) as HTMLButtonElement, "275725c0");
          arrow.className = ""; arrow.removeAttribute("data-v-6ed5f3b9");
          arrow.dataset.page = String(direction === "left" ? Math.max(1, page - 1) : Math.min(pages, page + 1));
          arrow.setAttribute("aria-label", direction === "left" ? "Previous page" : "Next page");
          all(arrow, "[class]").forEach(element => { element.className = element.className.replaceAll(`arrow-${direction}`, `chevron-${direction}`); });
          arrow.querySelectorAll("path").forEach(path => path.setAttribute("d", direction === "left" ? "m7.802 10 5.573-6.389L12.288 2.5 4.625 10l7.635 7.5 1.087-1.083z" : "m12.198 10-5.573 6.389L7.712 17.5l7.663-7.5L7.74 2.5 6.653 3.583z"));
          return arrow;
        };
        const previous = paginationArrow("left"), next = paginationArrow("right");
        if (previous) pagination.append(previous); pagination.append(indexes); if (next) pagination.append(next); holder.append(pagination);
      }
    };
    const select = (category: string, nextPage = 1, animate = true, writeUrl = true) => {
      active = category; page = nextPage; transition?.kill();
      const update = () => { render(); ScrollTrigger.refresh(); gsap.to(container, { opacity: 1, duration: duration(.35), delay: animate ? .25 : 0, overwrite: true }); };
      if (animate && !reduced) transition = gsap.to(container, { opacity: 0, duration: .35, ease: "power2.inOut", overwrite: true, onComplete: update }); else update();
      if (writeUrl) updateQuery({ category: category === "all" ? null : category, page: nextPage > 1 ? String(nextPage) : null });
      if (animate) listing.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
    };
    tags.forEach(tag => button(tag, () => select(tag.dataset.category || "all")));
    listen(container, "click", event => {
      const target = event.target as Element;
      const more = target.closest(".see-more");
      if (more) { event.preventDefault(); const title = more.closest('[data-component="journal-cards-list"]')?.querySelector(".header h2")?.textContent?.trim().toLowerCase(); if (title) select(title); }
      const pagination = target.closest<HTMLElement>("[data-page]"); if (pagination) select(active, Number(pagination.dataset.page));
    });
    listen(container, "keydown", event => { const key = (event as KeyboardEvent).key; const item = (event.target as Element).closest<HTMLElement>("[data-page]"); if (item && (key === "Enter" || key === " ")) { event.preventDefault(); select(active, Number(item.dataset.page)); } });
    const query = () => { const params = new URLSearchParams(location.search); const category = params.get("category") || "all"; const selected = journalCategories.find(entry => entry.slug === category); select(selected?.slug || "all", Math.min(Math.max(1, Number(params.get("page")) || 1), selected ? Math.ceil(selected.articles.length / 9) : 1), false, false); };
    listen(window, "popstate", query); query(); cleanups.push(() => { transition?.kill(); container.replaceChildren(...originalNodes); });
  }

  function initializeDraggableLists() {
    all(root, '[data-component="draggable-list"]').forEach(wrapper => {
      const content = Array.from(wrapper.children).find(child => !child.classList.contains("scrollbar-container")) as HTMLElement | undefined;
      if (!content) return;
      const thumb = wrapper.querySelector<HTMLElement>(".scroll-thumb");
      const bar = wrapper.querySelector<HTMLElement>(".custom-scrollbar");
      let x = 0, maximum = 0, pointer = -1, startX = 0, startY = 0, initialX = 0, dragging = false, thumbDrag = false;
      const setX = (value: number) => {
        x = Math.min(0, Math.max(-maximum, value)); gsap.set(content, { x });
        if (thumb && bar) gsap.set(thumb, { x: maximum ? (-x / maximum) * Math.max(0, bar.offsetWidth - thumb.offsetWidth) : 0 });
      };
      const measure = () => { maximum = Math.max(0, content.scrollWidth - wrapper.clientWidth); wrapper.style.touchAction = maximum ? "pan-y" : "auto"; wrapper.style.cursor = maximum ? "grab" : ""; if (thumb) thumb.style.width = `${maximum ? Math.max(10, wrapper.clientWidth / content.scrollWidth * 100) : 100}%`; setX(x); };
      listen(wrapper, "pointerdown", event => {
        const e = event as PointerEvent;
        if (!maximum || (e.pointerType === "mouse" && e.button !== 0) || (e.target as Element).closest("button, [data-component=popup-area]")) return;
        thumbDrag = Boolean((e.target as Element).closest(".custom-scrollbar"));
        if (thumbDrag && bar && thumb && e.target !== thumb) setX(-maximum * Math.min(1, Math.max(0, (e.clientX - bar.getBoundingClientRect().left - thumb.offsetWidth / 2) / Math.max(1, bar.offsetWidth - thumb.offsetWidth))));
        pointer = e.pointerId; startX = e.clientX; startY = e.clientY; initialX = x; dragging = false;
      });
      listen(window, "pointermove", event => {
        const e = event as PointerEvent; if (pointer !== e.pointerId) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (!dragging && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { pointer = -1; return; }
        if (Math.abs(dx) > 8) dragging = true;
        if (dragging) { e.preventDefault(); wrapper.style.cursor = "grabbing"; setX(initialX + (thumbDrag && bar && thumb ? -dx * maximum / Math.max(1, bar.offsetWidth - thumb.offsetWidth) : dx)); }
      }, { passive: false });
      const release = () => { pointer = -1; wrapper.style.cursor = maximum ? "grab" : ""; };
      listen(window, "pointerup", release); listen(window, "pointercancel", release);
      listen(wrapper, "click", event => { if (dragging) { event.preventDefault(); event.stopPropagation(); dragging = false; } }, { capture: true });
      listen(wrapper, "dragstart", event => event.preventDefault());
      listen(wrapper, "wheel", event => { const e = event as WheelEvent; if (maximum && Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); setX(x - e.deltaX); } }, { passive: false });
      const observer = new ResizeObserver(measure); observer.observe(wrapper); observer.observe(content); cleanups.push(() => observer.disconnect()); measure();
    });
  }

  return () => { disposed = true; cleanups.forEach(cleanup => cleanup()); gsap.killTweensOf(root.querySelectorAll("*")); context.revert(); };
}
