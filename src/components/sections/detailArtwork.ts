import productArtwork from "@/data/product-artwork.json";
import { localAssetUrl } from "@/lib/assets";

type Artwork = {
  intensity: number;
  intensitySvg: string;
  backgroundType: string;
  desktop: string;
  mobile: string;
  video: { url: string; type: string; width: number; height: number }[];
  videoMuted: boolean;
  videoLoop: boolean;
};

type Animation = {
  play(name?: string): void;
  pause(): void;
  cleanup(): void;
  resizeDrawingSurfaceToCanvas(dpr?: number): void;
  drawFrame(): void;
  stateMachineNames: string[];
};

/** Restores graphics that the original site's ClientOnly components omit from SSR. */
export function initializeDetailArtwork(root: HTMLElement): () => void {
  const product = root.querySelector<HTMLElement>('[data-component="product"]');
  const header = product?.querySelector<HTMLElement>('header[data-component="header"]');
  const background = header?.querySelector<HTMLElement>('[data-component="background"]');
  const record = (productArtwork as Record<string, Artwork>)[window.location.pathname.replace(/\/$/, "")];
  if (!product || !header || !background || !record) return () => {};
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobileQuery = window.matchMedia("(max-width: 743px)");
  const abort = new AbortController();
  const restore = new Map<HTMLElement, Node[]>();
  const cleanups: (() => void)[] = [];
  const animations = new Set<Animation>();
  const svgRequests = new Map<string, Promise<string>>();
  let disposed = false, visible = true;

  const replace = (element: HTMLElement, ...children: Node[]) => {
    if (!restore.has(element)) restore.set(element, Array.from(element.childNodes));
    element.replaceChildren(...children);
  };
  const scope = (element: HTMLElement, ...ids: string[]) => {
    ids.forEach(id => element.setAttribute(`data-v-${id}`, ""));
    return element;
  };
  const svg = async (element: HTMLElement | null, source: string) => {
    if (!element || !source || element.querySelector("svg")) return;
    const url = localAssetUrl(source);
    let request = svgRequests.get(url);
    if (!request) {
      request = fetch(url, { signal: abort.signal }).then(response => response.ok ? response.text() : "");
      svgRequests.set(url, request);
    }
    try {
      const markup = await request;
      if (disposed || !markup) return;
      const namespaced = /<svg\b[^>]*\bxmlns=/.test(markup) ? markup : markup.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
      const documentSvg = new DOMParser().parseFromString(namespaced, "image/svg+xml");
      const original = documentSvg.documentElement;
      if (original.tagName !== "svg") return;
      original.querySelectorAll("script, foreignObject").forEach(node => node.remove());
      original.querySelectorAll("*").forEach(node => Array.from(node.attributes).forEach(attribute => { if (attribute.name.toLowerCase().startsWith("on")) node.removeAttribute(attribute.name); }));
      const wrapper = scope(document.createElement("span"), "bc981ec9");
      wrapper.className = "svg-wrapper";
      wrapper.append(document.importNode(original, true));
      replace(element, wrapper);
    } catch { /* Aborted route changes leave the original placeholder intact. */ }
  };

  void svg(background.querySelector<HTMLElement>(".ribbon"), "/imgs/product/ribbon-alt.svg");
  void svg(background.querySelector<HTMLElement>(".ribbon-mobile"), "/imgs/product/ribbon-mobile.svg");
  void svg(header.querySelector<HTMLElement>('[data-component="intensity"] [data-component="svg-asset"]'), record.intensitySvg);
  product.querySelectorAll<HTMLElement>('[data-component="svg-asset"].origins-logo').forEach(element => { void svg(element, "/imgs/product/origins-script.svg"); });

  const runtime = import("@rive-app/canvas");
  const makeRive = (container: HTMLElement, desktop: string, mobile: string, defaultGraphic = false) => {
    let generation = 0, animation: Animation | null = null;
    const mount = async () => {
      const current = ++generation;
      if (animation) { animation.cleanup(); animations.delete(animation); animation = null; }
      const source = mobileQuery.matches ? mobile : desktop;
      if (!source) { replace(container); return; }
      const wrapper = scope(document.createElement("div"), "3fda4e32", "a98c4a7a");
      wrapper.dataset.component = "rive-asset";
      wrapper.className = `canvas cover ${mobileQuery.matches ? "animation-mobile" : "animation"}`;
      // The source's default Rive shares the ribbon's entire artboard.
      if (defaultGraphic) { wrapper.style.position = "absolute"; wrapper.style.inset = "0"; }
      const canvas = scope(document.createElement("canvas"), "a98c4a7a") as HTMLCanvasElement;
      canvas.dataset.file = localAssetUrl(source); canvas.dataset.artworkOwned = "";
      canvas.setAttribute("aria-hidden", "true");
      wrapper.append(canvas); replace(container, wrapper);
      const { Rive, RuntimeLoader, Layout, Fit, Alignment } = await runtime;
      if (disposed || current !== generation) return;
      RuntimeLoader.setWasmUrl("/rive.wasm");
      const instance = new Rive({
        src: localAssetUrl(source), canvas, autoplay: false, autoBind: true,
        stateMachine: "State Machine 1", isTouchScrollEnabled: true,
        layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
        onLoad: () => {
          if (disposed || current !== generation) return;
          instance.resizeDrawingSurfaceToCanvas(Math.min(window.devicePixelRatio || 1, 2));
          const machine = instance.stateMachineNames.includes("State Machine 1") ? "State Machine 1" : instance.stateMachineNames[0];
          if (visible && !document.hidden && !reduced) instance.play(machine);
          else instance.drawFrame();
        },
      });
      animation = instance; animations.add(instance);
    };
    const resize = new ResizeObserver(() => animation?.resizeDrawingSurfaceToCanvas(Math.min(window.devicePixelRatio || 1, 2)));
    resize.observe(container);
    const changed = () => { void mount().catch(() => {}); };
    mobileQuery.addEventListener("change", changed);
    cleanups.push(() => { generation++; mobileQuery.removeEventListener("change", changed); resize.disconnect(); if (animation) { animation.cleanup(); animations.delete(animation); animation = null; } });
    void mount().catch(() => {});
  };

  const backgroundContainer = background.querySelector<HTMLElement>(".background-container");
  if (record.backgroundType === "animation" && backgroundContainer) makeRive(backgroundContainer, record.desktop, record.mobile);
  if (record.backgroundType !== "animation") {
    const ribbons = background.querySelector<HTMLElement>(".ribbon-container");
    if (ribbons) {
      let defaultContainer = ribbons.querySelector<HTMLElement>(":scope > span");
      if (!defaultContainer) {
        defaultContainer = document.createElement("span"); ribbons.append(defaultContainer);
        const owned = defaultContainer; cleanups.push(() => owned.remove());
      }
      makeRive(defaultContainer, "/rives/product-header-default-intro.riv", "/rives/product-header-default-mobile.riv", true);
    }
  }

  let headerVideo: HTMLVideoElement | null = null;
  if (record.backgroundType === "video" && backgroundContainer && record.video.length) {
    const video = scope(document.createElement("video"), "3fda4e32", "ac455cf8") as HTMLVideoElement;
    video.dataset.component = "media-asset"; video.dataset.artworkOwned = ""; video.className = "media";
    video.muted = record.videoMuted; video.loop = record.videoLoop; video.playsInline = true; video.preload = "auto";
    video.setAttribute("aria-hidden", "true"); replace(backgroundContainer, video); headerVideo = video;
    const supportsWebm = () => {
      const agent = navigator.userAgent.toLowerCase();
      const ios = /ipad|iphone|ipod/.test(agent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
      const safari = agent.includes("safari") && !agent.includes("chrome") && !agent.includes("android");
      return !ios && !safari && video.canPlayType("video/webm") !== "";
    };
    const selectSource = () => {
      const webm = supportsWebm();
      const matching = record.video.filter(source => webm === (source.type === "video/webm" || source.url.endsWith(".webm")));
      const sources = matching.length ? matching : record.video;
      const targetWidth = (window.devicePixelRatio || 1) * window.innerWidth;
      const difference = (width: number) => { const difference = targetWidth - width; return Math.abs(difference < 0 ? difference * 3 : difference); };
      const selected = [...sources].sort((a, b) => difference(a.width) - difference(b.width))[0];
      const src = localAssetUrl(selected.url);
      if (video.getAttribute("src") !== `${src}#t=0.1`) {
        video.src = `${src}#t=0.1`; video.width = selected.width; video.height = selected.height; video.load();
        if (visible && !document.hidden && !reduced) void video.play().catch(() => {});
      }
    };
    window.addEventListener("resize", selectSource); selectSource();
    cleanups.push(() => { window.removeEventListener("resize", selectSource); video.pause(); video.removeAttribute("src"); video.load(); });
  }

  const playback = () => {
    const play = visible && !document.hidden && !reduced;
    animations.forEach(animation => play ? animation.play() : animation.pause());
    if (headerVideo) { if (play) void headerVideo.play().catch(() => {}); else headerVideo.pause(); }
  };
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; playback(); }, { threshold: .01 });
  observer.observe(header); document.addEventListener("visibilitychange", playback);
  return () => {
    disposed = true; abort.abort(); observer.disconnect(); document.removeEventListener("visibilitychange", playback);
    cleanups.forEach(cleanup => cleanup()); animations.forEach(animation => animation.cleanup()); animations.clear();
    restore.forEach((children, element) => element.replaceChildren(...children));
  };
}
