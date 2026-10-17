import { gsap } from 'gsap';

/** The homepage's three independent, staggered twelve-second coffee orbits. */
export function animateCoffeeOrbits(quiz: HTMLElement, reduced: boolean) {
  if (reduced) return () => {};
  const expansion: gsap.core.Timeline[] = [];
  const rotation: gsap.core.Timeline[] = [];
  const wobble: gsap.core.Timeline[][] = [];
  let impulse = 0;
  let started = false;
  const hover = { speed: 0 };
  const rings = [...quiz.querySelectorAll<HTMLElement>('.inner-inner-ring,.inner-ring,.outer-ring')].reverse();
  // Query selector results follow DOM order: the outer ring is first in the markup.
  rings.forEach((ring, index) => {
    const blends = ring.querySelectorAll('.blend-container');
    const timeline = gsap.timeline({ repeat: -1, paused: true });
    timeline.fromTo(ring, { scale: .85 }, { scale: innerWidth <= 743 ? 2.5625 : 2.05, duration: 12, ease: 'none' }, 0);
    timeline.fromTo(blends, { y: '2.5vw' }, { y: '-7.5vw', duration: 12, ease: 'power1.in' }, 0);
    timeline.fromTo(blends, { filter: 'blur(4px)', opacity: 0 }, { filter: 'blur(0px)', opacity: 1, duration: 2, ease: 'power1.in' }, 0);
    timeline.progress(index * .33);
    expansion.push(timeline);
    const orbit = gsap.timeline({ repeat: -1, paused: true });
    orbit.to(ring, { rotate: -360, duration: 120, ease: 'none' }, 0);
    orbit.to(ring.querySelectorAll('.pack-wrap'), { rotate: 360, duration: 120, ease: 'none' }, 0);
    orbit.progress(index * .33);
    rotation.push(orbit);
    const packs = [...ring.querySelectorAll('.pack-container')].map((pack, packIndex) => {
      const sign = index === 1 ? -1 : 1;
      const sway = gsap.timeline({ repeat: -1, paused: true }).to(pack, { rotate: sign * 10, duration: 15, ease: 'none' }).to(pack, { rotate: 0, duration: 15, ease: 'none' }).to(pack, { rotate: -sign * 10, duration: 15, ease: 'none' }).to(pack, { rotate: 0, duration: 15, ease: 'none' });
      const phase = (packIndex * 360 / 14 + (index === 1 ? 90 : 0)) % 180 / 180;
      sway.progress(1 - (phase + index * .33) % 1);
      return sway;
    });
    wobble.push(packs);
  });
  const update = () => {
    if (!started) return;
    const delta = gsap.utils.clamp(-.0225, .0225, impulse * gsap.ticker.deltaRatio(120));
    expansion.forEach((timeline, index) => {
      timeline.progress(gsap.utils.wrap(0, 1, timeline.progress() + delta));
      const speed = 1 + (2 + hover.speed + delta * 1000) * (1 - timeline.progress()) ** 2;
      rotation[index].timeScale(speed);
      wobble[index].forEach(tween => tween.timeScale(speed));
    });
    impulse *= .93;
  };
  const wheel = (event: WheelEvent) => { impulse += event.deltaY / innerHeight * .0075; };
  const speedUp = () => {
    gsap.to(hover, { speed: 24, duration: .5, overwrite: true, onComplete: () => { gsap.to(hover, { speed: 0, duration: 1, delay: .66, overwrite: true }); } });
  };
  const button = quiz.querySelector('#start-button, a');
  const backdrop = quiz.querySelector('.bg-wrap');
  const entrance = gsap.timeline({ paused: true });
  entrance.fromTo(backdrop, { scale: .1 }, { scale: .92, duration: 3, ease: 'power2.out' }, 0);
  entrance.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 3.5, ease: 'power3.inOut' }, 0);
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting || started) return;
    started = true;
    [...expansion, ...rotation, ...wobble.flat(), entrance].forEach(tween => tween.play());
    observer.disconnect();
  }, { rootMargin: '200px' });
  observer.observe(quiz);
  button?.addEventListener('pointerenter', speedUp);
  window.addEventListener('wheel', wheel, { passive: true });
  gsap.ticker.add(update);
  return () => {
    gsap.ticker.remove(update);
    observer.disconnect();
    window.removeEventListener('wheel', wheel);
    button?.removeEventListener('pointerenter', speedUp);
    gsap.killTweensOf(hover);
    [...expansion, ...rotation, ...wobble.flat(), entrance].forEach(tween => tween.kill());
  };
}

