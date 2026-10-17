import gsap from "gsap";
import scoring from "@/data/quiz-scoring.json";
import { animateCoffeeOrbits } from "./homeMotion";

/** Local version of the reference's five-question, weighted-persona quiz. */
export function initializeQuiz(root: HTMLElement, navigate: (url: string) => void, reduced: boolean) {
  const quiz = root.querySelector<HTMLElement>('[data-component="quiz"][data-v-972013ad]');
  if (!quiz) return () => {};
  const wrapper = quiz.querySelector<HTMLElement>('[data-component="quiz-wrapper"]')!;
  const screens = [...quiz.querySelectorAll<HTMLElement>('[data-component="intro"], [data-component="question"]')];
  const progress = quiz.querySelector<HTMLElement>('[data-component="quiz-progress"]');
  const selections: (number | undefined)[] = Array(5).fill(undefined);
  const cleanup: (() => void)[] = [animateCoffeeOrbits(wrapper, reduced)];
  let current = 0;
  const listen = (el: EventTarget, event: string, fn: EventListener) => {
    el.addEventListener(event, fn); cleanup.push(() => el.removeEventListener(event, fn));
  };
  const setButtons = (screen: HTMLElement, selected: boolean) => {
    screen.querySelectorAll<HTMLButtonElement>(".progress-btn, .win-btn").forEach(button => {
      button.disabled = !selected;
      button.dataset.active = String(selected);
      gsap.to(button, { autoAlpha: selected ? 1 : 0, scale: selected ? 1 : .985, duration: reduced ? 0 : .4, pointerEvents: selected ? "auto" : "none" });
    });
  };
  const show = (step: number) => {
    current = Math.max(0, Math.min(5, step));
    screens.forEach((screen, index) => {
      const active = index === current;
      screen.hidden = !active;
      screen.style.display = active ? "flex" : "none";
      screen.setAttribute("aria-hidden", String(!active));
      screen.dataset.active = String(active);
      if (active) {
        gsap.fromTo(screen, { autoAlpha: 0, scale: .97, filter: "blur(2px)" }, { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: reduced ? 0 : .75, ease: "power2.out" });
        if (index > 0) setButtons(screen, selections[index - 1] !== undefined);
      }
    });
    if (progress) {
      progress.style.display = current > 0 ? "" : "none";
      progress.setAttribute("aria-hidden", String(current === 0));
      progress.querySelectorAll<SVGPathElement>("path.progress").forEach(path => {
        const segment = Number(path.classList[1]?.replace("-", ""));
        const length = path.getTotalLength();
        path.style.strokeDasharray = String(length);
        gsap.to(path, { strokeDashoffset: segment <= current ? 0 : length, duration: reduced ? 0 : .6 });
      });
      progress.querySelectorAll<HTMLElement>(".ticker .progress").forEach((item, index) => gsap.to(item, { scaleX: index < current ? 1 : 0, transformOrigin: "left", duration: .5 }));
    }
    wrapper.querySelectorAll(".outer-ring, .inner-ring, .inner-inner-ring").forEach(ring => ring.classList.toggle("active", current > 0));
  };
  screens.forEach((screen, index) => {
    if (index === 0) {
      const start = screen.querySelector("#start-button");
      if (start) listen(start, "click", () => show(1));
      return;
    }
    const cards = [...screen.querySelectorAll<HTMLElement>(".answer-card")];
    cards.forEach((card, choice) => {
      card.tabIndex = 0;
      card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", "false");
      const choose = () => {
        selections[index - 1] = selections[index - 1] === choice ? undefined : choice;
        cards.forEach((item, i) => {
          const selected = selections[index - 1] === i;
          item.toggleAttribute("data-selected", selected);
          item.setAttribute("aria-checked", String(selected));
          gsap.to(item, { scale: selected ? 1.04 : 1, yPercent: selected ? -2 : 0, duration: reduced ? 0 : .5, ease: "power2.out" });
          gsap.to(item.querySelector(".bg-hover"), { opacity: selected ? 1 : 0, duration: reduced ? 0 : .5 });
          const borders = item.querySelectorAll("rect");
          if (borders.length) gsap.to(borders, { strokeDasharray: selected ? "2 0" : "2 10", duration: .5 });
        });
        setButtons(screen, selections[index - 1] !== undefined);
      };
      listen(card, "click", choose);
      listen(card, "keydown", ((event: KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(); } }) as EventListener);
    });
    const next = screen.querySelector(".progress-btn");
    const back = screen.querySelector(".back-btn");
    const win = screen.querySelector(".win-btn");
    if (next) listen(next, "click", () => { if (selections[index - 1] !== undefined) show(index + 1); });
    if (back) listen(back, "click", () => show(index - 1));
    if (win) listen(win, "click", () => {
      if (selections.some(choice => choice === undefined)) return;
      const points: Record<string, number> = Object.fromEntries(scoring.personas.map(persona => [persona.title, 0]));
      scoring.questions.forEach((question, i) => question[selections[i]!].forEach(point => { points[point.persona] += point.points; }));
      const winner = scoring.personas.reduce((best, persona) => points[persona.title] > points[best.title] ? persona : best);
      navigate(`/en/quiz/${winner.slug}`);
    });
  });
  show(0);
  return () => { cleanup.forEach(fn => fn()); gsap.killTweensOf(screens); };
}
