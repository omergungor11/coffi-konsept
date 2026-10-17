"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import chrome from "@/data/chrome-markup.json";
import { localAssetUrl, rewriteAssetUrls } from "@/lib/assets";

gsap.registerPlugin(ScrollTrigger);

/** Original navigation artwork, with its controls owned by React. */
export function MenuChrome() {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    const host = ref.current;
    const menu = host?.querySelector<HTMLElement>('[data-component="menu"]') as HTMLElement;
    if (!host || !menu) return;
    const cleanup: (() => void)[] = [];
    let closeTimer: ReturnType<typeof setTimeout>;
    let mobileOpen = false;
    let mobileGroup = "";
    let desktopGroup = "";
    const mobile = menu.querySelector<HTMLElement>(".mobile-menu-container")!;
    const mobileItems = mobile.querySelector<HTMLElement>('[data-component="mobile-items"]')!;
    const listen = (el: EventTarget, type: string, fn: EventListener) => {
      el.addEventListener(type, fn); cleanup.push(() => el.removeEventListener(type, fn));
    };
    function paintPill(item: HTMLElement | null, kind: "active" | "hover", visible: boolean) {
      const rect = item?.getBoundingClientRect();
      document.querySelectorAll<HTMLElement>(`[data-component="menu-background-${kind}"], .menu-background-${kind}-border`).forEach(background => {
        background.style.setProperty("--xOffset", `${(rect?.left ?? window.innerWidth / 2 - 78) - 14}px`);
        background.style.setProperty("--width", `${(rect?.width ?? 156) + 28}px`);
        background.style.setProperty("--opacity", visible ? "1" : "0");
        if (kind === "active") background.classList.toggle("hide", !visible);
      });
    }
    const activeItem = Array.from(menu.querySelectorAll<HTMLElement>('[data-component="main-items"] .item')).find(item => {
      const href = item.querySelector<HTMLAnchorElement>("a")?.getAttribute("href");
      if (href && pathname.startsWith(href)) return true;
      const target = item.dataset.target;
      return Array.from(menu.querySelectorAll<HTMLAnchorElement>(`[data-component="sub-items"] [data-item="${target}"] a`)).some(link => pathname === link.getAttribute("href"));
    }) || null;
    paintPill(activeItem, "active", Boolean(activeItem));
    paintPill(activeItem, "hover", false);
    function setGroup(group: string) {
      desktopGroup = group;
      menu.classList.toggle("active", Boolean(group) || mobileOpen);
      menu.querySelector(".sub-menu")?.classList.toggle("active", Boolean(group));
      document.querySelector('[data-component="sub-menu-background"]')?.classList.toggle("active", Boolean(group));
      menu.querySelectorAll<HTMLElement>('[data-component="sub-items"] .list > .item').forEach(item => item.classList.toggle("active", item.dataset.item === group));
      menu.querySelectorAll<HTMLElement>('[data-component="main-items"] .item').forEach(item => item.classList.toggle("is-active", item.dataset.target === group));
      menu.querySelectorAll<HTMLElement>('[data-component="main-items"] .item').forEach(item => item.querySelector("button")?.setAttribute("aria-expanded", String(item.dataset.target === group)));
    }
    function setMobileGroup(group: string) {
      mobileGroup = group;
      mobileItems.querySelector(":scope > .list")?.classList.toggle("active", mobileOpen && !group);
      mobileItems.querySelector(".trademark-container")?.classList.toggle("active", mobileOpen && !group);
      mobileItems.querySelectorAll<HTMLElement>(".sub-list > .item").forEach(item => item.classList.toggle("active", item.dataset.item === group));
      const height = group ? mobileItems.querySelector<HTMLElement>(`.sub-list > [data-item="${group}"]`)?.offsetHeight : (mobileItems.querySelector<HTMLElement>(":scope > .list")?.offsetHeight || 0) + (mobileItems.querySelector<HTMLElement>(".trademark-container")?.offsetHeight || 0);
      mobileItems.style.height = mobileOpen ? `${height || 560}px` : "0px";
      const topHeight = mobile.querySelector<HTMLElement>('[data-component="mobile-top"]')?.offsetHeight || 90;
      mobile.querySelector<HTMLElement>(":scope > .bg")?.style.setProperty("--bg-height", mobileOpen ? `${(height || 560) + topHeight + 1}px` : `${topHeight + 1}px`);
    }
    function setMobile(open: boolean) {
      mobileOpen = open;
      mobile.classList.toggle("active", open);
      mobile.querySelector('[data-component="mobile-top"]')?.classList.toggle("open", open);
      mobileItems.classList.toggle("active", open);
      menu.classList.toggle("active", open || Boolean(desktopGroup));
      mobile.querySelector(".open-btn")?.setAttribute("aria-expanded", String(open));
      setMobileGroup("");
      document.documentElement.classList.toggle("navigation-open", open);
      window.dispatchEvent(new CustomEvent("delta:menu", { detail: { open } }));
    }
    setMobile(false);
    menu.querySelectorAll<HTMLElement>('[data-component="main-items"] .item').forEach(item => {
      const show = () => { clearTimeout(closeTimer); paintPill(item, "hover", item !== activeItem); setGroup(item.querySelector("button") ? item.dataset.target || "" : ""); };
      listen(item, "mouseenter", () => { clearTimeout(closeTimer); paintPill(item, "hover", item !== activeItem); closeTimer = setTimeout(show, 250); });
      listen(item, "focusin", show);
      listen(item, "mouseleave", () => { clearTimeout(closeTimer); paintPill(activeItem, "hover", false); });
      listen(item, "keydown", ((event: KeyboardEvent) => {
        if (event.key === "ArrowDown" && item.querySelector("button")) {
          event.preventDefault(); show(); menu.querySelector<HTMLAnchorElement>('[data-component="sub-items"] .item.active .pages-list a')?.focus();
        }
      }) as EventListener);
      listen(item, "click", (() => { if (item.querySelector("button")) setGroup(item.dataset.target || ""); }) as EventListener);
    });
    listen(menu.querySelector(".click-outside")!, "mouseenter", (() => { if (window.innerWidth > 1290) closeTimer = setTimeout(() => setGroup(""), 160); }) as EventListener);
    listen(menu, "click", ((event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(".open-btn")) setMobile(true);
      if (target.closest(".close-btn, .click-outside")) { setMobile(false); setGroup(""); }
      const subButton = target.closest(".sub-item-btn");
      if (subButton) setMobileGroup((subButton.closest<HTMLElement>(".item"))?.dataset.target || "");
      if (target.closest(".back-btn")) setMobileGroup("");
      if (target.closest("a")) { setMobile(false); setGroup(""); }
    }) as EventListener);
    listen(document, "keydown", ((event: KeyboardEvent) => { if (event.key === "Escape") { setGroup(""); setMobile(false); } }) as EventListener);
    menu.querySelectorAll<HTMLElement>('[data-component="dropdown"]').forEach(dropdown => {
      listen(dropdown.querySelector("button")!, "click", (() => { const open = dropdown.classList.toggle("active"); dropdown.querySelector("button")?.setAttribute("aria-expanded", String(open)); }) as EventListener);
      const rowHeight = dropdown.querySelector<HTMLElement>(".list .item")?.scrollHeight || 48;
      dropdown.style.setProperty("--item-height", `${rowHeight}px`);
      dropdown.style.setProperty("--active-offset", `${rowHeight}px`);
      dropdown.querySelectorAll<HTMLElement>(".list .item").forEach((item, index) => listen(item, "mouseenter", () => dropdown.style.setProperty("--hover-offset", `${rowHeight * index}px`)));
    });
    listen(window, "resize", () => { if (window.innerWidth > 1290 && mobileOpen) setMobile(false); else setMobileGroup(mobileGroup); paintPill(activeItem, "active", Boolean(activeItem)); });
    menu.querySelectorAll<HTMLVideoElement>(".pages-list video").forEach(video => {
      const link = video.closest("a");
      video.muted = true; video.playsInline = true;
      if (link) { listen(link, "mouseenter", () => void video.play().catch(() => {})); listen(link, "mouseleave", () => { video.pause(); video.currentTime = 0; }); }
    });
    // The original logo opens in the centre, then morphs into the fixed navigation.
    const ctx = gsap.context(() => {
      const desktop = window.innerWidth > 1290;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const seen = sessionStorage.getItem("delta-intro-seen");
      menu.classList.add("is-ready");
      if (desktop && !reduced && !seen) {
        const shape = menu.querySelector(".shape");
        const main = menu.querySelector(".menu-container .main-menu");
        const left = menu.querySelector(".intro .left-copy");
        const right = menu.querySelector(".intro .right-copy");
        const leftItems = menu.querySelector(".left-menu-list");
        const rightItems = menu.querySelector(".right-menu-list");
        const backgrounds = document.querySelectorAll('[data-component="menu-background"], [data-component="menu-background-active"]');
        shape?.classList.remove("is-morphed");
        const curtain = document.createElement("span");
        curtain.className = "bg";
        curtain.setAttribute("data-v-aabf3e36", "");
        menu.prepend(curtain);
        const mask = menu.querySelector("#menu-bg-mask path");
        const aspect = window.innerWidth / window.innerHeight;
        const maskScale = Math.sqrt(aspect ** 2 + 1) / (80 / 1700) * 3;
        gsap.set(mask, { scaleX: 1700 / window.innerWidth * .6, scaleY: 980 / window.innerHeight * .6, y: 0, transformOrigin: "center" });
        gsap.set([left, right], { clearProps: "all" });
        gsap.set(main, { y: window.innerHeight / 2 - (main as HTMLElement).offsetHeight / 2 });
        gsap.set(backgrounds, { autoAlpha: 0 });
        const intro = gsap.timeline({ defaults: { ease: "power4.inOut" }, onComplete: () => { curtain.remove(); sessionStorage.setItem("delta-intro-seen", "1"); window.dispatchEvent(new CustomEvent("delta:intro-ready")); } });
        intro.fromTo(shape, { scale: .95, opacity: 0, filter: "blur(2px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 2, onComplete: () => curtain.classList.add("add-mask") }, 0)
          .fromTo(left, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 2 }, 1)
          .fromTo(right, { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 2 }, 2)
          .to(mask, { scaleX: maskScale, scaleY: maskScale * (aspect / (1700 / 980)), duration: 1 }, 4)
          .to(main, { y: 0, duration: 1 }, 4)
          .to([left, right], { opacity: 0, duration: .5 }, 4)
          .call(() => shape?.classList.add("is-morphed"), [], 4)
          .fromTo(leftItems, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 1, ease: "power4.out" }, 4.5)
          .fromTo(rightItems, { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 1, ease: "power4.out" }, 4.5)
          .to(backgrounds, { autoAlpha: 1, duration: 1, clearProps: "visibility,opacity" }, 4.75)
          .call(() => curtain.remove(), [], 5);
        cleanup.push(() => curtain.remove());
      }
    }, host);
    return () => { clearTimeout(closeTimer); cleanup.forEach(fn => fn()); ctx.revert(); document.documentElement.classList.remove("navigation-open"); };
  }, [pathname]);
  return <div ref={ref} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: rewriteAssetUrls(chrome.menu) }} />;
}

