/** Barra fixa do mobile: "Agendar" vira "Ligar" quando o formulário está na tela. */
export function initMobileBar(): void {
  const bar = document.querySelector<HTMLElement>('[data-mobile-bar]');
  const agendar = bar?.querySelector<HTMLElement>('[data-mbar-agendar]');
  const ligar = bar?.querySelector<HTMLElement>('[data-mbar-ligar]');
  const form = document.getElementById('agendamento');
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
