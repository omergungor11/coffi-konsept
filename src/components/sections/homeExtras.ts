import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

type Point = { x: number; y: number };
type Segment = { start: number; span: number };
type Rope = {
  offsets: number[]; velocities: number[];
  startX: number; startY: number; startVx: number; startVy: number;
  hoverMix: number; driveTarget: number; driveResponse: number;
  windPhase: number; windSpeed: number; windAmplitude: number;
  wavePhase: number; waveCycles: number; waveAmplitude: number; waveSpeed: number;
};
type Photo = {
  item: HTMLElement; path: SVGPathElement | null; point: Point; rope: Rope;
  centerX: number; centerY: number; halfWidth: number; halfHeight: number;
  tilt: number; setX: (value: number) => void; setY: (value: number) => void;
};
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const random = (min: number, max: number) => min + Math.random() * (max - min);
const tiltFor = (index: number) => {
  const value = Math.sin((index + 1) * 12.9898) * 43758.5453;
  return ((value - Math.floor(value)) * 2 - 1) * 3;
};

// Geometry and wave constants are those of the published PhotosGrid module.
function ringAngles(count: number, segments: Segment[], radius = 0, sizes: number[] = [], spread = 0) {
  if (!count || !segments.length) return [];
  const span = segments.reduce((sum, segment) => sum + segment.span, 0);
  let offsets: number[];
  if (sizes.length && radius) {
    const halfWidths = sizes.map(size => clamp(size * .5 / radius, 0, span / (count * 2.4)));
    const gap = Math.max(0, (span - halfWidths.reduce((sum, size) => sum + size * 2, 0)) / count);
    let cursor = halfWidths[0] + gap * .5;
    offsets = halfWidths.map((size, index) => {
      const offset = cursor % span;
      cursor += size + gap + (halfWidths[index + 1] ?? 0);
      return offset;
    });
  } else offsets = Array.from({ length: count }, (_, index) => count === 1 ? span * .5 : (index + .5) * span / count * (1 - spread) + index * span / (count - 1) * spread);
  return offsets.map(offset => {
    let remaining = (span - offset) % span;
    for (const segment of segments) {
      if (remaining <= segment.span) return segment.start + remaining;
      remaining -= segment.span;
    }
    return 0;
  });
}

function photoPoints(count: number, mobile: boolean, sizes: number[]): Point[] {
  const tau = Math.PI * 2, margin = Math.PI / 45;
  const topStart = Math.PI * 4 / 3 - margin, topEnd = Math.PI * 5 / 3 + margin;
  const bottomStart = Math.PI / 4 - margin, bottomEnd = Math.PI * 3 / 4 + margin;
  const outerCount = mobile ? count : Math.min(6, count);
  const outerSegments = [{ start: bottomEnd, span: topStart - bottomEnd }, { start: topEnd, span: tau - topEnd }, { start: 0, span: bottomStart }];
  const innerSegments = [{ start: 0, span: topStart }, { start: topEnd, span: tau - topEnd }];
  const outerAngles = mobile
    ? [...ringAngles(Math.ceil(count / 2), [{ start: topEnd, span: tau - topEnd }, { start: 0, span: bottomStart }], 0, [], .8), ...ringAngles(Math.floor(count / 2), [{ start: bottomEnd, span: topStart - bottomEnd }], 0, [], .8)]
    : ringAngles(outerCount, outerSegments, 520 * 1.45, sizes.slice(0, outerCount));
  return [...outerAngles, ...ringAngles(Math.min(6, count - outerCount), innerSegments)].map((angle, index) => {
    const radius = 520 * (mobile ? .9 : index < outerCount ? 1.45 : .8);
    return { x: clamp(618 + Math.cos(angle) * radius, 0, 1236), y: clamp(520 + Math.sin(angle) * radius, 0, 1040) };
  });
}

function createRope(point: Point): Rope {
  return {
    offsets: Array.from({ length: 41 }, () => 0), velocities: Array.from({ length: 41 }, () => 0),
    startX: point.x, startY: point.y, startVx: 0, startVy: 0, hoverMix: 0, driveTarget: 0, driveResponse: 0,
    windPhase: random(0, Math.PI * 2), windSpeed: random(.6, .95), windAmplitude: random(5, 13),
    wavePhase: random(0, Math.PI * 2), waveCycles: random(1.8, 3.3), waveAmplitude: random(10, 19), waveSpeed: random(.16, .34),
  };
}