export function FooterChrome() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cleanups: (() => void)[] = [];
    const groups = root.querySelectorAll<HTMLElement>(".main-group");
    const measure = () => groups.forEach(group => group.style.setProperty("--group-list-height", `${group.querySelector<HTMLElement>(".links-list")?.offsetHeight || 0}px`));
    measure(); window.addEventListener("resize", measure);
    groups.forEach(group => {
      const heading = group.querySelector<HTMLElement>(".group-title-wrapper");
      if (!heading) return;
      heading.setAttribute("role", "button"); heading.tabIndex = 0; heading.setAttribute("aria-expanded", "false");
      const toggle = () => { if (window.innerWidth > 1023) return; measure(); const open = group.classList.toggle("active"); heading.setAttribute("aria-expanded", String(open)); };
      const keydown = (event: KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); } };
      heading.addEventListener("click", toggle); heading.addEventListener("keydown", keydown);
      cleanups.push(() => { heading.removeEventListener("click", toggle); heading.removeEventListener("keydown", keydown); });
    });
    const video = root.querySelector("video");
    if (video) {
      const file = window.innerWidth < 744 ? "2026-05-28T14-25-45.349Z-acores-footer-mobile.mp4" : "2026-01-06T18-11-38.270Z-açores-footer-web.mp4";
      video.src = localAssetUrl(`https://burospaces1.fra1.cdn.digitaloceanspaces.com/delta/${file}`);
      video.muted = true; video.loop = true; video.playsInline = true;
    }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (video) { if (entry.isIntersecting) void video.play().catch(() => {}); else video.pause(); } }), { rootMargin: "300px" });
    if (video) observer.observe(video);
    const ctx = gsap.context(() => {
      const section = root.querySelector('[data-component="pre-footer"]');
      if (section && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.fromTo(section.querySelector(".background-container"), { yPercent: -20, scale: 1.1 }, { yPercent: 0, scale: 1, ease: "none", scrollTrigger: { trigger: section, start: "top bottom", end: "bottom bottom", scrub: true } });
        const footer = root.querySelector("footer")!;
        const inner = footer.querySelector(".wrapper > .inner");
        gsap.fromTo(inner, { y: 200, scale: 1.1 }, { y: 0, scale: 1, ease: "none", scrollTrigger: { trigger: window.innerWidth <= 743 ? inner : footer, start: "top bottom", end: window.innerWidth <= 743 ? "top center" : "bottom bottom", scrub: true } });
        gsap.fromTo(footer.querySelector(".under-footer"), { y: -200 }, { y: 0, ease: "none", scrollTrigger: { trigger: footer, start: "top bottom", end: "bottom bottom", scrub: true } });
        gsap.fromTo(section.querySelector(".content-container"), { scale: 1 }, { scale: .94, ease: "none", scrollTrigger: { trigger: footer, start: "top top", end: "bottom bottom", scrub: true } });
        gsap.fromTo(section.querySelectorAll(".upper-title-overlay, .title-overlay"), { opacity: 0 }, { opacity: .2, ease: "none", scrollTrigger: { trigger: footer, start: "top top", end: "bottom bottom", scrub: true } });
      }
    }, root);
    return () => { observer.disconnect(); ctx.revert(); window.removeEventListener("resize", measure); cleanups.forEach(fn => fn()); };
  }, []);
  return <div ref={ref} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: rewriteAssetUrls(chrome.footer) }} />;
}

