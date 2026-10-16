/**
 * Perfis do dente copiados do Claude Design (artboard Tratamentos).
 * Coordenadas SVG: 400 × 560, eixo v para baixo.
 *   P = contorno do dente inteiro
 *   E = coroa (esmalte), até a linha cervical
 *   D = dentina da coroa (P escalado 0,9 em torno de (200, 300))
 *   Q = câmara pulpar + canais
 */
export const PATHS = {
  P: 'M70 150 C60 90 110 60 150 80 C175 92 185 70 200 68 C215 70 225 92 250 80 C290 60 340 90 330 150 C325 200 320 240 312 270 C305 330 300 400 280 470 C272 495 245 495 240 465 C232 410 222 350 200 340 C178 350 168 410 160 465 C155 495 128 495 120 470 C100 400 95 330 88 270 C80 240 75 200 70 150 Z',
  E: 'M83 250 C76 210 72 180 70 150 C60 90 110 60 150 80 C175 92 185 70 200 68 C215 70 225 92 250 80 C290 60 340 90 330 150 C327 185 322 220 317 250 C280 268 120 268 83 250 Z',
  D: 'M83 165 C74 111 119 84 155 102 C177.5 112.8 186.5 93 200 91.2 C213.5 93 222.5 112.8 245 102 C281 84 326 111 317 165 C312.5 210 308 246 300.8 273 C294.5 327 290 390 272 453 C264.8 475.5 240.5 475.5 236 448.5 C228.8 399 219.8 345 200 336 C180.2 345 171.2 399 164 448.5 C159.5 475.5 135.2 475.5 128 453 C110 390 105.5 327 99.2 273 C92 246 87.5 210 83 165 Z',
  Q: 'M150 190 C148 165 158 150 165 160 C175 172 188 176 200 175 C212 176 225 172 235 160 C242 150 252 165 250 190 C255 225 245 250 238 262 C236 330 248 400 252 440 L246 442 C236 400 222 330 214 290 C205 284 195 284 186 290 C178 330 164 400 154 442 L148 440 C152 400 164 330 162 262 C155 250 145 225 150 190 Z',
} as const;

/** Escala SVG → mundo (1 unidade de mundo = 400 unidades SVG). */
export const K = 1 / 400;
export const U0 = 200;
export const V0 = 280;

export const toWorldX = (u: number) => (u - U0) * K;
export const toWorldY = (v: number) => (V0 - v) * K;
export const toSvgU = (x: number) => U0 + x / K;
export const toSvgV = (y: number) => V0 - y / K;

/** Converte um path (M, C, L, Z absolutos) em polilinha fechada [u0,v0,u1,v1,...]. */
export function pathToPolyline(d: string, segments = 22): Float64Array {
  const tokens = d.match(/[MCLZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const pts: number[] = [];
  let i = 0;
  let cmd = '';
  let cu = 0;
  let cv = 0;
  let su = 0;
  let sv = 0;
  const num = () => parseFloat(tokens[i++]!);
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (/[MCLZ]/i.test(t)) {
      cmd = t.toUpperCase();
      i++;
      if (cmd === 'Z') {
        cu = su;
        cv = sv;
        continue;
      }
    }
    if (cmd === 'M') {
      cu = num();
      cv = num();
      su = cu;
      sv = cv;
      pts.push(cu, cv);
      cmd = 'L';
    } else if (cmd === 'L') {
      cu = num();
      cv = num();
      pts.push(cu, cv);
    } else if (cmd === 'C') {
      const x1 = num(),
        y1 = num(),
        x2 = num(),
        y2 = num(),
        x = num(),
        y = num();
      for (let s = 1; s <= segments; s++) {
        const t2 = s / segments;
        const m = 1 - t2;
        pts.push(
          m * m * m * cu + 3 * m * m * t2 * x1 + 3 * m * t2 * t2 * x2 + t2 * t2 * t2 * x,
          m * m * m * cv + 3 * m * m * t2 * y1 + 3 * m * t2 * t2 * y2 + t2 * t2 * t2 * y,
        );
      }
      cu = x;
      cv = y;
    } else {
      i++;
    }
  }
  // remove ponto final duplicado
  const n = pts.length;
  if (n >= 4 && Math.abs(pts[0]! - pts[n - 2]!) < 1e-6 && Math.abs(pts[1]! - pts[n - 1]!) < 1e-6) pts.length = n - 2;
  return Float64Array.from(pts);
}
