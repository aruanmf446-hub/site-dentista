/**
 * Decide e inicia a experiência da home:
 * - cinema: html.is-cinema (definido antes da pintura no <head>);
 * - empilhado: vistas 3D ancoradas nas seções (mobile, movimento reduzido);
 * - sem WebGL: mantém os SVGs do design (fallback estático).
 */

/** Testa WebGL sem importar Three.js (o 3D só é baixado se for usado). */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

const BREAKPOINT = 900;

function whenEngaged(timeout: number): Promise<void> {
  return new Promise((resolve) => {
    const events = ['pointerdown', 'touchstart', 'scroll', 'keydown', 'wheel'] as const;
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      events.forEach((e) => window.removeEventListener(e, go));
      resolve();
    };
    events.forEach((e) => window.addEventListener(e, go, { passive: true, once: true }));
    const start = () => window.setTimeout(go, timeout);
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
  });
}

export async function bootExperience(): Promise<void> {
  const html = document.documentElement;
  if (!document.querySelector('[data-cinema]')) return;

  const cinema = html.classList.contains('is-cinema');
  const fallback = () => {
    html.classList.remove('is-cinema');
    html.classList.add('no-webgl');
    html.dataset.experience = 'fallback';
    window.dispatchEvent(new Event('resize'));
  };
  if (!cinema) {
    // Mobile/empilhado: o SVG do design já ocupa o lugar do dente; o 3D
    // começa na primeira interação (ou após alguns segundos ociosos),
    // sem disputar a thread principal com o carregamento da página.
    await whenEngaged(5000);
  }
  // no cinema, a criação do próprio renderizador testa o WebGL (sem contexto extra)
  if (!('WebGLRenderingContext' in window) || (!cinema && !webglAvailable())) {
    fallback();
    return;
  }
  html.dataset.experience = cinema ? 'cinema' : 'stacked';
  try {
    if (cinema) {
      const { initCinema } = await import('./cinema');
      await initCinema();
    } else {
      const { initStacked } = await import('./stacked');
      await initStacked();
    }
  } catch (err) {
    console.warn('[cena] WebGL indisponível, usando ilustrações estáticas.', err);
    fallback();
    return;
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
