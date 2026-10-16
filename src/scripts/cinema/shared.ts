/**
 * Utilitários comuns aos dois modos (cinema e empilhado): cores do tema,
 * qualidade da geometria, carregamento do modelo e leitura dos presets.
 */
import { loadGlb, loadProcedural, type ToothAssets } from '../three/model-source';
import type { SpecPreset, StageColors } from '../three/stage';

export function readColors(): StageColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  return {
    bg: v('--c-bg', '#FCFAF8'),
    bgDark: v('--c-primary', '#5B1626'),
    primary: v('--c-primary', '#5B1626'),
    primaryDark: v('--c-primary-dark', '#320C15'),
    gum: v('--c-gum', '#E9C4C8'),
  };
}

/** Células da geometria: a primeira aparece rápido; a segunda refina (só em aparelhos fortes). */
export function qualityCells(mode: 'cinema' | 'stacked'): number[] {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory || 4;
  const fraco = cores <= 4 || mem <= 2;
  if (mode === 'stacked') return fraco ? [0.017] : [0.017, 0.0125];
  return fraco ? [0.016, 0.012] : [0.016, 0.0095];
}

export function loadAssets(mode: 'cinema' | 'stacked', onRefine: (a: ToothAssets) => void): Promise<ToothAssets> {
  const model = document.querySelector<HTMLElement>('[data-cinema]')?.dataset.model;
  const procedural = () => loadProcedural({ cells: qualityCells(mode), onRefine });
  if (model) {
    return loadGlb(model, () => loadProcedural({ cells: [0.016] })).catch((err) => {
      console.warn('[cena] GLB indisponível, usando geometria procedural:', err);
      return procedural();
    });
  }
  return procedural();
}

export function readPresets(): SpecPreset[] {
  const el = document.querySelector('[data-esp-presets]');
  try {
    return el ? (JSON.parse(el.textContent || '[]') as SpecPreset[]) : [];
  } catch {
    return [];
  }
}

export function dpr(max: number): number {
  return Math.min(window.devicePixelRatio || 1, max);
}
