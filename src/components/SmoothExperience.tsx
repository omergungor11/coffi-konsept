"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default function SmoothExperience({ bodyClass = "page.home" }: { bodyClass?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    document.body.className = bodyClass;
    const colors: Record<string, string> = {
      "page.home": "#2b1b14", "page.products": "#f2dece", "page.product": "#f2dece",
      "page.coffeeCycle": "#110b08", "page.academy": "#35221a", "page.centre": "#221611",
      "page.history": "#35221a", "page.about": "#35221a", "page.sustainability": "#142115",
      "page.journal": "#f8eae0", "page.article": "#f8eae0", "page.legal": "#f8eae0",
      "page.acores": "#f0ffdf", "page.businessSolutions": "#142115", "page.quizResult": "#f8eae0",
    };
    document.documentElement.style.setProperty("--body-backgroundColor", colors[bodyClass] ?? "#110b08");
    gsap.registerPlugin(ScrollTrigger);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: !reduced,
      syncTouch: false,
      prevent: (node) => node.hasAttribute("data-lenis-prevent") || node.closest(".navigation-open .mobile-menu-container") !== null,
    });
    lenis.scrollTo(0, { immediate: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    const onMenu = (event: Event) => (event as CustomEvent<{ open: boolean }>).detail.open ? lenis.stop() : lenis.start();
    window.addEventListener("delta:menu", onMenu);
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.hash && url.pathname === window.location.pathname) {
        const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
        if (target) { event.preventDefault(); lenis.scrollTo(target, { offset: -100, immediate: reduced }); }
        return;
      }
      if (url.pathname.startsWith("/en") || url.pathname === "/") {
        event.preventDefault();
        router.push(url.pathname + url.search + url.hash);
      }
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("delta:menu", onMenu);
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, [pathname, bodyClass, router]);

  return null;
}
