/**
 * Deriva a paleta do template a partir da cor primária do cliente,
 * preservando as relações de contraste do design original (#5B1626).
 */
type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/** Mesmo cálculo do design: multiplica os canais (0.55 = vinho escuro). */
export function shade(hex: string, f: number): string {
  return rgbToHex(hexToRgb(hex).map((v) => v * f) as RGB);
}

export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => A[i]! + (B[i]! - A[i]!) * t) as RGB);
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Clareia `base` em direção ao branco até atingir o contraste mínimo sobre `bg`. */
function lightOn(bg: string, start: number, min: number): string {
  for (let t = start; t <= 1; t += 0.01) {
    const c = mix(bg, '#FFFFFF', t);
    if (contrast(c, bg) >= min) return c;
  }
  return '#FFFFFF';
}

export const NEUTRALS = {
  bg: '#FCFAF8',
  ink: '#1F1719',
  ink2: '#3E3437',
  text: '#5E5154',
  muted: '#6E6063',
  faint: '#776A6D',
  line: '#E6DCD9',
  lineStrong: '#D8CBC8',
  archLine: '#E2D4D1',
  surface: '#FFFFFF',
  placeholder: '#EFE6E3',
} as const;

export interface Theme {
  vars: Record<string, string>;
  warnings: string[];
}

export function buildTheme(primaria: string, secundaria?: string): Theme {
  const warnings: string[] = [];
  const onPrimary = '#FBF4F2';
  if (contrast(onPrimary, primaria) < 4.5) {
    warnings.push(
      `A cor primária ${primaria} tem contraste ${contrast(onPrimary, primaria).toFixed(2)}:1 com texto claro (mínimo 4,5:1). Escolha um tom mais escuro.`,
    );
  }
  if (contrast(primaria, NEUTRALS.bg) < 4.5) {
    warnings.push(`A cor primária ${primaria} não atinge 4,5:1 sobre o fundo ${NEUTRALS.bg}.`);
  }
  const surfaceAlt = secundaria ?? mix(NEUTRALS.bg, primaria, 0.06);
  const vars: Record<string, string> = {
    '--c-primary': primaria,
    '--c-primary-hover': shade(primaria, 0.68),
    '--c-primary-dark': shade(primaria, 0.55),
    '--c-primary-deeper': shade(primaria, 0.42),
    '--c-on-primary': onPrimary,
    '--c-on-primary-2': '#F7EDEA',
    '--c-on-primary-muted': lightOn(primaria, 0.72, 7),
    '--c-on-primary-soft': lightOn(primaria, 0.66, 6),
    '--c-on-primary-line': 'rgba(247, 237, 234, 0.24)',
    '--c-primary-tint': mix(NEUTRALS.bg, primaria, 0.1),
    '--c-gum': mix(primaria, '#FFFFFF', 0.78),
    '--c-surface-alt': surfaceAlt,
    '--c-surface-alt-line': mix(surfaceAlt, NEUTRALS.ink, 0.16),
  };
  return { vars, warnings };
}

export function themeToCss(theme: Theme): string {
  // html:root vence o :root de tokens.css independentemente da ordem no <head>
  return `html:root{${Object.entries(theme.vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')}}`;
}
