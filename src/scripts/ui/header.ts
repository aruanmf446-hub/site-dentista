/**
 * Header (completo ↔ pílula), menu em diálogo, scrollspy do menu e do
 * índice de progresso, e detecção de superfície escura (vinho) para
 * inverter as cores dos elementos fixos.
 */
import { isCinema } from './data';

type Spy = { id: string; el: HTMLElement };

export function initHeader(): void {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return;
  const full = header.querySelector<HTMLElement>('[data-header-full]');
  const pill = header.querySelector<HTMLElement>('[data-header-pill]');
  const home = header.dataset.home === '1';

  let compact = false;
  const setCompact = (v: boolean) => {
    if (v === compact) return;
    compact = v;
    header.classList.toggle('is-compact', v);
    // só o estado visível fica acessível por teclado
    if (window.innerWidth >= 900) {
      pill?.toggleAttribute('inert', !v);
      full?.toggleAttribute('inert', v);
    }
  };
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 8);
    const threshold = home ? Math.min(window.innerHeight * 0.18, 160) : 80;
    setCompact(y > threshold);
  };
  const syncInert = () => {
    if (window.innerWidth < 900) {
      pill?.setAttribute('inert', '');
      full?.removeAttribute('inert');
    } else {
      pill?.toggleAttribute('inert', !compact);
      full?.toggleAttribute('inert', compact);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', syncInert);
  onScroll();
  syncInert();

  initMenu();
}

function initMenu(): void {
  const dlg = document.querySelector<HTMLDialogElement>('dialog[data-menu]');
  if (!dlg) return;
  let opener: HTMLElement | null = null;
  document.querySelectorAll<HTMLElement>('[data-menu-open]').forEach((btn) =>
    btn.addEventListener('click', () => {
      opener = btn;
      btn.setAttribute('aria-expanded', 'true');
      dlg.showModal();
    }),
  );
  dlg.querySelectorAll('[data-menu-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));
  dlg.addEventListener('close', () => {
    opener?.setAttribute('aria-expanded', 'false');
    opener?.focus();
  });
  dlg.querySelectorAll<HTMLAnchorElement>('[data-menu-link]').forEach((a) =>
    a.addEventListener('click', () => {
      opener = null;
      dlg.close();
    }),
  );
}

/** Marca o item de menu/capítulo correspondente à seção visível. */
export function initScrollSpy(): void {
  const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[data-nav]'));
  const chapterLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-progress] a[data-chapter]'));
  if (document.documentElement.dataset.page !== 'home') return;

  const ids = new Set(navLinks.map((a) => a.dataset.nav!));
  const sections: Spy[] = [];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) sections.push({ id, el });
  });
  const chapters = chapterLinks
    .map((a) => ({ a, el: document.querySelector<HTMLElement>(`[data-chapter-start="${a.dataset.chapter}"]`) ?? document.getElementById(a.dataset.anchor!) }))
    .filter((c): c is { a: HTMLAnchorElement; el: HTMLElement } => !!c.el);

  const update = () => {
    const probe = window.innerHeight * 0.42;
    let current: string | null = null;
    for (const s of sections) {
      const r = rectOf(s.el);
      if (r.top <= probe && r.bottom > probe) current = s.id;
    }
    navLinks.forEach((a) => {
      if (a.dataset.nav === current) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    let chapter: HTMLAnchorElement | null = chapters[0]?.a ?? null;
    for (const c of chapters) {
      if (rectOf(c.el).top <= probe) chapter = c.a;
    }
    chapterLinks.forEach((a) => {
      if (a === chapter) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };
  let raf = 0;
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(() => ((raf = 0), update()));
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
}

/**
 * No modo cinema, os painéis ficam dentro do palco fixo; a posição de cada
 * cena é dada pelos marcadores [data-cinema-marker]. Esta função devolve o
 * retângulo "lógico" de uma âncora.
 */
function rectOf(el: HTMLElement): { top: number; bottom: number } {
  if (isCinema()) {
    const id = el.dataset.anchorId || el.id;
    const marker = document.querySelector<HTMLElement>(`[data-cinema-marker="${id}"]`);
    if (marker) {
      const r = marker.getBoundingClientRect();
      return { top: r.top, bottom: r.top + marker.offsetHeight };
    }
  }
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom };
}

/** Inverte cores de elementos fixos quando estão sobre superfícies escuras. */
export function initSurfaceDetection(): void {
  const targets = [
    document.querySelector<HTMLElement>('[data-wa-float]'),
    document.querySelector<HTMLElement>('[data-progress]'),
    document.querySelector<HTMLElement>('[data-header]'),
  ].filter((x): x is HTMLElement => !!x);
  if (!targets.length) return;
  const check = () => {
    for (const t of targets) {
      const r = t === targets[2] ? { left: innerWidth / 2, top: 48, width: 0, height: 0 } : t.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const stack = document.elementsFromPoint(x, y);
      const dark = stack.some((el) => el !== t && !t.contains(el) && (el as HTMLElement).closest?.('[data-surface="dark"]'));
      const forced = document.documentElement.dataset.surface === 'dark';
      t.classList.toggle('on-dark', forced || dark);
    }
  };
  let raf = 0;
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(() => ((raf = 0), check()));
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  document.addEventListener('surfacechange', schedule);
  check();
}