export function GlobalBehavior() {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cleanups: (() => void)[] = [];
    const riveInstances: import("@rive-app/canvas").Rive[] = [];
    const setRiveInput = (name: string, value: number) => riveInstances.forEach(instance => instance.stateMachineNames.forEach(machine => instance.stateMachineInputs(machine)?.forEach(input => { if (input.name === name) input.value = value; })));
    let disposed = false;
    let soundEnabled = false;
    const audio = new Audio(localAssetUrl("https://burospaces1.fra1.cdn.digitaloceanspaces.com/delta/2026-07-31T15-19-07.079Z-coffee-cycle.mp3"));
    audio.preload = "none";
    audio.loop = true; audio.volume = .25;
    const listen = (el: EventTarget, type: string, fn: EventListener) => { el.addEventListener(type, fn); cleanups.push(() => el.removeEventListener(type, fn)); };
    const resize = () => {
      const html = document.documentElement;
      html.style.setProperty("--computed-100vw", `${document.documentElement.clientWidth}px`);
      html.style.setProperty("--100vw", `${document.documentElement.clientWidth}px`);
      html.style.setProperty("--computed-100vh", `${window.innerHeight}px`);
      html.style.setProperty("--native-scrollbar-width", `${window.innerWidth - document.documentElement.clientWidth}px`);
      html.style.setProperty("--hero-mobile-height", "100svh");
    };
    resize(); listen(window, "resize", resize);
    const toggleAudio = () => {
      soundEnabled = !soundEnabled;
      document.querySelectorAll('[data-component="button-audio"], .audio-btn').forEach(button => { button.setAttribute("aria-pressed", String(soundEnabled)); button.setAttribute("aria-label", soundEnabled ? "Mute background music" : "Play background music"); });
      const mobileLabel = document.querySelector(".audio-btn .label-container > :last-child");
      if (mobileLabel) mobileLabel.textContent = soundEnabled ? "ON" : "OFF";
      document.documentElement.classList.toggle("audio-enabled", soundEnabled);
      setRiveInput("pictoSound", soundEnabled ? 1 : 0);
      if (soundEnabled) void audio.play().catch(() => {}); else audio.pause();
    };
    const dropdown = root.querySelector<HTMLElement>('[data-component="language-dropdown"]');
    const dropdownBackgrounds = root.querySelectorAll<HTMLElement>(".dropdown-bg, .root-active-bg, .root-hover-bg");
    const setDropdown = (active: boolean, hovered = -1) => {
      if (!dropdown) return;
      dropdown.classList.toggle("active", active);
      dropdown.querySelector("button")?.setAttribute("aria-expanded", String(active));
      dropdown.style.setProperty("--scale", active ? "1.2" : "1");
      setRiveInput("pictoGlobe", active ? 1 : 0);
      const container = dropdown.querySelector<HTMLElement>(".dropdown-container");
      const item = dropdown.querySelector<HTMLElement>(".list .item");
      const itemHeight = item?.offsetHeight || 48;
      const list = dropdown.querySelector<HTMLElement>(".list");
      const gap = list ? parseFloat(getComputedStyle(list).rowGap) || 0 : 0;
      const dropdownRect = dropdown.getBoundingClientRect();
      const top = container ? parseFloat(getComputedStyle(container).top) || 0 : 0;
      const width = container?.scrollWidth || 180;
      const activeIndex = Number(dropdown.querySelector<HTMLElement>('[data-active="true"]')?.dataset.index || 0);
      [dropdown, ...dropdownBackgrounds].forEach(el => {
        el.style.setProperty("--item-height", `${itemHeight}px`);
        el.style.setProperty("--active-offset", `${(itemHeight + gap) * activeIndex}px`);
        el.style.setProperty("--hover-offset", `${(itemHeight + gap) * (hovered < 0 ? activeIndex : hovered)}px`);
        el.style.setProperty("--dropdown-bgTop", `${dropdownRect.top + top}px`);
        el.style.setProperty("--dropdown-bgLeft", `${dropdownRect.right - width}px`);
        el.style.setProperty("--dropdown-bgWidth", `${width}px`);
        el.style.setProperty("--dropdown-bgHeight", `${container?.scrollHeight || 112}px`);
      });
      dropdownBackgrounds.forEach(background => background.classList.toggle("active", active && (!background.classList.contains("root-hover-bg") || hovered >= 0 && hovered !== activeIndex)));
    };
    if (dropdown) {
      listen(dropdown, "mouseenter", () => setDropdown(true));
      listen(dropdown, "mouseleave", () => setDropdown(false));
      listen(dropdown, "focusin", () => setDropdown(true));
      dropdown.querySelectorAll<HTMLElement>(".list .item").forEach((item, index) => listen(item, "mouseenter", () => setDropdown(true, index)));
      setDropdown(false);
    }
    listen(document, "keydown", ((event: KeyboardEvent) => { if (event.key === "Escape") setDropdown(false); }) as EventListener);
    listen(document, "click", ((event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-component="button-audio"], .audio-btn')) toggleAudio();
      const dropdownButton = target.closest('[data-component="language-dropdown"] .dropdown-btn');
      if (dropdownButton && dropdown) {
        setDropdown(!dropdown.classList.contains("active"));
      } else if (!target.closest('[data-component="language-dropdown"]')) {
        setDropdown(false);
      }
    }) as EventListener);
    document.querySelectorAll<HTMLElement>('[data-component="button-audio"]').forEach(button => {
      listen(button, "mouseenter", () => button.style.setProperty("--scale", "1.1"));
      listen(button, "mouseleave", () => button.style.setProperty("--scale", "1"));
    });
    import("@rive-app/canvas").then(({ Rive, RuntimeLoader, Layout, Fit, Alignment }) => {
      RuntimeLoader.setWasmUrl("/rive.wasm");
      Rive.suppressDeprecationWarnings = ["state-machine-inputs"];
      document.querySelectorAll<HTMLCanvasElement>('[data-component="button-audio"] canvas, [data-component="language-dropdown"] canvas, .audio-btn canvas').forEach(canvas => {
        if (disposed || !canvas.dataset.file) return;
        const instance = new Rive({ src: canvas.dataset.file, canvas, autoplay: true, stateMachine: "State Machine 1", layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }), onLoad: () => { if (disposed) return; instance.resizeDrawingSurfaceToCanvas(); if (instance.stateMachineNames[0]) instance.play(instance.stateMachineNames[0]); setRiveInput("pictoSound", soundEnabled ? 1 : 0); } });
        riveInstances.push(instance);
      });
    }).catch(() => {});
    const floatingQuiz = root.querySelector<HTMLElement>('[data-component="button-quiz"]');
    const floatingCycle = root.querySelector<HTMLElement>('[data-component="coffee-cycle-selector"]');
    const ctx = gsap.context(() => {
      if (floatingQuiz) {
        const isProduct = pathname.startsWith("/en/products");
        floatingQuiz.style.display = isProduct ? "" : "none";
        if (isProduct) {
          gsap.set(floatingQuiz, { autoAlpha: 1, scale: 1 });
          gsap.to(floatingQuiz.querySelector(".image"), { rotation: 360, duration: 24, repeat: -1, ease: "none" });
          ScrollTrigger.create({ start: window.innerHeight, onEnter: () => gsap.to(floatingQuiz, { autoAlpha: 0, scale: .9 }), onLeaveBack: () => gsap.to(floatingQuiz, { autoAlpha: 1, scale: 1 }) });
        }
      }
      if (floatingCycle) {
        const routes = ["origins", "roast", "blend", "tasting"];
        const selected = routes.findIndex(route => pathname === `/en/coffee-cycle/${route}`);
        floatingCycle.style.display = selected < 0 ? "none" : "";
        if (selected >= 0) {
          gsap.set(floatingCycle.querySelector(".inner"), { autoAlpha: 1, y: 0 });
          floatingCycle.querySelectorAll<HTMLElement>(".media-container").forEach((item, index) => { const offset = (index - selected + routes.length) % routes.length; gsap.set(item, { x: (routes.length - 1 - offset) * 12, zIndex: routes.length - offset }); item.classList.toggle("active", index === selected); });
          floatingCycle.querySelectorAll(".page-title .item").forEach((item, index) => item.classList.toggle("active", index === selected));
          floatingCycle.querySelectorAll("button").forEach((button, index) => listen(button, "click", () => { window.location.href = `/en/coffee-cycle/${routes[(selected + (index ? 1 : -1) + routes.length) % routes.length]}`; }));
        }
      }
    }, root);
    return () => { disposed = true; cleanups.forEach(fn => fn()); riveInstances.forEach(instance => instance.cleanup()); audio.pause(); ctx.revert(); };
  }, [pathname]);
  return <div ref={ref} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: rewriteAssetUrls(chrome.extras) }} />;
}
