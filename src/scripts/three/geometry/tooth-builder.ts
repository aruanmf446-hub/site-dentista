/**
 * Gera o dente 3D a partir dos perfis do design.
 *
 * Técnica: cada perfil 2D (P, D, Q) vira um campo de distância suavizado;
 * o volume é "inflado" em profundidade (z) com espessura variável por
 * altura — coroa larga e abaulada, raízes achatadas e afiladas. As camadas
 * são combinadas por CSG e poligonizadas com Surface Nets:
 *
 *   casca   = P                         (dente inteiro, malha única: sem costura)
 *   esmalte = P ∩ coroa − D
 *   núcleo  = (D ∩ coroa) ∪ (P ∩ raiz) − Q      (dentina + raiz)
 *   polpa   = Q
 *
 * O corte longitudinal remove o quadrante frontal-direito (x > 0, z > 0):
 * por construção, a face de corte em z = 0 reproduz exatamente os perfis
 * do storyboard (quadros B e C). Cada vértice é classificado pelo termo
 * CSG ativo, que define normal (gradiente) e cor (gradientes do design).
 *
 * Arquivo puro (sem Three.js): roda dentro de um Web Worker.
 */
import { buildField, sampleField, type Field2D } from './field2d';
import { surfaceNets, makeGrid, fillGrid, mapGrid, type Grid, type RawMesh } from './surface-nets';
import { PATHS, K, pathToPolyline, toSvgU, toSvgV, toWorldX, toWorldY } from './svg-paths';

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  /** grupos de material: [início, quantidade, índiceDoMaterial] */
  groups?: [number, number, number][];
}

export interface ToothData {
  whole: { shell: MeshData; enamel: MeshData; core: MeshData };
  cut: { enamel: MeshData; core: MeshData; pulp: MeshData };
  quarter: { enamel: MeshData; core: MeshData; pulp: MeshData };
  crowns: { premolar: MeshData; canine: MeshData; incisor: MeshData };
  meta: {
    top: number;
    bottom: number;
    cervicalY: number;
    crownWidth: number;
    anchors: Record<string, [number, number, number]>;
    ms: number;
  };
}

