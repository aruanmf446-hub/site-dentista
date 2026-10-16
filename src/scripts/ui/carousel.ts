/**
 * Carrossel de depoimentos: um por vez, anterior/próximo, contagem "1 / 3".
 * Sem rotação automática (WCAG 2.2.2). Sem JS, todos ficam listados.
 */
export function initCarousel(): void {
  document.querySelectorAll<HTMLElement>('[data-carousel]').forEach((root) => {
    const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-slide]'));
    const prev = root.querySelector<HTMLButtonElement>('[data-prev]');
    const next = root.querySelector<HTMLButtonElement>('[data-next]');
    const count = root.querySelector<HTMLElement>('[data-count]');
    const live = root.querySelector<HTMLElement>('[data-live]');
    if (slides.length < 2) return;
    root.classList.add('carousel-ready');
    let i = 0;
    const show = (n: number, announce = true) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, j) => {
        const on = j === i;
        s.hidden = !on;
        s.setAttribute('aria-hidden', String(!on));
        if (on) s.classList.remove('is-entering'), void s.offsetWidth, s.classList.add('is-entering');
      });
      const label = `${i + 1} / ${slides.length}`;
      if (count) count.textContent = label;
      if (live && announce) live.textContent = `Depoimento ${i + 1} de ${slides.length}`;
    };
    prev?.addEventListener('click', () => show(i - 1));
    next?.addEventListener('click', () => show(i + 1));
    show(0, false);
  });
}
