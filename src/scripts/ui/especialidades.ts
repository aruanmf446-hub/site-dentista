/**
 * Lista de especialidades: seleção por clique (todos os modos). No modo
 * cinema, o clique rola até o trecho da especialidade (cinema/cinema.ts
 * registra `especialidadesScrollTo`); a rolagem também muda a seleção.
 */
type Preset = { dentes: number[]; efeito: string };

export interface EspecialidadesApi {
  select(i: number, source?: 'click' | 'scroll' | 'init'): void;
  count: number;
  presets: Preset[];
}

let api: EspecialidadesApi | null = null;
export function especialidadesApi(): EspecialidadesApi | null {
  return api;
}

/** Ganchos registrados pela cena (3D ou cinema). */
export const espHooks: {
  scrollTo?: (i: number) => boolean;
  onSelect?: (i: number, source: string) => void;
} = {};

export function initEspecialidadesUI(): void {
  const root = document.querySelector<HTMLElement>('[data-especialidades]');
  if (!root) return;
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-spec-index]'));
  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-spec-detail]'));
  const arcade = root.querySelector<HTMLElement>('[data-arcade-css]');
  const teeth = arcade ? Array.from(arcade.querySelectorAll<HTMLElement>('[data-tooth]')) : [];
  const presets: Preset[] = JSON.parse(root.querySelector('[data-esp-presets]')?.textContent || '[]');
  let current = -1;

  const select = (i: number, source: 'click' | 'scroll' | 'init' = 'click') => {
    if (i === current || i < 0 || i >= buttons.length) return;
    current = i;
    buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
    cards.forEach((c, j) => {
      const on = i === j;
      c.hidden = !on;
      if (on && source !== 'init') {
        c.classList.remove('is-entering');
        void c.offsetWidth;
        c.classList.add('is-entering');
      }
    });
    const p = presets[i];
    if (arcade && p) {
      arcade.dataset.efeito = p.efeito;
      teeth.forEach((t, k) => t.classList.toggle('is-hi', p.dentes.includes(k)));
    }
    espHooks.onSelect?.(i, source);
  };

  buttons.forEach((b, i) =>
    b.addEventListener('click', () => {
      if (espHooks.scrollTo?.(i)) return; // modo cinema: a rolagem seleciona
      select(i, 'click');
    }),
  );
  api = { select, count: buttons.length, presets };
  select(0, 'init');
}
