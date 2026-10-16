/**
 * Decide e inicia a experiência da home:
 * - cinema: html.is-cinema (definido antes da pintura no <head>), em qualquer
 *   largura; abaixo de 900 px com a composição compacta (html.cine-compact);
 * - empilhado: vistas 3D paradas nas seções (preferência por movimento reduzido);
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

/** Abaixo desta largura o cinema usa a composição compacta (celular/tablet). */
export const COMPACT_BELOW = 900;

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
    // Empilhado (movimento reduzido): o SVG do design já ocupa o lugar do
    // dente; as vistas 3D paradas começam na primeira interação (ou após
    // alguns segundos ociosos), sem disputar a thread com o carregamento.
    await whenEngaged(5000);
  }
  // teste barato antes de montar a sequência (evita mostrar o cinema e desmontar
  // logo depois); falhas posteriores do WebGL são tratadas dentro do cinema
  if (!('WebGLRenderingContext' in window) || !webglAvailable()) {
    console.warn('[cena] WebGL indisponível neste navegador — exibindo as ilustrações estáticas.');
    html.dataset.webglError = 'WebGL indisponível';
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
    // o cinema desmonta a si mesmo antes de chegar aqui; este é o último recurso
    console.error('[cena] experiência 3D indisponível — usando ilustrações estáticas.', err);
    html.dataset.webglError = String((err as Error)?.message ?? err).slice(0, 120);
    fallback();
  }
}