type Vec3 = [number, number, number];
type Fn = (x: number, y: number, z: number) => number;

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function hex(h: string): Vec3 {
  const n = parseInt(h.slice(1), 16);
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)];
}
function mixc(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
function grad3(stops: [number, Vec3][], t: number): Vec3 {
  if (t <= stops[0]![0]) return stops[0]![1];
  for (let i = 1; i < stops.length; i++) {
    const [p1, c1] = stops[i]!;
    const [p0, c0] = stops[i - 1]!;
    if (t <= p1) return mixc(c0, c1, (t - p0) / (p1 - p0));
  }
  return stops[stops.length - 1]![1];
}

// Paleta do storyboard (gradientes gEn, gDen, gRoot, gFace, gPulp).
const C = {
  enamelTop: hex('#FFFFFF'),
  enamel: hex('#F4EEEB'),
  enamelNeck: hex('#E2D5CE'),
  enamelInner: hex('#E6D3BD'),
  enamelFaceA: hex('#FFFFFF'),
  enamelFaceB: hex('#E7E0DA'),
  denTop: hex('#F4E8D8'),
  denBot: hex('#D9C0A2'),
  root0: hex('#EFE2CF'),
  root1: hex('#DCC6AA'),
  root2: hex('#BFA084'),
  faceA: hex('#F5EBDF'),
  faceB: hex('#DECAB1'),
  pulpWall: hex('#B8606E'),
  pulp0: hex('#F0A6AF'),
  pulp1: hex('#C45F6F'),
  pulp2: hex('#8E3346'),
  crownA: hex('#FFFFFF'),
  crownB: hex('#F1E9E5'),
  crownC: hex('#D9C9C4'),
};

/** Linha cervical (junção esmalte–cemento) em coordenadas SVG. */
export function cervicalV(u: number): number {
  const t = (u - 200) / 117;
  return 250 + (Math.abs(t) < 1 ? 13 * (1 - t * t) : 0);
}

interface Profile {
  /** meia-espessura em z */
  T: (v: number) => number;
  /** raio do arredondamento da borda */
  R: (v: number) => number;
  /** peso do abaulamento frontal */
  a: (v: number) => number;
  /** raio do abaulamento frontal (escala da largura local) */
  R2: (v: number) => number;
}

function inflate(f: Field2D, p: Profile, x: number, y: number, z: number): number {
  const u = toSvgU(x);
  const v = toSvgV(y);
  const d2 = sampleField(f, u, v) * K;
  const az = Math.abs(z);
  if (d2 >= 0) return Math.max(d2, az);
  // perfil = borda arredondada + abaulamento largo, ambos a partir da
  // distância à silhueta (contínuo, sem vincos na bifurcação das raízes)
  const prof = (t: number) => {
    const c = t > 1 ? 1 : t;
    return Math.sqrt(1 - (1 - c) * (1 - c));
  };
  const a = p.a(v);
  const zmax = p.T(v) * ((1 - a) * prof(-d2 / p.R(v)) + a * prof(-d2 / p.R2(v)));
  return az - zmax;
}

const outerProfile: Profile = {
  T: (v) => {
    const crown = 0.205 + 0.07 * Math.exp(-(((v - 170) / 80) ** 2));
    const root = lerp(0.18, 0.07, clamp01((v - 262) / 228));
    return lerp(crown, root, smooth(235, 285, v));
  },
  R: (v) => lerp(0.13, 0.075, smooth(235, 285, v)),
  a: (v) => lerp(0.35, 0.2, smooth(235, 285, v)),
  R2: (v) => lerp(0.3, 0.1, smooth(235, 285, v)),
};
const dentinProfile: Profile = {
  T: (v) => outerProfile.T(v) * 0.84,
  R: (v) => outerProfile.R(v) * 0.85,
  a: outerProfile.a,
  R2: (v) => outerProfile.R2(v) * 0.85,
};
const pulpProfile: Profile = {
  T: (v) => lerp(0.08, lerp(0.034, 0.02, clamp01((v - 300) / 140)), smooth(250, 295, v)),
  R: (v) => lerp(0.05, 0.016, smooth(250, 295, v)),
  a: () => 0.1,
  R2: (v) => lerp(0.1, 0.02, smooth(250, 295, v)),
};

interface Surface {
  f: Fn;
  /** +1: normal = ∇f; −1: normal = −∇f */
  s: 1 | -1;
  color: (x: number, y: number, z: number) => Vec3;
  /** plano de corte: fixa a coordenada em 0 e usa normal constante */
  plane?: 'x' | 'z';
}

/** Calcula normais (gradiente da superfície ativa) e cores por vértice. */
function finalize(
  raw: RawMesh,
  surfaces: Surface[],
  classify: (x: number, y: number, z: number) => number,
  /** alinha ao plano de corte os vértices da borda (evita serrilhado) */
  snap = 0,
  /** sólido completo (CSG): o contorno da face de corte é levado a solid = 0 */
  solid?: Fn,
  /** peça do corte: 1 = dente sem o quadrante x>0,z>0; −1 = o quadrante */
  piece: 1 | -1 = 1,
): MeshData {
  const n = raw.positions.length / 3;
  const normals = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const planar = new Uint8Array(n);
  const P = raw.positions;
  const h = 0.004;
  if (snap > 0) {
    for (let i = 0; i < n; i++) {
      const x = P[3 * i]!,
        z = P[3 * i + 2]!;
      if (Math.abs(x) < snap && z > snap * 0.5) P[3 * i] = 0;
      if (Math.abs(z) < snap && x > snap * 0.5) P[3 * i + 2] = 0;
    }
    if (solid) {
      projectCutSurface(P, solid, snap, piece);
      projectCutOutline(P, raw.indices, solid, snap);
    }
  }
  for (let i = 0; i < n; i++) {
    let x = P[3 * i]!,
      y = P[3 * i + 1]!,
      z = P[3 * i + 2]!;
    const s = surfaces[classify(x, y, z)] ?? surfaces[0]!;
    let nx: number, ny: number, nz: number;
    if (s.plane) {
      if (s.plane === 'x') x = 0;
      else z = 0;
      P[3 * i] = x;
      P[3 * i + 2] = z;
      nx = s.plane === 'x' ? s.s : 0;
      ny = 0;
      nz = s.plane === 'z' ? s.s : 0;
    } else {
      nx = (s.f(x + h, y, z) - s.f(x - h, y, z)) * s.s;
      ny = (s.f(x, y + h, z) - s.f(x, y - h, z)) * s.s;
      nz = (s.f(x, y, z + h) - s.f(x, y, z - h)) * s.s;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
    }
    normals[3 * i] = nx;
    normals[3 * i + 1] = ny;
    normals[3 * i + 2] = nz;
    const c = s.color(x, y, z);
    colors[3 * i] = c[0];
    colors[3 * i + 1] = c[1];
    colors[3 * i + 2] = c[2];
    if (s.plane) planar[i] = 1;
  }
  // média com as normais das faces: remove pontilhados em arestas/vincos
  const acc = new Float32Array(n * 3);
  const I = raw.indices;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t]!,
      b = I[t + 1]!,
      c = I[t + 2]!;
    const ax = P[3 * a]!,
      ay = P[3 * a + 1]!,
      az = P[3 * a + 2]!;
    const ux = P[3 * b]! - ax,
      uy = P[3 * b + 1]! - ay,
      uz = P[3 * b + 2]! - az;
    const vx = P[3 * c]! - ax,
      vy = P[3 * c + 1]! - ay,
      vz = P[3 * c + 2]! - az;
    const fx = uy * vz - uz * vy,
      fy = uz * vx - ux * vz,
      fz = ux * vy - uy * vx;
    for (const k of [a, b, c]) {
      acc[3 * k] += fx;
      acc[3 * k + 1] += fy;
      acc[3 * k + 2] += fz;
    }
  }
  for (let i = 0; i < n; i++) {
    if (planar[i]) continue;
    const l = Math.hypot(acc[3 * i]!, acc[3 * i + 1]!, acc[3 * i + 2]!) || 1;
    let x = normals[3 * i]! * 0.45 + (acc[3 * i]! / l) * 0.55;
    let y = normals[3 * i + 1]! * 0.45 + (acc[3 * i + 1]! / l) * 0.55;
    let z = normals[3 * i + 2]! * 0.45 + (acc[3 * i + 2]! / l) * 0.55;
    const m = Math.hypot(x, y, z) || 1;
    normals[3 * i] = x / m;
    normals[3 * i + 1] = y / m;
    normals[3 * i + 2] = z / m;
  }
  return { positions: P, normals, colors, indices: raw.indices };
}

