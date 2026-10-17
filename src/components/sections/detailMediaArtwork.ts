import gsap from "gsap";
import artwork from "@/data/detail-artwork.json";
import { localAssetUrl } from "@/lib/assets";
import type { Chart, ArcElement } from "chart.js";

type Source = { url: string; width: number; height: number; type: string };
type RecordData = {
  videos?: { selector: string; index: number; sources: Source[] }[];
  svgs?: { selector: string; url: string }[];
  lotties?: { selector: string; url: string }[];
  charts?: { selector: string; kind: string; items: { name: string; percentage: number | null; image: { url: string } }[] }[];
};

/** Media omitted by the reference site's server-side ClientOnly placeholders. */
export function initializeDetailMediaArtwork(root: HTMLElement) {
  const key = window.location.pathname.replace(/^\/en\/?/, "").replace(/\/$/, "");
  const record = (artwork as Record<string, RecordData>)[key] ?? {};
  const abort = new AbortController();
  const cleanups: (() => void)[] = [];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let disposed = false;
  const media = new Map<HTMLVideoElement, Source[]>();
  for (const entry of record.videos ?? []) {
    const video = root.querySelectorAll<HTMLVideoElement>(entry.selector)[entry.index];
    if (video && !video.getAttribute("src") && !video.querySelector("source[src]")) media.set(video, entry.sources);
  }
  // These shared pre-footers use the same teaser on every product page.
  root.querySelectorAll<HTMLVideoElement>('[data-component="pre-footer"] video').forEach(video => {
    if (media.has(video) || video.getAttribute("src")) return;
    const href = video.closest('[data-component="pre-footer"]')?.querySelector("a")?.getAttribute("href");
    const route = href === "/en/about" ? "products/ground/origens/angola" : href === "/en/coffee-cycle" ? "history" : "";
    const fallback = (artwork as Record<string, RecordData>)[route]?.videos?.at(-1)?.sources;
    if (fallback) media.set(video, fallback);
  });
  const visibleVideos = new Set<HTMLVideoElement>();
  const videoObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    const video = entry.target as HTMLVideoElement;
    if (entry.isIntersecting) { visibleVideos.add(video); if (!reduced && !document.hidden) void video.play().catch(() => {}); }
    else { visibleVideos.delete(video); video.pause(); }
  }), { rootMargin: "200px" });
  const selectVideos = () => media.forEach((sources, video) => {
    if (!sources.length) return;
    const mobile = innerWidth <= 743;
    const preferred = sources.find(source => /mobile/i.test(source.url) === mobile);
    const selected = preferred ?? (mobile ? sources.at(-1)! : sources[0]);
    const url = localAssetUrl(selected.url);
    if (video.getAttribute("src") !== url) {
      video.src = url; video.muted = true; video.playsInline = true;
      video.loop = true; video.preload = "metadata";
      if (visibleVideos.has(video) && !reduced && !document.hidden) void video.play().catch(() => {});
    }
  });
  selectVideos();
  media.forEach((_, video) => videoObserver.observe(video));
  window.addEventListener("resize", selectVideos);
  const videoVisibility = () => visibleVideos.forEach(video => { if (document.hidden || reduced) video.pause(); else void video.play().catch(() => {}); });
  document.addEventListener("visibilitychange", videoVisibility);
  cleanups.push(() => { videoObserver.disconnect(); window.removeEventListener("resize", selectVideos); document.removeEventListener("visibilitychange", videoVisibility); media.forEach((_, video) => video.pause()); });

  for (const entry of record.svgs ?? []) {
    const container = root.querySelector<HTMLElement>(entry.selector);
    if (!container || container.querySelector("svg")) continue;
    void fetch(localAssetUrl(entry.url), { signal: abort.signal }).then(response => response.ok ? response.text() : "").then(markup => {
      if (!markup || disposed) return;
      const svg = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
      if (svg.tagName !== "svg") return;
      svg.querySelectorAll("script,foreignObject").forEach(node => node.remove());
      const wrapper = document.createElement("span"); wrapper.className = "svg-wrapper"; wrapper.setAttribute("data-v-bc981ec9", "");
      wrapper.append(document.importNode(svg, true));
      const original = [...container.childNodes]; container.replaceChildren(wrapper);
      cleanups.push(() => container.replaceChildren(...original));
    }).catch(() => {});
  }

  if (record.lotties?.length) void import("lottie-web").then(async ({ default: lottie }) => {
    for (const entry of record.lotties ?? []) {
      const container = root.querySelector<HTMLElement>(entry.selector);
      if (!container || disposed) continue;
      try {
        const response = await fetch(localAssetUrl(entry.url), { signal: abort.signal });
        if (!response.ok || disposed) continue;
        const animationData = await response.json();
        if (disposed) return;
        const directory = localAssetUrl(entry.url).replace(/[^/]+$/, "");
        for (const asset of animationData.assets ?? []) {
          if (asset.p && !asset.e) asset.u = directory + (asset.u ?? "");
        }
        const animation = lottie.loadAnimation({ container, renderer: "svg", animationData, loop: true, autoplay: false });
        const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting && !reduced) animation.play(); else animation.pause(); }, { rootMargin: "100px" });
        observer.observe(container);
        cleanups.push(() => { observer.disconnect(); animation.destroy(); });
      } catch { /* Route changes abort pending local media. */ }
    }
  }).catch(() => {});

  for (const entry of record.charts ?? []) {
    const host = root.querySelector<HTMLElement>(entry.selector);
    const canvas = host?.querySelector<HTMLCanvasElement>("canvas");
    const layer = host?.querySelector<HTMLElement>(".elements-layer");
    if (!host || !canvas || !layer) continue;
    let chart: Chart<"doughnut", number[], string> | undefined;
    let active = -1;
    const images = document.createElement("div"); images.className = "images-container";
    layer.append(images);
    const popup = host.querySelector<HTMLElement>('[data-component="popup"]');
    const captions = [...host.querySelectorAll<HTMLElement>(".mobile-captions .item")];
    const elements = entry.items.map(item => {
      const element = document.createElement("div"); element.className = "element";
      Object.assign(element.style, { position: "absolute", display: "flex", alignItems: "center" });
      const img = new Image(); img.src = localAssetUrl(item.image.url); img.alt = item.name;
      element.append(img); images.append(element); return element;
    });
    const reset = () => {
      active = -1; captions.forEach(item => item.classList.remove("active"));
      elements.forEach(element => gsap.to(element.firstChild, { scale: 1, duration: .3, overwrite: true }));
      if (popup) gsap.to(popup, { autoAlpha: 0, duration: .2, overwrite: true });
    };
    const updateImages = (instance: Chart<"doughnut", number[], string>) => {
      const arcs = instance.getDatasetMeta(0).data as ArcElement[];
      arcs.forEach((arc, index) => {
        const { x, y } = arc.getCenterPoint(true);
        const rotation = (arc.startAngle + arc.endAngle) / 2 * 180 / Math.PI + 90;
        gsap.set(elements[index], { left: x, top: y, xPercent: -50, yPercent: -50, rotation });
        const image = elements[index].firstChild as HTMLImageElement;
        const size = innerWidth <= 743 ? 80 : innerWidth <= 1290 ? 160 : innerWidth > 1919 ? 240 : 140;
        image.width = image.height = size;
      });
    };
    const resizeChart = () => {
      if (!chart) return;
      const notes = entry.kind === "notes";
      chart.options.circumference = notes && innerWidth > 1023 ? 180 : 360;
      chart.options.cutout = `${notes && innerWidth <= 1023 ? 40 : 55}%`;
      chart.data.datasets[0].spacing = notes ? innerWidth > 1023 ? 100 : 0 : innerWidth < 744 ? 20 : 40;
      chart.update("none");
    };
    const tiltChart = (event: PointerEvent) => {
      if (entry.kind !== "notes" || innerWidth <= 1023 || reduced) return;
      const box = host.getBoundingClientRect();
      gsap.to(host, { rotation: -2 + (event.clientX - box.left) / box.width * 4, transformOrigin: "top", duration: 2.5, ease: "power4.out", overwrite: true });
    };
    window.addEventListener("resize", resizeChart);
    host.addEventListener("pointermove", tiltChart);
    cleanups.push(() => { window.removeEventListener("resize", resizeChart); host.removeEventListener("pointermove", tiltChart); gsap.killTweensOf(host); });
    const observer = new IntersectionObserver(([visible]) => {
      if (!visible.isIntersecting || chart) return;
      observer.disconnect();
      void import("chart.js/auto").then(({ default: ChartJS }) => {
        if (disposed) return;
        const notes = entry.kind === "notes";
        chart = new ChartJS(canvas, {
          type: "doughnut",
          data: { labels: entry.items.map(item => item.name), datasets: [{ data: entry.items.map(item => item.percentage ?? 100 / entry.items.length), backgroundColor: "#2b1b1400", borderColor: "#56372a", borderWidth: 1, hoverBackgroundColor: notes ? "#1a100c" : "#2b1b14", hoverBorderColor: "rgba(53,34,26,.6)", spacing: notes ? innerWidth > 1023 ? 100 : 0 : innerWidth < 744 ? 20 : 40 }] },
          options: {
            responsive: true, maintainAspectRatio: false,
            rotation: 90, circumference: notes && innerWidth > 1023 ? 180 : 360,
            cutout: `${notes && innerWidth <= 1023 ? 40 : 55}%`,
            animation: reduced ? false : { duration: 800, easing: "easeOutQuart", animateRotate: true, animateScale: true },
            layout: { padding: notes ? 0 : innerWidth < 744 ? 10 : 60 },
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            onHover: (event, hit) => {
              const index = hit[0]?.index ?? -1;
              if (index === active) return;
              reset(); active = index;
              if (index < 0) return;
              captions[index]?.classList.add("active");
              gsap.to(elements[index].firstChild, { scale: 1.1, duration: .3, overwrite: true });
              if (popup && innerWidth > 1023) {
                popup.querySelectorAll<HTMLElement>(".content > .item").forEach((item, i) => item.classList.toggle("active", i === index));
                const content = popup.querySelector<HTMLElement>(".content");
                content?.style.setProperty("--content-width", "220px"); content?.style.setProperty("--content-height", "60px");
                gsap.set(popup, { left: event.x ?? 0, top: event.y ?? 0, xPercent: -50, yPercent: -110 });
                gsap.to(popup, { autoAlpha: 1, duration: .2, overwrite: true });
              }
            },
          },
          plugins: [{ id: "delta-artwork", afterDatasetsDraw: updateImages }],
        });
        gsap.fromTo(elements, { opacity: 0, scale: .6 }, { opacity: 1, scale: 1, duration: reduced ? 0 : .6, stagger: .05, delay: .3, ease: "power3.out" });
      }).catch(() => {});
    }, { rootMargin: "200px" });
    observer.observe(host);
    host.addEventListener("mouseleave", reset);
    cleanups.push(() => { observer.disconnect(); host.removeEventListener("mouseleave", reset); chart?.destroy(); gsap.killTweensOf(elements); elements.forEach(element => gsap.killTweensOf(element.firstChild)); images.remove(); if (popup) gsap.killTweensOf(popup); });
  }
  return () => { disposed = true; abort.abort(); cleanups.forEach(cleanup => cleanup()); };
}
