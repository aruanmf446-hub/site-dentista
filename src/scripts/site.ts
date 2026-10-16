/**
 * Entrada do JavaScript do site. Tudo que é essencial (menu, WhatsApp,
 * formulários) funciona sem as animações; GSAP e Three.js são carregados
 * sob demanda e nunca bloqueiam o conteúdo.
 */
import { initHeader, initScrollSpy, initSurfaceDetection } from './ui/header';
import { initDialogs } from './ui/dialogs';
import { initForms } from './ui/forms';
import { initTabs } from './ui/tabs';
import { initCarousel } from './ui/carousel';
import { initMobileBar } from './ui/mobile-bar';
import { initEspecialidadesUI } from './ui/especialidades';
import { prefersReducedMotion } from './ui/data';

function idle(cb: () => void, timeout = 1200): void {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(cb, { timeout });
  else window.setTimeout(cb, 200);
}

function boot(): void {
  initDialogs();
  initHeader();
  initScrollSpy();
  initSurfaceDetection();
  initMobileBar();
  initForms();
  initTabs();
  initCarousel();
  initEspecialidadesUI();

  const html = document.documentElement;
  const home = html.dataset.page === 'home';

  if (home) {
    // Cena 3D + scroll cinematográfico (ou modo empilhado com vistas 3D ancoradas).
    import('./cinema/boot').then((m) => m.bootExperience()).catch((err) => {
      console.error('[cena] falhou ao iniciar:', err);
      html.classList.remove('is-cinema');
      html.classList.add('no-webgl');
    });
  }

  if (!prefersReducedMotion() && html.classList.contains('motion')) {
    idle(() => {
      import('./motion/reveal')
        .then((m) => m.initReveals())
        .catch(() => html.classList.remove('motion'))
        .finally(() => html.classList.add('motion-ready'));
    }, 600);
  } else {
    html.classList.add('motion-ready');
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
