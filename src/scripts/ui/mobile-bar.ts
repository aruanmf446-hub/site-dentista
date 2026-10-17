/**
 * Barra fixa do mobile: "Agendar" vira "Ligar" quando o formulário está na tela.
 * Desktop: o WhatsApp flutuante sai de cena sobre o formulário (que já tem o
 * próprio botão de WhatsApp) para não cobrir o arco e os campos.
 */
export function initMobileBar(): void {
  const form = document.getElementById('agendamento');
  const float = document.querySelector<HTMLElement>('[data-wa-float]');
  if (form && float) {
    new IntersectionObserver(
      ([entry]) => {
        const over = !!entry?.isIntersecting;
        float.classList.toggle('is-away', over);
        if (over) float.setAttribute('tabindex', '-1');
        else float.removeAttribute('tabindex');
        float.toggleAttribute('aria-hidden', over);
      },
      { rootMargin: '-35% 0px -35% 0px' },
    ).observe(form);
  }
  const bar = document.querySelector<HTMLElement>('[data-mobile-bar]');
  const agendar = bar?.querySelector<HTMLElement>('[data-mbar-agendar]');
  const ligar = bar?.querySelector<HTMLElement>('[data-mbar-ligar]');
  if (!bar || !agendar || !ligar || !form) return;
  const io = new IntersectionObserver(
    ([entry]) => {
      const inView = !!entry?.isIntersecting;
      agendar.hidden = inView;
      ligar.hidden = !inView;
    },
    { rootMargin: '-30% 0px -30% 0px' },
  );
  io.observe(form);
}