function stepRope(rope: Rope, dt: number) {
  const { offsets, velocities } = rope;
  const last = offsets.length - 1;
  offsets[0] += (rope.driveTarget - offsets[0]) * rope.driveResponse;
  for (let index = 1; index < last; index++) {
    const progress = index / last;
    const endDamping = progress > .72 ? (progress - .72) / .28 : 0;
    const tension = 640 * (offsets[index - 1] + offsets[index + 1] - 2 * offsets[index]);
    velocities[index] += (tension - (.55 + 4.8 * endDamping ** 2) * velocities[index]) * dt;
  }
  for (let index = 1; index < last; index++) offsets[index] += velocities[index] * dt;
  velocities[last] += (640 * (offsets[last - 1] - offsets[last]) - 120 * offsets[last] - 17.35 * velocities[last]) * dt;
  offsets[last] += velocities[last] * dt;
  if (Math.abs(offsets[last]) > 6) { offsets[last] = Math.sign(offsets[last]) * 6; velocities[last] *= .45; }
  velocities[0] = 0;
}

function drawRope(photo: Photo, time: number, anchor: Point) {
  if (!photo.path) return;
  const { rope } = photo;
  const dx = 618 - anchor.x, dy = 520 - anchor.y, length = Math.hypot(dx, dy) || 1;
  const phase = rope.wavePhase + time * rope.waveSpeed;
  const amplitude = rope.waveAmplitude * (1 + rope.hoverMix * .08);
  let d = `M ${anchor.x} ${anchor.y}`;
  for (let index = 1; index <= 40; index++) {
    const p = index / 40;
    const wave = Math.sin(Math.PI * p) * amplitude * (Math.sin(p * Math.PI * 2 * rope.waveCycles + phase) + .28 * Math.sin(p * Math.PI * 2 * (rope.waveCycles * .52 + .35) + phase * 1.41));
    const fade = Math.min(1, p / .16);
    const offset = (rope.offsets[index] + wave) * fade * fade * (3 - 2 * fade);
    d += ` L ${anchor.x + dx * p - dy / length * offset} ${anchor.y + dy * p + dx / length * offset}`;
  }
  photo.path.setAttribute('d', d);
}

