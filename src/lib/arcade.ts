/**
 * Geometria e presets da arcada (14 dentes), compartilhados entre o
 * fallback em CSS 3D, a cena Three.js e o build.
 * Índices seguem o artboard Especialidades: 0 e 13 = molares das pontas,
 * 6 e 7 = incisivos centrais (no alto da curva).
 */
export const TOOTH_COUNT = 14;

export type TipoDente = 'molar' | 'pre-molar' | 'canino' | 'incisivo';

export const TIPOS: TipoDente[] = [
  'molar',
  'molar',
  'pre-molar',
  'pre-molar',
  'canino',
  'incisivo',
  'incisivo',
  'incisivo',
  'incisivo',
  'canino',
  'pre-molar',
  'pre-molar',
  'molar',
  'molar',
];

/** Larguras e proporções do design (px no artboard). */
export const LARGURAS = [74, 72, 58, 56, 50, 44, 54, 54, 44, 50, 56, 58, 72, 74];
export const PROPORCAO = [0.9, 0.9, 0.88, 0.88, 0.95, 0.72, 0.7, 0.7, 0.72, 0.95, 0.88, 0.88, 0.9, 0.9];

/** Ângulo (graus) de cada dente na elipse do design: −12° → 192°. */
export function anguloDente(i: number): number {
  return -12 + i * (204 / 13);
}

export const PRESETS: Record<string, number[]> = {
  todos: [...Array(TOOTH_COUNT).keys()],
  anteriores: [4, 5, 6, 7, 8, 9],
  posteriores: [0, 1, 2, 3, 10, 11, 12, 13],
  molares: [0, 1, 12, 13],
  'pre-molares': [2, 3, 10, 11],
  caninos: [4, 9],
  incisivos: [5, 6, 7, 8],
  nenhum: [],
};

export function dentesDestacados(dentes: string | number[]): number[] {
  if (Array.isArray(dentes)) return dentes.filter((n) => n >= 0 && n < TOOTH_COUNT);
  return PRESETS[dentes] ?? PRESETS.todos!;
}

/** Layout do fallback CSS (mesmas contas do artboard: elipse a=290, b=330). */
export function layoutCss() {
  const cx = 400,
    cy = 470,
    a = 290,
    b = 330;
  const dentes = LARGURAS.map((w, i) => {
    const deg = anguloDente(i);
    const th = (deg * Math.PI) / 180;
    const x = cx + a * Math.cos(th);
    const y = cy - b * Math.sin(th);
    const h = Math.round(w * PROPORCAO[i]!);
    return { x, y, w, h, rot: 90 - deg };
  });
  const pts: string[] = [];
  for (let s = 0; s <= 40; s++) {
    const th = ((-12 + s * (204 / 40)) * Math.PI) / 180;
    pts.push(`${(cx + a * Math.cos(th)).toFixed(1)} ${(cy - b * Math.sin(th)).toFixed(1)}`);
  }
  return { dentes, arco: 'M' + pts.join(' L') };
}
