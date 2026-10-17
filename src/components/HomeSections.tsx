'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import markup from '../data/section-markup.json';
import headerData from '../data/header-data.json';
import { localAssetUrl, rewriteAssetUrls } from '../lib/assets';
import { animateCoffeeOrbits } from './sections/homeMotion';
import { initializeHomeExtras } from './sections/homeExtras';

const html = rewriteAssetUrls(markup.header + '<main data-v-15ca78d0>' + Object.entries(markup).filter(([name]) => name !== 'header').map(([, value]) => value).join('') + '</main>').replaceAll('href="/cafe-dos-acores"', 'href="/en/the-azores-coffee"');

export default function HomeSections() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    const cleanup: (() => void)[] = [];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const $ = <T extends Element = HTMLElement>(selector: string) => el.querySelector<T>(selector);
    const $$ = <T extends Element = HTMLElement>(selector: string) => [...el.querySelectorAll<T>(selector)];
    const listen = (target: EventTarget, type: string, fn: EventListener, options?: AddEventListenerOptions) => {
      target.addEventListener(type, fn, options);
      cleanup.push(() => target.removeEventListener(type, fn, options));
    };
    const context = gsap.context(() => {
      // The source's entrance transform creates this stacking context. Preserve it
      // after the entrance so each slide stays behind the interactive foreground.
      gsap.set($('[data-component="header"] > .above-the-fold > .background-container'), { zIndex: 0 });
      // The public homepage renders three synchronised video, title and thumbnail tracks.
      const media = $$<HTMLElement>('[data-component="header"] > .above-the-fold > .background-container > .media-container > .item');
      const titles = $$<HTMLElement>('[data-component="header"] .top-container > .title-container > .item');
      const thumbs = $$<HTMLElement>('[data-component="thumbs"] .list > .item');
      let active = 0;
      let progress: gsap.core.Tween | undefined;
      const select = (index: number, animate = true) => {
        active = (index + media.length) % media.length;
        progress?.kill();
        media.forEach((item, i) => {
          const video = item.querySelector('video');
          item.classList.toggle('active', i === active);
          titles[i]?.classList.toggle('active', i === active);
          gsap.killTweensOf([item, titles[i]]);
          if (i === active) {
            gsap.fromTo(item, { autoAlpha: animate ? 0 : 1, scale: animate ? 1.1 : 1.05, y: animate ? 40 : 0, zIndex: 2 }, { autoAlpha: 1, scale: 1.05, y: 0, duration: animate && !reduced ? .75 : 0, delay: animate ? .25 : 0, ease: 'power2.inOut' });
            gsap.fromTo(titles[i], { autoAlpha: animate ? 0 : 1, x: animate ? -10 : 0, zIndex: 2 }, { autoAlpha: 1, x: 0, duration: animate && !reduced ? .5 : 0, delay: animate ? .25 : 0, pointerEvents: 'auto', ease: 'power2.inOut' });
            void video?.play().catch(() => {});
          } else {
            gsap.to(item, { autoAlpha: 0, scale: 1, y: animate ? -40 : 0, zIndex: 1, duration: animate && !reduced ? 1 : 0, ease: 'power2.inOut', onComplete: () => { if (video) video.currentTime = 0; } });
            gsap.to(titles[i], { autoAlpha: 0, x: animate ? 10 : 0, pointerEvents: 'none', duration: animate && !reduced ? .5 : 0 });
            video?.pause();
          }
        });
        thumbs.forEach((thumb, i) => {
          thumb.classList.toggle('is-active', i === active);
          thumb.classList.toggle('is-passed', i < active);
          thumb.setAttribute('aria-selected', String(i === active));
          gsap.set(thumb.querySelector('.progress'), { scaleX: i < active ? 1 : 0, transformOrigin: 'left center' });
        });
        progress = gsap.to(thumbs[active]?.querySelector('.progress'), { scaleX: 1, duration: Math.min(headerData.backgroundSlider[active]?.media[0]?.duration ?? 6, 15), ease: 'none', onComplete: () => select(active + 1) });
        const thumbList = $<HTMLElement>('[data-component="thumbs"] .list');
        const thumbViewport = thumbList?.parentElement;
        if (thumbList && thumbViewport) gsap.to(thumbList, { x: -Math.min(Math.max(0, thumbList.scrollWidth - thumbViewport.clientWidth), thumbs[active].offsetLeft), duration: .5 });
      };
      media.forEach((item, i) => {
        const video = item.querySelector('video');
        if (!video) return;
        const sources = headerData.backgroundSlider[i].media[0].sources;
        video.src = localAssetUrl(sources[innerWidth <= 743 && sources.length > 1 ? 1 : 0].url);
        video.muted = true;
        video.playsInline = true;
        video.poster = localAssetUrl(headerData.backgroundSlider[i].thumbnail.url);
      });
      thumbs.forEach((thumb, i) => {
        thumb.tabIndex = 0;
        thumb.setAttribute('role', 'tab');
        thumb.setAttribute('aria-label', headerData.backgroundSlider[i].title.replace('\n', ' '));
        listen(thumb, 'click', () => select(i));
        listen(thumb, 'keydown', ((event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(i); }
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); select(active + (event.key === 'ArrowRight' ? 1 : -1)); thumbs[active].focus(); }
        }) as EventListener);
      });
      const thumbnailTrack = $<HTMLElement>('[data-component="thumbs"] .list');
      if (thumbnailTrack) {
        let pressed = false, originX = 0, originOffset = 0, moved = false;
        thumbnailTrack.style.touchAction = 'pan-y';
        listen(thumbnailTrack, 'pointerdown', ((event: PointerEvent) => {
          pressed = true; moved = false; originX = event.clientX;
          originOffset = Number(gsap.getProperty(thumbnailTrack, 'x')) || 0;
          gsap.killTweensOf(thumbnailTrack);
        }) as EventListener);
        listen(window, 'pointermove', ((event: PointerEvent) => {
          if (!pressed) return;
          const delta = event.clientX - originX;
          if (Math.abs(delta) > 5) moved = true;
          const width = thumbnailTrack.parentElement?.clientWidth ?? innerWidth;
          gsap.set(thumbnailTrack, { x: gsap.utils.clamp(Math.min(0, width - thumbnailTrack.scrollWidth), 0, originOffset + delta) });
        }) as EventListener);
        listen(window, 'pointerup', () => { pressed = false; });
        listen(window, 'pointercancel', () => { pressed = false; });
        listen(thumbnailTrack, 'click', event => { if (moved) { event.preventDefault(); event.stopPropagation(); moved = false; } }, { capture: true });
        listen(thumbnailTrack, 'dragstart', event => event.preventDefault());
      }
      select(0, false);
      cleanup.push(() => progress?.kill());

      const cycleVideo = $<HTMLVideoElement>('[data-component="coffee-cycle"] video');
      if (cycleVideo) {
        cycleVideo.src = localAssetUrl('https://burospaces1.fra1.cdn.digitaloceanspaces.com/delta/' + (innerWidth <= 743 ? '2026-05-28T14-22-31.599Z-ciclo-mobile.mp4' : '2026-03-17T12-24-57.271Z-ciclo.mp4'));
        cycleVideo.muted = true;
        void cycleVideo.play().catch(() => {});
      }
      $$<HTMLVideoElement>('[data-component="history"] video').forEach(video => { video.muted = true; void video.play().catch(() => {}); });

      // The four glass tiles share an exact grid with their backdrop-filter layers.
      const highlights = $<HTMLElement>('[data-component="highlights-grid"]');
      const glass = $$<HTMLElement>('.highlights-grid-bg-cell');
      const updateGlass = () => {
        if (!highlights) return;
        const box = highlights.getBoundingClientRect();
        glass.forEach(cell => {
          cell.style.setProperty('--bg-top', `${box.top + scrollY}px`);
          cell.style.setProperty('--bg-left', `${box.left + scrollX}px`);
          cell.style.setProperty('--bg-width', `${box.width}px`);
          cell.style.setProperty('--bg-height', `${box.height}px`);
        });
      };
      updateGlass();
      let glassFrame = requestAnimationFrame(updateGlass);
      listen(window, 'resize', () => { cancelAnimationFrame(glassFrame); glassFrame = requestAnimationFrame(updateGlass); });
      const resize = new ResizeObserver(updateGlass);
      if (highlights) resize.observe(highlights);
      cleanup.push(() => { resize.disconnect(); cancelAnimationFrame(glassFrame); });
      const multiCells: HTMLElement[][] = [];
      highlights?.querySelectorAll<HTMLElement>('.cell').forEach(cell => {
        const cards = [...cell.querySelectorAll<HTMLElement>('.cta-container')];
        cards.forEach((card, i) => gsap.set(card, { autoAlpha: i === 0 ? 1 : 0 }));
        if (cards.length > 1) multiCells.push(cards);
      });
      let tile = 0;
      const tileTimer = window.setInterval(() => {
        if (!multiCells.length || highlights?.matches(':hover') || document.hidden) return;
        const cards = multiCells[tile++ % multiCells.length];
        const index = cards.findIndex(card => Number(gsap.getProperty(card, 'opacity')) > .5);
        gsap.to(cards[index], { autoAlpha: 0, scale: .95, duration: .8 });
        gsap.fromTo(cards[(index + 1) % cards.length], { autoAlpha: 0, scale: 1.12 }, { autoAlpha: 1, scale: 1, duration: 1, delay: .1 });
      }, 4200);
      cleanup.push(() => clearInterval(tileTimer));

      // Infinite strips retain their duplicate original lists, while pointer dragging
      // adjusts the same transform used by their animation.
      const loopStrip = (track: HTMLElement, duration: number, direction: number, draggable = false) => {
        const state = { x: 0 };
        let dragging = false;
        let hovered = false;
        let start = 0;
        let base = 0;
        let dragged = false;
        let visible = false;
        let trackWidth = track.scrollWidth / 2;
        let currentDirection = direction;
        let velocity = 0;
        let lastPointer = 0;
        const speed = { multiplier: 1 };
        const measure = new ResizeObserver(() => { trackWidth = track.scrollWidth / 2; });
        measure.observe(track);
        const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: '200px' });
        visibility.observe(track);
        cleanup.push(() => { measure.disconnect(); visibility.disconnect(); gsap.killTweensOf(speed); });
        const render = () => { if (trackWidth) gsap.set(track, { x: ((state.x % trackWidth) + trackWidth) % trackWidth - trackWidth }); };
        const tick = () => {
          if (!dragging && visible && !reduced) {
            const frame = gsap.ticker.deltaRatio();
            state.x += ((!hovered ? currentDirection * trackWidth / duration / 60 * speed.multiplier : 0) + velocity) * frame;
            velocity *= Math.pow(.92, frame);
            render();
          }
        };
        listen(window, 'wheel', ((event: WheelEvent) => {
          if (!visible || !event.deltaY) return;
          currentDirection = event.deltaY > 0 ? direction : -direction;
          speed.multiplier = Math.min(4.5, 1 + Math.abs(event.deltaY) * .015);
          gsap.to(speed, { multiplier: 1, duration: .8, delay: .1, overwrite: true, ease: 'power2.out' });
        }) as EventListener, { passive: true });
        gsap.ticker.add(tick);
        cleanup.push(() => gsap.ticker.remove(tick));
        if (!draggable) return;
        track.style.touchAction = 'pan-y';
        track.style.cursor = 'grab';
        listen(track, 'pointerenter', () => { hovered = true; });
        listen(track, 'pointerleave', () => { hovered = false; });
        listen(track, 'pointerdown', ((event: PointerEvent) => { if (event.button !== 0) return; dragging = true; dragged = false; velocity = 0; start = lastPointer = event.clientX; base = state.x; track.style.cursor = 'grabbing'; }) as EventListener);
        listen(window, 'pointermove', ((event: PointerEvent) => { if (!dragging) return; const delta = event.clientX - start; if (Math.abs(delta) > 5) dragged = true; velocity = (event.clientX - lastPointer) * .6; lastPointer = event.clientX; if (Math.abs(velocity) > 2) currentDirection = Math.sign(velocity); state.x = base + delta * .6; render(); }) as EventListener);
        listen(window, 'pointerup', () => { dragging = false; track.style.cursor = 'grab'; });
        listen(window, 'pointercancel', () => { dragging = false; velocity = 0; track.style.cursor = 'grab'; });
        listen(track, 'dragstart', event => event.preventDefault());
        listen(track, 'click', event => { if (dragged) { event.preventDefault(); event.stopPropagation(); dragged = false; } }, { capture: true });
      };
      const products = $<HTMLElement>('[data-component="products-carousel-infinite"] .carousel-inner');
      if (products) loopStrip(products, products.scrollWidth * 25 / (innerWidth * 2.5), -1, true);
      const upper = $<HTMLElement>('[data-component="ddd"] .images-up .track');
      const lower = $<HTMLElement>('[data-component="ddd"] .images-down .track');
      if (upper) loopStrip(upper, 82, -1);
      if (lower) loopStrip(lower, 66, 1);

      $$<HTMLElement>('[data-component="coffee-journal"] [data-component="draggable-list"], [data-component="coffee-cycle"] .center-container').forEach(viewport => {
        const track = viewport.querySelector<HTMLElement>('.card-list, .inner');
        if (!track) return;
        let down = false, x = 0, offset = 0, moved = false;
        viewport.style.overflowX = 'auto';
        viewport.style.scrollbarWidth = 'none';
        viewport.style.cursor = 'grab';
        const scrollbar = viewport.querySelector<HTMLElement>('.scrollbar-container');
        const thumb = scrollbar?.querySelector<HTMLElement>('.scroll-thumb');
        const rail = scrollbar?.querySelector<HTMLElement>('.custom-scrollbar');
        const syncScrollbar = () => {
          const overflow = track.scrollWidth - viewport.clientWidth;
          if (scrollbar) scrollbar.style.display = overflow > 1 ? '' : 'none';
          if (thumb && rail) {
            const width = Math.max(24, rail.clientWidth * viewport.clientWidth / Math.max(track.scrollWidth, 1));
            thumb.style.width = `${width}px`;
            thumb.style.transform = `translateX(${overflow > 0 ? viewport.scrollLeft / overflow * (rail.clientWidth - width) : 0}px)`;
          }
        };
        const sizes = new ResizeObserver(syncScrollbar);
        sizes.observe(viewport);
        sizes.observe(track);
        cleanup.push(() => sizes.disconnect());
        listen(viewport, 'scroll', syncScrollbar, { passive: true });
        syncScrollbar();
        listen(viewport, 'pointerdown', ((event: PointerEvent) => { down = true; moved = false; x = event.clientX; offset = viewport.scrollLeft; }) as EventListener);
        listen(window, 'pointermove', ((event: PointerEvent) => { if (!down) return; moved ||= Math.abs(event.clientX - x) > 5; viewport.scrollLeft = offset - event.clientX + x; }) as EventListener);
        listen(window, 'pointerup', () => { down = false; });
        listen(window, 'pointercancel', () => { down = false; });
        listen(viewport, 'click', event => { if (moved) { event.preventDefault(); event.stopPropagation(); moved = false; } }, { capture: true });
        listen(viewport, 'dragstart', event => event.preventDefault());
      });

      const quiz = $<HTMLElement>('[data-component="quiz-wrapper"]');
      if (quiz) cleanup.push(animateCoffeeOrbits(quiz, reduced));
    }, el);

    cleanup.push(initializeHomeExtras(el, reduced));

    let disposed = false;
    const riveInstances: { cleanup(): void; resizeDrawingSurfaceToCanvas(): void }[] = [];
    import('@rive-app/canvas').then(({ Rive, Layout, Fit, Alignment, RuntimeLoader }) => {
      if (disposed) return;
      RuntimeLoader.setWasmUrl('/rive.wasm');
      $$<HTMLCanvasElement>('canvas[data-file]').forEach(canvas => {
        const src = canvas.dataset.file;
        if (!src) return;
        const rive = new Rive({ src: localAssetUrl(src), canvas, autoplay: false, autoBind: true, isTouchScrollEnabled: canvas.closest('[data-component="coffee-cycle"]') !== null, stateMachine: 'State Machine 1', layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }), onLoad: () => rive.resizeDrawingSurfaceToCanvas() });
        riveInstances.push(rive);
        const section = canvas.closest('section') ?? canvas;
        const observer = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) rive.play(); else rive.pause();
        }, { rootMargin: '120px' });
        observer.observe(section);
        cleanup.push(() => observer.disconnect());
      });
    }).catch(() => {});
    const cycleResize = () => {
      const animation = $<HTMLElement>('[data-component="coffee-cycle"] .animation');
      const center = $<HTMLElement>('[data-component="coffee-cycle"] .center-container');
      if (animation && center) center.style.setProperty('--max-width', `${animation.getBoundingClientRect().width}px`);
      riveInstances.forEach(rive => rive.resizeDrawingSurfaceToCanvas());
    };
    cycleResize();
    listen(window, 'resize', cycleResize);
    const refresh = window.setTimeout(() => { cycleResize(); ScrollTrigger.refresh(); }, 1000);
    return () => {
      disposed = true;
      clearTimeout(refresh);
      cleanup.forEach(fn => fn());
      riveInstances.forEach(rive => rive.cleanup());
      context.revert();
    };
  }, []);
  return <div ref={root} style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: html }} />;
}