function initializeHistory(photos: HTMLElement, reduced: boolean) {
  const list = photos.querySelector<HTMLElement>('.photos-list');
  const svg = photos.querySelector<SVGSVGElement>('.camera > svg');
  if (!list || !svg) return () => {};
  const items = [...list.children] as HTMLElement[];
  const cleanup: (() => void)[] = [];
  const listen = (target: EventTarget, type: string, fn: EventListener, options?: AddEventListenerOptions) => {
    target.addEventListener(type, fn, options);
    cleanup.push(() => target.removeEventListener(type, fn, options));
  };
  let entries: Photo[] = [], visible = false, hovered = -1, factor = 1, lastTime = 0;
  const pointer = { x: 0, y: 0, dx: 0, dy: 0, active: false };
  const popup = photos.querySelector<HTMLElement>('[data-component="popup"]');
  const popupArea = photos.querySelector<HTMLElement>('[data-component="popup-area"]');
  const content = popup?.querySelector<HTMLElement>('.content');
  const popupItems = [...popup?.querySelectorAll<HTMLElement>('.content > .item') ?? []];
  const popupSizes: { width: number; height: number }[] = [];
  const popupPosition = { x: 0, y: 0, rotation: 0 };
  let popupOpen = false, popupTrigger: HTMLElement | null = null, popupScroll = 0, popupOpenedAt = 0;
  const touch = matchMedia('(hover: none)').matches;
  const popupTimeline = gsap.timeline({ paused: true });
  const flag = photos.querySelector<HTMLElement>('[data-component="tag-flag"]');
  const flagTimeline = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
  if (flag && !reduced) {
    flagTimeline.fromTo(flag.querySelector('.flag-container'), { scale: .8, rotation: 45, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 1 }, 0);
    flagTimeline.fromTo(flag.querySelectorAll('.date,.right-col'), { x: -10, opacity: 0 }, { x: 0, opacity: 1, stagger: .1, duration: .75 }, .1);
  }
  if (popup) {
    popupTimeline.fromTo(popup, { visibility: 'hidden', scale: .8, rotation: 10 }, { visibility: 'visible', scale: 1, rotation: 0, duration: reduced ? 0 : .75, ease: 'power4.inOut' }, 0);
    popupTimeline.fromTo(popup.querySelector('.combined-bg'), { backdropFilter: 'blur(0px)' }, { backdropFilter: 'blur(10px)', duration: reduced ? 0 : .75, ease: 'power4.inOut' }, 0);
    popupTimeline.fromTo(popup.querySelector('.combined-color'), { opacity: 0 }, { opacity: .8, duration: reduced ? 0 : .75, ease: 'power4.inOut' }, 0);
    popupTimeline.fromTo(popup.querySelectorAll('.title,.subtitle,.description'), { autoAlpha: 0, scale: 1.1 }, { autoAlpha: 1, scale: 1, stagger: .02, duration: reduced ? 0 : .8, delay: reduced ? 0 : .1, ease: 'power4.inOut' }, 0);
    Object.assign(popup.style, { position: 'absolute', left: '0', top: '0' });
  }
  const measurePopup = () => {
    if (!content || !popupItems.length) return;
    content.style.setProperty('--content-width', '9999px');
    content.style.setProperty('--content-height', '9999px');
    popupSizes.splice(0);
    popupItems.forEach(item => {
      item.style.width = ''; item.style.height = '';
      const rect = item.getBoundingClientRect();
      popupSizes.push({ width: rect.width, height: rect.height });
      item.style.width = `${rect.width}px`; item.style.height = `${rect.height}px`;
    });
    content.style.setProperty('--content-width', `${popupSizes[0].width}px`);
    content.style.setProperty('--content-height', `${popupSizes[0].height}px`);
  };
  const hidePopup = () => {
    popupOpen = false; popupTrigger = null;
    if (touch || reduced) popupTimeline.pause().progress(0);
    else popupTimeline.timeScale(5).reverse();
  };
  const updatePopup = (immediate = false) => {
    if (!popup || !popupArea || !popupOpen) return;
    const rect = popupArea.getBoundingClientRect();
    const box = popupTrigger?.getBoundingClientRect();
    const x = touch && box ? box.left + box.width * .5 - rect.left - popup.offsetWidth * .5 : pointer.x - rect.left - popup.offsetWidth * .5;
    const y = touch && box ? box.top - rect.top - popup.offsetHeight - 16 : pointer.y - rect.top - popup.offsetHeight - 48;
    popupPosition.x += (x - popupPosition.x) * (immediate ? 1 : .2);
    popupPosition.y += (y - popupPosition.y) * (immediate ? 1 : .2);
    popupPosition.rotation += (clamp((popupPosition.x - x) * .5, -10, 10) - popupPosition.rotation) * .25;
    // Keep positioning on a wrapper so the source's reveal scale/rotation remains independent.
    popup.style.left = `${popupPosition.x}px`;
    popup.style.top = `${popupPosition.y}px`;
    if (!popupTimeline.isActive()) gsap.set(popup, { rotation: popupPosition.rotation });
  };
  items.forEach((item, index) => {
    const enter = (event: Event) => {
      const e = event as PointerEvent;
      hovered = index;
      const rect = item.getBoundingClientRect();
      const sign = e.clientX < rect.left + rect.width * .5 ? -1 : 1;
      gsap.to(item, { rotation: tiltFor(index) + sign * 6, duration: reduced ? 0 : .64, ease: 'power2.out', overwrite: true });
      const contentIndex = Number(item.dataset.popupContent);
      if (!item.hasAttribute('data-popup-content') || !popupSizes[contentIndex]) return;
      pointer.x = e.clientX || rect.left + rect.width * .5;
      pointer.y = e.clientY || rect.top;
      popupItems.forEach((entry, i) => entry.classList.toggle('active', i === contentIndex));
      content?.style.setProperty('--content-width', `${popupSizes[contentIndex].width}px`);
      content?.style.setProperty('--content-height', `${popupSizes[contentIndex].height}px`);
      popupOpen = true; popupTrigger = item; popupScroll = scrollY; popupOpenedAt = performance.now();
      updatePopup(true);
      popupTimeline.timeScale(1).play();
    };
    const leave = () => {
      if (hovered === index) hovered = -1;
      gsap.to(item, { rotation: tiltFor(index), duration: reduced ? 0 : .44, ease: 'power3.out', overwrite: true });
    };
    item.tabIndex = 0;
    listen(item, 'pointerenter', enter);
    listen(item, 'pointerleave', leave);
    listen(item, 'focus', enter);
    listen(item, 'blur', () => { leave(); hidePopup(); });
    if (touch) listen(item, 'click', enter);
  });
  listen(window, 'mousemove', ((event: MouseEvent) => {
    if (pointer.active) { pointer.dx += event.clientX - pointer.x; pointer.dy += event.clientY - pointer.y; }
    pointer.x = event.clientX; pointer.y = event.clientY;
    if (popupOpen && popupTrigger) {
      const rect = popupTrigger.getBoundingClientRect();
      if (event.clientX < rect.left - 42 || event.clientX > rect.right + 42 || event.clientY < rect.top - 42 || event.clientY > rect.bottom + 42) hidePopup();
    }
  }) as EventListener);
  listen(photos, 'mouseenter', () => { pointer.active = true; });
  listen(photos, 'mouseleave', () => { pointer.active = false; pointer.dx = pointer.dy = 0; hovered = -1; hidePopup(); });
  listen(window, 'click', event => { if (popupOpen && popupTrigger && !popupTrigger.contains(event.target as Node)) hidePopup(); });
  listen(window, 'scroll', () => { if (popupOpen && performance.now() - popupOpenedAt > 180 && Math.abs(scrollY - popupScroll) >= 50) hidePopup(); }, { passive: true });

  const render = (time: number, dt: number, pointerDx = 0, pointerDy = 0) => {
    const substeps = Math.max(1, Math.ceil(dt * 120));
    entries.forEach((entry, index) => {
      const { rope, point } = entry;
      const isHovered = pointer.active && index === hovered;
      rope.hoverMix += ((isHovered ? 1 : 0) - rope.hoverMix) * .12;
      if (isHovered) {
        rope.startVx += clamp(pointerDx, -18, 18) / factor * 3.8 * rope.hoverMix;
        rope.startVy += clamp(pointerDy, -18, 18) / factor * 3.8 * rope.hoverMix;
      }
      rope.startVx = clamp(rope.startVx, -42, 42);
      rope.startVy = clamp(rope.startVy, -42, 42);
      rope.startVx = (rope.startVx + (16 * (point.x - rope.startX) - 6.5 * rope.startVx) * dt) * .986;
      rope.startVy = (rope.startVy + (16 * (point.y - rope.startY) - 6.5 * rope.startVy) * dt) * .986;
      rope.startX += rope.startVx * dt; rope.startY += rope.startVy * dt;
      const dx = 618 - rope.startX, dy = 520 - rope.startY, length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length, ny = dx / length;
      const wind = (Math.sin(time * rope.windSpeed + rope.windPhase) + .55 * Math.sin(time * rope.windSpeed * .41 + rope.windPhase * 1.7)) * rope.windAmplitude;
      const drive = (rope.startX - point.x) * nx + (rope.startY - point.y) * ny + wind * (1 - rope.hoverMix);
      rope.driveTarget += (drive - rope.driveTarget) * (.08 + .12 * rope.hoverMix);
      rope.driveResponse += (.08 + .24 * rope.hoverMix - rope.driveResponse) * .16;
      if (!reduced) for (let step = 0; step < substeps; step++) stepRope(rope, dt / substeps);
      const anchor = { x: rope.startX + nx * rope.offsets[0], y: rope.startY + ny * rope.offsets[0] };
      entry.setX((anchor.x - point.x) * factor);
      entry.setY((anchor.y - point.y) * factor);
      drawRope(entry, reduced ? 0 : time, anchor);
    });
    updatePopup();
  };
  const layout = () => {
    const mobile = innerWidth <= 1023, count = mobile ? Math.min(6, items.length) : items.length;
    entries.forEach(entry => entry.path?.remove());
    entries = [];
    Object.assign(list.style, { inset: '0', width: '100%', height: '100%' });
    items.forEach((item, index) => {
      Object.assign(item.style, { display: index < count ? '' : 'none', scale: index >= 6 && !mobile ? '.7' : '1' });
      gsap.set(item, { x: 0, y: 0, xPercent: -50, yPercent: -50, rotation: tiltFor(index), transformOrigin: '50% 50%' });
    });
    const svgBox = svg.getBoundingClientRect(), listBox = list.getBoundingClientRect();
    if (!svgBox.width || !svgBox.height) return;
    factor = svgBox.width / 1236;
    const boxes = items.slice(0, count).map(item => item.getBoundingClientRect());
    const sizes = boxes.map(box => Math.max(box.width, box.height) / factor);
    const points = photoPoints(count, mobile, sizes);
    const innerPaths = new Set(points.map((point, index) => ({ ...point, index })).filter(point => point.index >= 6).sort((a, b) => b.y - a.y).slice(0, 2).map(point => point.index));
    items.slice(0, count).forEach((item, index) => {
      const point = points[index];
      const dx = 618 - point.x, dy = 520 - point.y, length = Math.hypot(dx, dy) || 1;
      const halfWidth = boxes[index].width / factor * .5, halfHeight = boxes[index].height / factor * .5;
      const edge = index < 6 ? 1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight) : 0;
      const centerX = point.x - dx * edge + (index < 6 ? dx / length * 20 : 0);
      const centerY = point.y - dy * edge + (index < 6 ? dy / length * 20 : 0);
      Object.assign(item.style, { position: 'absolute', left: `${svgBox.left - listBox.left + centerX * factor}px`, top: `${svgBox.top - listBox.top + centerY * factor}px` });
      let path: SVGPathElement | null = null;
      if (index < 6 || innerPaths.has(index)) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('data-v-f28896f2', '');
        path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(path);
      }
      entries.push({ item, path, point, rope: createRope(point), centerX, centerY, halfWidth, halfHeight, tilt: tiltFor(index), setX: gsap.quickSetter(item, 'x', 'px') as (value: number) => void, setY: gsap.quickSetter(item, 'y', 'px') as (value: number) => void });
    });
    measurePopup();
    photos.classList.add('active');
    render(0, 1 / 60);
  };
  const tick = (time: number) => {
    if (!visible) { lastTime = 0; return; }
    const dt = lastTime ? clamp(time - lastTime, 1 / 240, 1 / 15) : 1 / 60;
    lastTime = time;
    if (!reduced) render(time, dt, pointer.dx, pointer.dy);
    else updatePopup();
    pointer.dx = pointer.dy = 0;
  };
  const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: '180px 0px' });
  visibility.observe(photos);
  let frame = 0, resizeTimer = 0;
  const requestLayout = () => {
    cancelAnimationFrame(frame); clearTimeout(resizeTimer);
    frame = requestAnimationFrame(() => { resizeTimer = window.setTimeout(layout, 160); });
  };
  const sizes = new ResizeObserver(requestLayout);
  sizes.observe(svg);
  items.forEach(item => sizes.observe(item));
  listen(window, 'resize', requestLayout);
  gsap.ticker.add(tick);
  layout();
  return () => {
    cleanup.forEach(fn => fn()); sizes.disconnect(); visibility.disconnect();
    cancelAnimationFrame(frame); clearTimeout(resizeTimer);
    gsap.ticker.remove(tick); popupTimeline.kill(); flagTimeline.kill();
    entries.forEach(entry => { entry.path?.remove(); gsap.killTweensOf(entry.item); });
  };
}

