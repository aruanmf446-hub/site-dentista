/**
 * Decide e inicia a experiência da home:
 * - cinema: html.is-cinema (definido antes da pintura no <head>);
 * - empilhado: vistas 3D ancoradas nas seções (mobile, movimento reduzido);
 * - sem WebGL: mantém os SVGs do design (fallback estático).
 */
import { webglAvailable } from './shared';

const BREAKPOINT = 900;

export async function bootExperience(): Promise<void> {
  const html = document.documentElement;
  if (!document.querySelector('[data-cinema]')) return;

  if (!webglAvailable()) {
    html.classList.remove('is-cinema');
    html.classList.add('no-webgl');
    html.dataset.experience = 'fallback';
    window.dispatchEvent(new Event('resize'));
    return;
  }

  const cinema = html.classList.contains('is-cinema');
  html.dataset.experience = cinema ? 'cinema' : 'stacked';
  if (cinema) {
    const { initCinema } = await import('./cinema');
    await initCinema();
  } else {
    const { initStacked } = await import('./stacked');
    await initStacked();
  }

  // Cruzou o ponto de quebra (ex.: tablet girado)? Recarrega no modo certo.
  const wide = window.innerWidth >= BREAKPOINT;
  let timer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const nowWide = window.innerWidth >= BREAKPOINT;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (nowWide !== wide && !reduced) window.location.reload();
    }, 300);
  });
}