/**
 * Peças cortadas: na aresta viva entre o plano de corte e a superfície curva a
 * grade "chanfra" os vértices (serrilhado). Os vértices da superfície curva vão
 * até solid = 0 em 3D e, se cruzarem o plano, ficam presos nele — a aresta
 * volta a ser viva e lisa.
 */
function projectCutSurface(P: Float32Array, solid: Fn, cell: number, piece: 1 | -1): void {
  const n = P.length / 3;
  const e = cell * 0.25;
  const maxMove = cell * 0.9;
  for (let i = 0; i < n; i++) {
    const x0 = P[3 * i]!,
      y0 = P[3 * i + 1]!,
      z0 = P[3 * i + 2]!;
    if (x0 === 0 || z0 === 0) continue; // já está num plano de corte
    // só a faixa junto à aresta do corte precisa (o resto já está na superfície)
    if (Math.min(Math.abs(x0), Math.abs(z0)) > cell * 2) continue;
    let x = x0,
      y = y0,
      z = z0;
    for (let k = 0; k < 2; k++) {
      const f = solid(x, y, z);
      const gx = (solid(x + e, y, z) - solid(x - e, y, z)) / (2 * e);
      const gy = (solid(x, y + e, z) - solid(x, y - e, z)) / (2 * e);
      const gz = (solid(x, y, z + e) - solid(x, y, z - e)) / (2 * e);
      const g2 = gx * gx + gy * gy + gz * gz;
      if (g2 < 1e-10) break;
      x -= (f * gx) / g2;
      y -= (f * gy) / g2;
      z -= (f * gz) / g2;
    }
    if (!(Math.hypot(x - x0, y - y0, z - z0) < maxMove)) continue;
    // mantém o vértice dentro da peça (prende ao plano que cruzou)
    if (piece === 1) {
      if (x > 0 && z > 0) {
        if (x < z) x = 0;
        else z = 0;
      }
    } else {
      if (x < 0) x = 0;
      if (z < 0) z = 0;
    }
    P[3 * i] = x;
    P[3 * i + 1] = y;
    P[3 * i + 2] = z;
  }
}