/** Additional source-derived homepage behavior; replaces animateHistoryPhotos. */
export function initializeHomeExtras(root: HTMLElement, reduced: boolean): () => void {
  gsap.registerPlugin(ScrollTrigger);
  const cleanup: (() => void)[] = [];
  const photos = root.querySelector<HTMLElement>('[data-component="photos-grid"]');
  if (photos) cleanup.push(initializeHistory(photos, reduced));
  const cycle = root.querySelector<HTMLElement>('[data-component="coffee-cycle"]');
  const center = cycle?.querySelector<HTMLElement>('.center-container');
  const animation = cycle?.querySelector<HTMLElement>('.animation');
  if (cycle && center && animation) {
    const labels = [...cycle.querySelectorAll<HTMLElement>('.titles .item')];
    let entrance: gsap.core.Tween | null = null;
    let scroll: gsap.core.Tween | null = null;
    let entered = false;
    const measure = () => {
      const width = Math.round(animation.getBoundingClientRect().width);
      center.style.setProperty('--max-width', `${width}px`);
      const overflowing = width > cycle.getBoundingClientRect().width;
      if (!overflowing || reduced) { gsap.set(labels, { opacity: 1, y: 0 }); return; }
      if (entrance || entered) return;
      entrance = gsap.fromTo(labels, { opacity: 0, y: 10 }, {
        opacity: 1, y: 0, stagger: .5, duration: 2, ease: 'power4.out',
        scrollTrigger: { trigger: cycle, start: 'top center', once: true, onEnter: () => {
          entered = true;
          const target = Math.max(0, animation.getBoundingClientRect().width - cycle.getBoundingClientRect().width - innerWidth * .22);
          scroll = gsap.to(center, { scrollLeft: target, duration: 3, ease: 'power2.out' });
        } },
      });
    };
    const sizes = new ResizeObserver(measure);
    sizes.observe(animation); sizes.observe(cycle);
    measure();
    cleanup.push(() => { sizes.disconnect(); entrance?.scrollTrigger?.kill(); entrance?.kill(); scroll?.kill(); });
  }
  return () => cleanup.forEach(fn => fn());
}
