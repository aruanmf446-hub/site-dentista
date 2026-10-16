/**
 * Surface Nets (Gibson 1998): poligoniza um campo escalar amostrado em
 * grade (negativo = dentro). Gera malhas suaves e bem condicionadas, ideais
 * para volumes orgânicos como o dente.
 */
export interface Grid {
  nx: number;
  ny: number;
  nz: number;
  ox: number;
  oy: number;
  oz: number;
  h: number;
  data: Float32Array;
}

export interface RawMesh {
  positions: Float32Array;
  indices: Uint32Array;
}

export function makeGrid(min: [number, number, number], max: [number, number, number], h: number): Grid {
  const nx = Math.ceil((max[0] - min[0]) / h) + 1;
  const ny = Math.ceil((max[1] - min[1]) / h) + 1;
  const nz = Math.ceil((max[2] - min[2]) / h) + 1;
  return { nx, ny, nz, ox: min[0], oy: min[1], oz: min[2], h, data: new Float32Array(nx * ny * nz) };
}

export function fillGrid(g: Grid, fn: (x: number, y: number, z: number) => number): void {
  const { nx, ny, nz, ox, oy, oz, h, data } = g;
  let n = 0;
  for (let k = 0; k < nz; k++) {
    const z = oz + k * h;
    for (let j = 0; j < ny; j++) {
      const y = oy + j * h;
      for (let i = 0; i < nx; i++) data[n++] = fn(ox + i * h, y, z);
    }
  }
  // fecha o volume nas bordas da grade
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        if (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) {
          const idx = i + nx * (j + ny * k);
          if (data[idx]! < 0) data[idx] = 1e-3;
        }
      }
}

/** Deriva uma grade combinando outra valor a valor (CSG). */
export function mapGrid(src: Grid, fn: (v: number, x: number, y: number, z: number) => number): Grid {
  const out: Grid = { ...src, data: new Float32Array(src.data.length) };
  const { nx, ny, nz, ox, oy, oz, h } = src;
  let n = 0;
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++, n++) {
        let v = fn(src.data[n]!, ox + i * h, oy + j * h, oz + k * h);
        if ((i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) && v < 0) v = 1e-3;
        out.data[n] = v;
      }
  return out;
}

const CORNERS = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1],
] as const;
const EDGES = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [0, 2],
  [1, 3],
  [4, 6],
  [5, 7],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
] as const;

export function surfaceNets(g: Grid): RawMesh {
  const { nx, ny, nz, ox, oy, oz, h, data } = g;
  const cx = nx - 1,
    cy = ny - 1,
    cz = nz - 1;
  const cellVert = new Int32Array(cx * cy * cz).fill(-1);
  const pos: number[] = [];
  const at = (i: number, j: number, k: number) => data[i + nx * (j + ny * k)]!;
  const vals = new Float64Array(8);

  for (let k = 0; k < cz; k++)
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const o = CORNERS[c]!;
          const v = at(i + o[0], j + o[1], k + o[2]);
          vals[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0,
          sy = 0,
          sz = 0,
          cnt = 0;
        for (const [a, b] of EDGES) {
          const va = vals[a]!,
            vb = vals[b]!;
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          const A = CORNERS[a]!,
            B = CORNERS[b]!;
          sx += A[0] + t * (B[0] - A[0]);
          sy += A[1] + t * (B[1] - A[1]);
          sz += A[2] + t * (B[2] - A[2]);
          cnt++;
        }
        cellVert[i + cx * (j + cy * k)] = pos.length / 3;
        pos.push(ox + (i + sx / cnt) * h, oy + (j + sy / cnt) * h, oz + (k + sz / cnt) * h);
      }

  const idx: number[] = [];
  const cell = (i: number, j: number, k: number) => cellVert[i + cx * (j + cy * k)]!;
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c);
    else idx.push(a, b, c, a, c, d);
  };
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const v0 = at(i, j, k);
        const in0 = v0 < 0;
        // aresta em x
        if (i < cx && j > 0 && k > 0 && j < cy && k < cz) {
          const v1 = at(i + 1, j, k);
          if (in0 !== v1 < 0) quad(cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k), !in0);
        }
        // aresta em y
        if (j < cy && i > 0 && k > 0 && i < cx && k < cz) {
          const v1 = at(i, j + 1, k);
          if (in0 !== v1 < 0) quad(cell(i - 1, j, k - 1), cell(i - 1, j, k), cell(i, j, k), cell(i, j, k - 1), !in0);
        }
        // aresta em z
        if (k < cz && i > 0 && j > 0 && i < cx && j < cy) {
          const v1 = at(i, j, k + 1);
          if (in0 !== v1 < 0) quad(cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k), !in0);
        }
      }
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(idx) };
}
