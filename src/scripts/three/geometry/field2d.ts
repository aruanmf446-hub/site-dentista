/**
 * Campo de distância com sinal 2D (negativo dentro) de um polígono, em
 * grade regular, mais os intervalos "dentro" de cada linha — usados para
 * calcular a largura local da forma (curvatura frontal do volume).
 */
export interface Field2D {
  u0: number;
  v0: number;
  step: number;
  nu: number;
  nv: number;
  data: Float32Array;
  /** por linha: [a0, b0, a1, b1, ...] intervalos em u onde o ponto está dentro */
  rows: Float32Array[];
}

function rowIntervals(poly: Float64Array, v: number): Float32Array {
  const xs: number[] = [];
  const n = poly.length / 2;
  for (let k = 0; k < n; k++) {
    const ua = poly[2 * k]!,
      va = poly[2 * k + 1]!;
    const k2 = (k + 1) % n;
    const ub = poly[2 * k2]!,
      vb = poly[2 * k2 + 1]!;
    if (va <= v !== vb <= v) {
      xs.push(ua + ((v - va) / (vb - va)) * (ub - ua));
    }
  }
  xs.sort((a, b) => a - b);
  return Float32Array.from(xs.length % 2 === 0 ? xs : xs.slice(0, -1));
}

export function buildField(poly: Float64Array, u0: number, v0: number, step: number, nu: number, nv: number, blur = 2): Field2D {
  const data = new Float32Array(nu * nv);
  const rows: Float32Array[] = [];
  const n = poly.length / 2;
  for (let j = 0; j < nv; j++) {
    const v = v0 + j * step;
    const iv = rowIntervals(poly, v);
    rows.push(iv);
    for (let i = 0; i < nu; i++) {
      const u = u0 + i * step;
      let best = Infinity;
      for (let k = 0; k < n; k++) {
        const ax = poly[2 * k]!,
          ay = poly[2 * k + 1]!;
        const k2 = k + 1 === n ? 0 : k + 1;
        const bx = poly[2 * k2]!,
          by = poly[2 * k2 + 1]!;
        const dx = bx - ax,
          dy = by - ay;
        const len2 = dx * dx + dy * dy || 1;
        let t = ((u - ax) * dx + (v - ay) * dy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = ax + t * dx - u,
          py = ay + t * dy - v;
        const d2 = px * px + py * py;
        if (d2 < best) best = d2;
      }
      let inside = false;
      for (let m = 0; m < iv.length; m += 2) if (u >= iv[m]! && u <= iv[m + 1]!) inside = true;
      data[j * nu + i] = inside ? -Math.sqrt(best) : Math.sqrt(best);
    }
  }
  if (blur > 0) {
    blurField(data, nu, nv, blur);
    blurField(data, nu, nv, blur);
  }
  return { u0, v0, step, nu, nv, data, rows };
}

/**
 * Suaviza o campo (caixa (2r+1)²): remove o vinco do eixo medial, que
 * apareceria como uma "costura" no topo da coroa.
 */
function blurField(data: Float32Array, nu: number, nv: number, r: number): void {
  const tmp = new Float32Array(data.length);
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      let s = 0,
        c = 0;
      for (let k = -r; k <= r; k++) {
        const ii = Math.min(nu - 1, Math.max(0, i + k));
        s += data[j * nu + ii]!;
        c++;
      }
      tmp[j * nu + i] = s / c;
    }
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      let s = 0,
        c = 0;
      for (let k = -r; k <= r; k++) {
        const jj = Math.min(nv - 1, Math.max(0, j + k));
        s += tmp[jj * nu + i]!;
        c++;
      }
      data[j * nu + i] = s / c;
    }
}

/** Distância com sinal (unidades SVG), interpolação bilinear. */
export function sampleField(f: Field2D, u: number, v: number): number {
  const fx = (u - f.u0) / f.step;
  const fy = (v - f.v0) / f.step;
  if (fx < 0 || fy < 0 || fx >= f.nu - 1 || fy >= f.nv - 1) {
    // fora da grade: distância aproximada até a borda + margem
    const cu = Math.min(Math.max(u, f.u0), f.u0 + (f.nu - 1) * f.step);
    const cv = Math.min(Math.max(v, f.v0), f.v0 + (f.nv - 1) * f.step);
    return 40 + Math.hypot(u - cu, v - cv);
  }
  const i = fx | 0,
    j = fy | 0;
  const tx = fx - i,
    ty = fy - j;
  const d = f.data;
  const a = d[j * f.nu + i]!,
    b = d[j * f.nu + i + 1]!,
    c = d[(j + 1) * f.nu + i]!,
    e = d[(j + 1) * f.nu + i + 1]!;
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty;
}

/**
 * Mesma distância com interpolação bicúbica (Catmull-Rom): o gradiente fica
 * contínuo entre as células da grade. Usada nas normais — com a bilinear,
 * a normal "salta" a cada célula e o brilho rasante vira um pontilhado.
 */
export function sampleFieldSmooth(f: Field2D, u: number, v: number): number {
  const fx = (u - f.u0) / f.step;
  const fy = (v - f.v0) / f.step;
  if (fx < 1 || fy < 1 || fx >= f.nu - 2 || fy >= f.nv - 2) return sampleField(f, u, v);
  const i = fx | 0,
    j = fy | 0;
  const tx = fx - i,
    ty = fy - j;
  const d = f.data;
  const nu = f.nu;
  const cr = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  const row = (jj: number) => {
    const o = jj * nu + i;
    return cr(d[o - 1]!, d[o]!, d[o + 1]!, d[o + 2]!, tx);
  };
  return cr(row(j - 1), row(j), row(j + 1), row(j + 2), ty);
}

/** Posição relativa (−1..1) de u dentro do intervalo da linha mais próxima. */
export function localSpan(f: Field2D, u: number, v: number): number {
  let j = Math.round((v - f.v0) / f.step);
  if (j < 0) j = 0;
  if (j >= f.nv) j = f.nv - 1;
  const iv = f.rows[j]!;
  for (let m = 0; m < iv.length; m += 2) {
    const a = iv[m]!,
      b = iv[m + 1]!;
    if (u >= a - 1 && u <= b + 1) {
      const c = (a + b) / 2;
      const h = Math.max(1, (b - a) / 2);
      return Math.max(-1, Math.min(1, (u - c) / h));
    }
  }
  return 1;
}