/**
 * Contorno das faces de corte: a malha sai de uma grade, então os vértices da
 * borda da face plana ficam "em degraus" (serrilhado visível ao ampliar). Cada
 * vértice no plano que toca a superfície curva é levado, dentro do próprio
 * plano, até o contorno exato do sólido (solid = 0) por passos de Newton.
 */
function projectCutOutline(P: Float32Array, I: Uint32Array, solid: Fn, cell: number): void {
  const n = P.length / 3;
  const onX = (i: number) => P[3 * i] === 0 && P[3 * i + 2]! > cell * 0.5;
  const onZ = (i: number) => P[3 * i + 2] === 0 && P[3 * i]! > cell * 0.5;
  const borda = new Uint8Array(n); // 1: borda no plano x; 2: no plano z
  for (let t = 0; t < I.length; t += 3) {
    const tri = [I[t]!, I[t + 1]!, I[t + 2]!];
    for (const plane of [1, 2] as const) {
      const on = plane === 1 ? onX : onZ;
      const dentro = tri.filter(on);
      if (dentro.length && dentro.length < 3) for (const v of dentro) borda[v] = plane;
    }
  }
  const e = cell * 0.25;
  const maxMove = cell * 1.2;
  for (let i = 0; i < n; i++) {
    const plane = borda[i];
    if (!plane) continue;
    const x0 = P[3 * i]!,
      y0 = P[3 * i + 1]!,
      z0 = P[3 * i + 2]!;
    // coordenadas no plano: (a, y) com a = z (plano x) ou a = x (plano z)
    const F = (a: number, y: number) => (plane === 1 ? solid(0, y, a) : solid(a, y, 0));
    let a = plane === 1 ? z0 : x0;
    let y = y0;
    for (let k = 0; k < 3; k++) {
      const f = F(a, y);
      const ga = (F(a + e, y) - F(a - e, y)) / (2 * e);
      const gy = (F(a, y + e) - F(a, y - e)) / (2 * e);
      const g2 = ga * ga + gy * gy;
      if (g2 < 1e-10) break;
      a -= (f * ga) / g2;
      y -= (f * gy) / g2;
    }
    const a0 = plane === 1 ? z0 : x0;
    const d = Math.hypot(a - a0, y - y0);
    if (!(d < maxMove) || a <= cell * 0.5) continue; // não converge ou cruzaria a aresta do corte
    P[3 * i + 1] = y;
    if (plane === 1) P[3 * i + 2] = a;
    else P[3 * i] = a;
  }
}

/** Separa os triângulos em dois grupos de material (coroa = 0, raiz = 1). */
function splitGroups(m: MeshData, isCrown: (x: number, y: number) => boolean): MeshData {
  const idx = m.indices;
  const a: number[] = [];
  const b: number[] = [];
  const P = m.positions;
  for (let t = 0; t < idx.length; t += 3) {
    const i0 = idx[t]!,
      i1 = idx[t + 1]!,
      i2 = idx[t + 2]!;
    const cx = (P[3 * i0]! + P[3 * i1]! + P[3 * i2]!) / 3;
    const cy = (P[3 * i0 + 1]! + P[3 * i1 + 1]! + P[3 * i2 + 1]!) / 3;
    (isCrown(cx, cy) ? a : b).push(i0, i1, i2);
  }
  return {
    ...m,
    indices: Uint32Array.from([...a, ...b]),
    groups: [
      [0, a.length, 0],
      [a.length, b.length, 1],
    ],
  };
}

export interface BuildOptions {
  /** tamanho da célula em unidades de mundo (menor = mais detalhe) */
  cell: number;
}

