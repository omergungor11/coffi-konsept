"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRouter } from "next/navigation";
import { initializeQuiz } from "./sections/quiz";
import { rewriteAssetUrls, localAssetUrl } from "@/lib/assets";
import { initializeDetailInteractions } from "./sections/detailInteractions";
import { initializeDetailArtwork } from "./sections/detailArtwork";
import { initializeDetailMediaArtwork } from "./sections/detailMediaArtwork";

export default function DetailExperience({ markup }: { markup: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    gsap.registerPlugin(ScrollTrigger);
    const cleanups: (() => void)[] = [];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const context = gsap.context(() => {
      cleanups.push(initializeQuiz(root, url => router.push(url), reduced));
      root.querySelectorAll<HTMLElement>('[data-component="transition-logo-mask"] .slot-wrapper').forEach(el => {
        el.style.clipPath = "none";
        el.style.position = "relative";
      });
      root.querySelectorAll<HTMLVideoElement>("video").forEach(video => {
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        void video.play().catch(() => {});
      });
      cleanups.push(initializeDetailInteractions(root, url => router.push(url)));
      cleanups.push(initializeDetailArtwork(root));
      cleanups.push(initializeDetailMediaArtwork(root));
      if (!reduced) root.querySelectorAll<HTMLElement>("main > section").forEach(section => {
        const targets = section.querySelectorAll("h2, h3, .copy");
        if (targets.length) gsap.from(targets, { y: 24, autoAlpha: 0, duration: .9, stagger: .04, ease: "power3.out", scrollTrigger: { trigger: section, start: "top 90%", once: true } });
      });
      const groups = root.querySelectorAll<HTMLElement>("footer .main-group");
      groups.forEach(group => {
        const heading = group.querySelector<HTMLElement>(".group-title-wrapper");
        if (!heading) return;
        heading.tabIndex = 0; heading.setAttribute("role", "button"); heading.setAttribute("aria-expanded", "false");
        const toggle = () => {
          if (window.innerWidth > 1023) return;
          group.style.setProperty("--group-list-height", `${group.querySelector<HTMLElement>(".links-list")?.offsetHeight || 0}px`);
          heading.setAttribute("aria-expanded", String(group.classList.toggle("active")));
        };
        heading.addEventListener("click", toggle); cleanups.push(() => heading.removeEventListener("click", toggle));
        const keydown = (event: KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); } };
        heading.addEventListener("keydown", keydown); cleanups.push(() => heading.removeEventListener("keydown", keydown));
      });
    }, root);
    let disposed = false;
    const animations: { cleanup(): void }[] = [];
    import("@rive-app/canvas").then(({ Rive, RuntimeLoader, Layout, Fit, Alignment }) => {
      if (disposed) return;
      RuntimeLoader.setWasmUrl("/rive.wasm");
      root.querySelectorAll<HTMLCanvasElement>("canvas[data-file]:not([data-artwork-owned])").forEach(canvas => {
        const animation = new Rive({ src: localAssetUrl(canvas.dataset.file!), canvas, autoplay: !reduced, stateMachine: "State Machine 1", layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }), onLoad: () => animation.resizeDrawingSurfaceToCanvas() });
        animations.push(animation);
      });
    }).catch(() => {});
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 400);
    return () => { disposed = true; animations.forEach(animation => animation.cleanup()); clearTimeout(refresh); cleanups.forEach(fn => fn()); context.revert(); };
  }, [markup, router]);
  return <div ref={ref} className="detail-experience" style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: rewriteAssetUrls(markup) }} />;
}