export function buildTooth(opts: BuildOptions): ToothData {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const step = opts.cell > 0.011 ? 2.5 : 2;
  const nu = Math.ceil(340 / step) + 1;
  const nv = Math.ceil(500 / step) + 1;
  const F = {
    P: buildField(pathToPolyline(PATHS.P), 30, 30, step, nu, nv, 2),
    D: buildField(pathToPolyline(PATHS.D), 30, 30, step, nu, nv, 2),
    Q: buildField(pathToPolyline(PATHS.Q), 30, 30, step, nu, nv, 0),
  };

  const fP: Fn = (x, y, z) => inflate(F.P, outerProfile, x, y, z);
  const fDraw: Fn = (x, y, z) => inflate(F.D, dentinProfile, x, y, z);
  /** perto do colo a dentina encosta na superfície (esmalte afina até a junção cervical) */
  const fD: Fn = (x, y, z) => {
    const v = toSvgV(y);
    const cv = cervicalV(toSvgU(x));
    const t = smooth(cv - 55, cv - 4, v);
    const d = fDraw(x, y, z);
    return t <= 0 ? d : lerp(d, fP(x, y, z) + 0.012, t);
  };
  const fQ: Fn = (x, y, z) => inflate(F.Q, pulpProfile, x, y, z);
  /** < 0 na coroa (acima da linha cervical) */
  const cs: Fn = (x, y) => (toSvgV(y) - cervicalV(toSvgU(x))) * K;
  const fEnamel: Fn = (x, y, z) => Math.max(fP(x, y, z), cs(x, y, z), -fD(x, y, z));
  const fCore: Fn = (x, y, z) => {
    const c = cs(x, y, z);
    return Math.max(Math.min(Math.max(fD(x, y, z), c), Math.max(fP(x, y, z), -c)), -fQ(x, y, z));
  };

  const h = opts.cell;
  const shellG = makeGrid([-0.38, -0.6, -0.32], [0.38, 0.57, 0.32], h);
  const enamelG = makeGrid([-0.38, -0.02, -0.32], [0.38, 0.57, 0.32], h);
  const coreG = makeGrid([-0.38, -0.6, -0.3], [0.38, 0.5, 0.3], h);
  const hp = h * 0.6;
  const pulpG = makeGrid([-0.15, -0.44, -0.12], [0.15, 0.33, 0.12], hp);
  fillGrid(shellG, fP);
  fillGrid(enamelG, fEnamel);
  fillGrid(coreG, fCore);
  fillGrid(pulpG, fQ);

  const cutMain = (g: Grid) => mapGrid(g, (v, x, _y, z) => Math.max(v, Math.min(x, z)));
  const cutQuarter = (g: Grid) => mapGrid(g, (v, x, _y, z) => Math.max(v, -x, -z));

  const vNorm = (y: number) => clamp01((toSvgV(y) - 60) / 440);
  const enamelOuterColor = (_x: number, y: number) =>
    grad3(
      [
        [70, C.enamelTop],
        [150, C.enamel],
        [262, C.enamelNeck],
      ],
      toSvgV(y),
    );
  const faceColor = (x: number, y: number) => mixc(C.faceA, C.faceB, clamp01(((toSvgU(x) - 200) / 140) * 0.5 + vNorm(y) * 0.6));
  const enamelFace = (x: number, y: number) => mixc(C.enamelFaceA, C.enamelFaceB, clamp01(((toSvgU(x) - 200) / 140) * 0.6 + vNorm(y)));
  const coreOuterColor = (_x: number, y: number) => {
    const v = toSvgV(y);
    if (v < 262) return mixc(C.denTop, C.denBot, clamp01((v - 90) / 175));
    return grad3(
      [
        [262, C.root0],
        [380, C.root1],
        [495, C.root2],
      ],
      v,
    );
  };
  const shellColor = (x: number, y: number, z: number) => {
    const t = smooth(-0.012, 0.012, cs(x, y, z));
    return mixc(enamelOuterColor(x, y), coreOuterColor(x, y), t);
  };
  const pulpColor = (_x: number, y: number) =>
    grad3(
      [
        [0, C.pulp0],
        [0.35, C.pulp1],
        [1, C.pulp2],
      ],
      clamp01((toSvgV(y) - 160) / 280),
    );
  const pulpFace = (x: number, y: number) => mixc(pulpColor(x, y), C.pulp0, 0.3);

  /* --- superfícies e classificadores (termo CSG ativo) --- */
  const planeX = (s: 1 | -1, color: Surface['color']): Surface => ({ f: (x) => x, s, plane: 'x', color });
  const planeZ = (s: 1 | -1, color: Surface['color']): Surface => ({ f: (_x, _y, z) => z, s, plane: 'z', color });
  /** 100 = plano x, 101 = plano z, −1 = nenhum (corte principal: mode 1; quadrante: mode −1) */
  const cutTerm = (mode: 1 | -1, x: number, z: number, F: number): number => {
    if (mode === 1) {
      if (Math.min(x, z) > F) return x < z ? 100 : 101;
    } else if (Math.max(-x, -z) > F) return -x > -z ? 100 : 101;
    return -1;
  };

  const enamelMesh = (g: Grid, mode: 0 | 1 | -1) => {
    const s: 1 | -1 = mode === -1 ? -1 : 1;
    const surfaces: Surface[] = [
      { f: fP, s: 1, color: enamelOuterColor },
      { f: fD, s: -1, color: () => C.enamelInner },
      { f: cs, s: 1, color: enamelFace },
      planeX(s, enamelFace),
      planeZ(s, enamelFace),
    ];
    return finalize(surfaceNets(g), surfaces, (x, y, z) => {
      const a = fP(x, y, z),
        b = cs(x, y, z),
        c = -fD(x, y, z);
      const Fv = Math.max(a, b, c);
      if (mode) {
        const k = cutTerm(mode, x, z, Fv);
        if (k === 100) return 3;
        if (k === 101) return 4;
      }
      return Fv === a ? 0 : Fv === c ? 1 : 2;
    }, mode ? g.h * 1.3 : 0, (x, y, z) => Math.max(fP(x, y, z), cs(x, y, z), -fD(x, y, z)), s);
  };

  const coreMesh = (g: Grid, mode: 0 | 1 | -1) => {
    const s: 1 | -1 = mode === -1 ? -1 : 1;
    const surfaces: Surface[] = [
      { f: fD, s: 1, color: coreOuterColor },
      { f: fP, s: 1, color: coreOuterColor },
      { f: cs, s: 1, color: coreOuterColor }, // base da dentina da coroa
      { f: cs, s: -1, color: coreOuterColor }, // topo da raiz (degrau cervical)
      { f: fQ, s: -1, color: () => C.pulpWall },
      planeX(s, faceColor),
      planeZ(s, faceColor),
    ];
    return finalize(surfaceNets(g), surfaces, (x, y, z) => {
      const c = cs(x, y, z);
      const d = fD(x, y, z),
        p = fP(x, y, z),
        q = -fQ(x, y, z);
      const A = Math.max(d, c);
      const B = Math.max(p, -c);
      const U = Math.min(A, B);
      const Fv = Math.max(U, q);
      if (mode) {
        const k = cutTerm(mode, x, z, Fv);
        if (k === 100) return 5;
        if (k === 101) return 6;
      }
      if (q >= U) return 4;
      if (A <= B) return d >= c ? 0 : 2;
      return p >= -c ? 1 : 3;
    }, mode ? g.h * 1.3 : 0, (x, y, z) => {
      const c = cs(x, y, z);
      return Math.max(Math.min(Math.max(fD(x, y, z), c), Math.max(fP(x, y, z), -c)), -fQ(x, y, z));
    }, s);
  };

  const pulpMesh = (g: Grid, mode: 0 | 1 | -1) => {
    const s: 1 | -1 = mode === -1 ? -1 : 1;
    const surfaces: Surface[] = [{ f: fQ, s: 1, color: pulpColor }, planeX(s, pulpFace), planeZ(s, pulpFace)];
    return finalize(surfaceNets(g), surfaces, (x, y, z) => {
      if (mode) {
        const k = cutTerm(mode, x, z, fQ(x, y, z));
        if (k === 100) return 1;
        if (k === 101) return 2;
      }
      return 0;
    }, mode ? g.h * 1.3 : 0, fQ, s);
  };

  const shell = splitGroups(
    finalize(surfaceNets(shellG), [{ f: fP, s: 1, color: shellColor }], () => 0),
    (x, y) => cs(x, y, 0) < 0,
  );

  const whole = { shell, enamel: enamelMesh(enamelG, 0), core: coreMesh(coreG, 0) };
  const cut = {
    enamel: enamelMesh(cutMain(enamelG), 1),
    core: coreMesh(cutMain(coreG), 1),
    pulp: pulpMesh(cutMain(pulpG), 1),
  };
  const quarter = {
    enamel: enamelMesh(cutQuarter(enamelG), -1),
    core: coreMesh(cutQuarter(coreG), -1),
    pulp: pulpMesh(cutQuarter(pulpG), -1),
  };

  const crowns = buildCrowns(Math.max(0.03, h * 3.2));

  const anchors: Record<string, [number, number, number]> = {
    esmalte: [toWorldX(318), toWorldY(152), 0],
    polpa: [toWorldX(222), toWorldY(214), 0],
    dentina: [toWorldX(279), toWorldY(300), 0],
    raiz: [toWorldX(262), toWorldY(420), 0],
  };
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    whole,
    cut,
    quarter,
    crowns,
    meta: {
      top: toWorldY(68),
      bottom: toWorldY(495),
      cervicalY: toWorldY(263),
      crownWidth: (330 - 70) * K,
      anchors,
      ms: Math.round(t1 - t0),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Coroas da arcada (pré-molar, canino, incisivo) por SDF de primitivas */
/* Unidades locais: largura mesiodistal ≈ 1, altura em +y, base em y=0. */
/* ------------------------------------------------------------------ */

function sdRoundBox(x: number, y: number, z: number, bx: number, by: number, bz: number, r: number): number {
  const qx = Math.abs(x) - bx + r,
    qy = Math.abs(y) - by + r,
    qz = Math.abs(z) - bz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
}
function sdSphere(x: number, y: number, z: number, cx: number, cy: number, cz: number, r: number): number {
  return Math.hypot(x - cx, y - cy, z - cz) - r;
}
function smin(a: number, b: number, k: number): number {
  const hh = clamp01(0.5 + (0.5 * (b - a)) / k);
  return lerp(b, a, hh) - k * hh * (1 - hh);
}
function sdCapsuleX(x: number, y: number, z: number, x0: number, x1: number, cy: number, cz: number, r: number) {
  const px = Math.min(Math.max(x, x0), x1);
  return Math.hypot(x - px, y - cy, z - cz) - r;
}

function crownMesh(fn: Fn, height: number, h: number): MeshData {
  const g = makeGrid([-0.62, -0.06, -0.6], [0.62, height + 0.15, 0.6], h);
  const solid: Fn = (x, y, z) => Math.max(fn(x, y, z), -y);
  fillGrid(g, solid);
  const color = (_x: number, y: number, z: number): Vec3 => {
    const c = grad3(
      [
        [0, C.crownC],
        [0.5, C.crownB],
        [1, C.crownA],
      ],
      clamp01(y / height),
    );
    return z < -0.2 ? mixc(c, C.crownB, 0.3) : c;
  };
  return finalize(
    surfaceNets(g),
    [
      { f: fn, s: 1, color },
      { f: (_x, y) => -y, s: 1, color: () => C.crownC },
    ],
    (x, y, z) => (fn(x, y, z) >= -y ? 0 : 1),
  );
}

function buildCrowns(h: number): ToothData['crowns'] {
  const premolar: Fn = (x, y, z) => {
    let d = sdRoundBox(x, y - 0.3, z, 0.46, 0.3, 0.48, 0.2);
    d = smin(d, sdSphere(x, y, z, 0, 0.56, 0.2, 0.25), 0.12);
    d = smin(d, sdSphere(x, y, z, 0, 0.52, -0.2, 0.23), 0.12);
    return Math.max(d, -sdCapsuleX(x, y, z, -0.3, 0.3, 0.76, 0, 0.05));
  };
  const canine: Fn = (x, y, z) => {
    let d = sdRoundBox(x, y - 0.34, z, 0.44, 0.34, 0.42, 0.24);
    d = smin(d, sdSphere(x, y, z, 0, 0.62, 0.04, 0.28), 0.14);
    return smin(d, sdSphere(x, y, z, 0, 0.84, 0.06, 0.13), 0.14);
  };
  const incisor: Fn = (x, y, z) => {
    const taper = 1 + 0.12 * (y - 0.4);
    const d = sdRoundBox(x / taper, y - 0.42, z + 0.03 * y, 0.48, 0.42, 0.18, 0.13);
    return smin(d, sdRoundBox(x, y - 0.18, z, 0.42, 0.18, 0.26, 0.16), 0.1);
  };
  return {
    premolar: crownMesh(premolar, 0.86, h),
    canine: crownMesh(canine, 1.0, h),
    incisor: crownMesh(incisor, 0.9, h),
  };
}
