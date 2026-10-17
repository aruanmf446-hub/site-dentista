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
import { buildField, sampleField, sampleFieldSmooth, type Field2D } from './field2d';
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
  whole: {
    shell: MeshData;
    enamel: MeshData;
    core: MeshData;
    /** superfície da dentina (grupo 0 = coroa, 1 = raiz): parede à vista com o esmalte erguido */
    dentin: MeshData;
    /** a mesma superfície vista por dentro do esmalte (cor do interior do esmalte) */
    enamelInner: MeshData;
  };
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

/** amostragem bicúbica (gradiente contínuo) ligada só durante o cálculo das normais */
let smoothSampling = false;

function inflate(f: Field2D, p: Profile, x: number, y: number, z: number): number {
  const u = toSvgU(x);
  const v = toSvgV(y);
  const d2 = (smoothSampling ? sampleFieldSmooth(f, u, v) : sampleField(f, u, v)) * K;
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
  /** peça do corte: 1 = dente sem o quadrante x>0,z>0; −1 = o quadrante; 0 = inteiro */
  piece: 1 | -1 | 0 = 1,
  /** tamanho da célula da grade (projeção dos vértices na superfície exata) */
  cell = 0,
  /**
   * Mistura as normais das faces (disfarça vincos de superfícies compostas).
   * Superfícies lisas e já projetadas usam só o gradiente: brilho sem pontilhado.
   */
  blendFaces = true,
  /** termos do CSG (com sinal): vértices em vincos vão à interseção exata */
  terms?: Fn[],
  /** função barata que delimita onde há vincos visíveis (|g| pequeno) */
  creaseGate?: Fn,
  /**
   * Superfícies (índices em `surfaces`) cujos triângulos são descartados: a
   * superfície externa das peças é desenhada pela casca lisa (Stage3D).
   */
  drop?: number[],
): MeshData {
  const n = raw.positions.length / 3;
  const normals = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const planar = new Uint8Array(n);
  const P = raw.positions;
  const h = 0.004;
  let P0: Float32Array | null = solid && snap === 0 ? P.slice() : null;
  if (snap === 0 && solid && cell > 0) projectCutSurface(P, solid, cell, 0, terms, creaseGate, meshNormals(P, raw.indices));
  if (snap > 0) {
    for (let i = 0; i < n; i++) {
      const x = P[3 * i]!,
        z = P[3 * i + 2]!;
      if (Math.abs(x) < snap && z > snap * 0.5) P[3 * i] = 0;
      if (Math.abs(z) < snap && x > snap * 0.5) P[3 * i + 2] = 0;
    }
    if (solid) {
      P0 = P.slice(); // já presos aos planos do corte
      // o quadrante só aparece por um instante (some enquanto o corte abre): só o contorno
      if (piece !== -1) projectCutSurface(P, solid, snap, piece || 1, terms, creaseGate, meshNormals(P, raw.indices));
      projectCutOutline(P, raw.indices, solid, snap);
    }
  }
  if (P0) unfold(P, P0, raw.indices);
  const cls = drop ? new Int8Array(n) : null;
  smoothSampling = true;
  for (let i = 0; i < n; i++) {
    let x = P[3 * i]!,
      y = P[3 * i + 1]!,
      z = P[3 * i + 2]!;
    const k = classify(x, y, z);
    if (cls) cls[i] = k;
    const s = surfaces[k] ?? surfaces[0]!;
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
  smoothSampling = false;
  let indices = raw.indices;
  if (cls && drop) {
    const fora = new Set(drop);
    const keep: number[] = [];
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t]!,
        b = indices[t + 1]!,
        c = indices[t + 2]!;
      const plano = (k: number) => P[3 * k] === 0 || P[3 * k + 2] === 0;
      const noPlano =
        (P[3 * a] === 0 && P[3 * b] === 0 && P[3 * c] === 0) || (P[3 * a + 2] === 0 && P[3 * b + 2] === 0 && P[3 * c + 2] === 0);
      // faces planas do corte saem: são refeitas pelo contorno exato (capMesh)
      if (noPlano && snap > 0) continue;
      const nFora = +fora.has(cls[a]!) + +fora.has(cls[b]!) + +fora.has(cls[c]!);
      // faixa junto à borda: maioria na superfície externa e fora do plano → sai
      if (!noPlano && (nFora === 3 || (nFora === 2 && !(plano(a) && plano(b) && plano(c))))) continue;
      keep.push(a, b, c);
    }
    indices = Uint32Array.from(keep);
  }
  if (!blendFaces) return { positions: P, normals, colors, indices };
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
  return { positions: P, normals, colors, indices };
}

/**
 * Peças cortadas: na aresta viva entre o plano de corte e a superfície curva a
 * grade "chanfra" os vértices (serrilhado). Os vértices da superfície curva vão
 * até solid = 0 em 3D e, se cruzarem o plano, ficam presos nele — a aresta
 * volta a ser viva e lisa.
 */
/**
 * A projeção pode dobrar triângulos onde a superfície faz curva fechada (a
 * borda lateral do dente, em z = 0, que é a silhueta vista de frente): o
 * triângulo invertido vira um "pontilhado" no contorno. Triângulo que virou
 * em relação à malha da grade devolve seus vértices à posição original.
 */
function unfold(P: Float32Array, P0: Float32Array, I: Uint32Array): void {
  const face = (Q: Float32Array, a: number, b: number, c: number) => {
    const ux = Q[3 * b]! - Q[3 * a]!,
      uy = Q[3 * b + 1]! - Q[3 * a + 1]!,
      uz = Q[3 * b + 2]! - Q[3 * a + 2]!;
    const vx = Q[3 * c]! - Q[3 * a]!,
      vy = Q[3 * c + 1]! - Q[3 * a + 1]!,
      vz = Q[3 * c + 2]! - Q[3 * a + 2]!;
    return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx] as const;
  };
  for (let pass = 0; pass < 6; pass++) {
    let fixed = 0;
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t]!,
        b = I[t + 1]!,
        c = I[t + 2]!;
      const n1 = face(P, a, b, c);
      const n0 = face(P0, a, b, c);
      const d = n1[0] * n0[0] + n1[1] * n0[1] + n1[2] * n0[2];
      if (d >= 0) continue; // degenerado (área ~0) não aparece: só os invertidos voltam
      for (const k of [a, b, c]) {
        if (P[3 * k] === P0[3 * k] && P[3 * k + 1] === P0[3 * k + 1] && P[3 * k + 2] === P0[3 * k + 2]) continue;
        P[3 * k] = P0[3 * k]!;
        P[3 * k + 1] = P0[3 * k + 1]!;
        P[3 * k + 2] = P0[3 * k + 2]!;
        fixed++;
      }
    }
    if (!fixed) break;
  }
}

/** Um passo de Newton de (x, y, z) rumo a fn = 0; devolve também a distância estimada. */
function newton(fn: Fn, x: number, y: number, z: number, e: number): [number, number, number, number] {
  // diferenças progressivas: 4 avaliações em vez de 7 (a função custa caro)
  const f = fn(x, y, z);
  const gx = (fn(x + e, y, z) - f) / e;
  const gy = (fn(x, y + e, z) - f) / e;
  // em z o passo vai para longe do plano médio: o perfil usa |z| e um passo que
  // cruza z = 0 inclina o gradiente, dobrando a malha na borda (silhueta pontilhada)
  const ez = z < 0 ? -e : e;
  const gz = (fn(x, y, z + ez) - f) / ez;
  const g2 = gx * gx + gy * gy + gz * gz;
  if (g2 < 1e-10) return [x, y, z, Infinity];
  return [x - (f * gx) / g2, y - (f * gy) / g2, z - (f * gz) / g2, Math.abs(f) / Math.sqrt(g2)];
}

/** Normais da malha da grade (média das faces, ponderada pela área). */
function meshNormals(P: Float32Array, I: Uint32Array): Float32Array {
  const N = new Float32Array(P.length);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t]!,
      b = I[t + 1]!,
      c = I[t + 2]!;
    const ux = P[3 * b]! - P[3 * a]!,
      uy = P[3 * b + 1]! - P[3 * a + 1]!,
      uz = P[3 * b + 2]! - P[3 * a + 2]!;
    const vx = P[3 * c]! - P[3 * a]!,
      vy = P[3 * c + 1]! - P[3 * a + 1]!,
      vz = P[3 * c + 2]! - P[3 * a + 2]!;
    const fx = uy * vz - uz * vy,
      fy = uz * vx - ux * vz,
      fz = ux * vy - uy * vx;
    for (const k of [a, b, c]) {
      N[3 * k] += fx;
      N[3 * k + 1] += fy;
      N[3 * k + 2] += fz;
    }
  }
  for (let i = 0; i < N.length; i += 3) {
    const l = Math.hypot(N[i]!, N[i + 1]!, N[i + 2]!) || 1;
    N[i] /= l;
    N[i + 1] /= l;
    N[i + 2] /= l;
  }
  return N;
}

/**
 * Raiz de fn sobre a reta p + t·d, |t| ≤ lim (regula falsi). Andar pela normal
 * da malha, e não pelo gradiente, evita que os vértices escorreguem pela
 * superfície: fora do sólido o campo é max(d, |z|) e o gradiente afunila tudo
 * para a borda lateral (z = 0), dobrando triângulos na silhueta.
 */
function lineRoot(fn: Fn, x: number, y: number, z: number, dx: number, dy: number, dz: number, lim: number, tol: number): number | null {
  let fa = fn(x, y, z);
  if (Math.abs(fa) < tol * 0.1) return 0;
  let a = 0;
  let b = fa > 0 ? -lim : lim;
  let fb = fn(x + b * dx, y + b * dy, z + b * dz);
  if (fa * fb > 0) {
    // a normal da grade pode apontar um pouco errado: tenta metade do caminho no outro sentido
    b = -b * 0.5;
    fb = fn(x + b * dx, y + b * dy, z + b * dz);
    if (fa * fb > 0) return null;
  }
  let side = 0;
  for (let k = 0; k < 14; k++) {
    const t = (a * fb - b * fa) / (fb - fa);
    const ft = fn(x + t * dx, y + t * dy, z + t * dz);
    if (Math.abs(ft) < tol * 0.1 || Math.abs(b - a) < tol * 0.1) return t;
    if (ft * fb > 0) {
      b = t;
      fb = ft;
      if (side === -1) fa *= 0.5;
      side = -1;
    } else {
      a = t;
      fa = ft;
      if (side === 1) fb *= 0.5;
      side = 1;
    }
  }
  return (a * fb - b * fa) / (fb - fa);
}

function projectCutSurface(P: Float32Array, solid: Fn, cell: number, piece: 1 | -1 | 0, terms?: Fn[], creaseGate?: Fn, dirs?: Float32Array): void {
  const n = P.length / 3;
  // derivada com passo curto: o perfil é muito inclinado junto ao contorno (silhueta)
  const e = cell * 0.08;
  const tol = cell * 0.02;
  for (let i = 0; i < n; i++) {
    const x0 = P[3 * i]!,
      y0 = P[3 * i + 1]!,
      z0 = P[3 * i + 2]!;
    if (piece && (x0 === 0 || z0 === 0)) continue; // já está num plano de corte
    // o vértice da grade fica até ~1 célula fora da superfície → silhueta ondulada
    const borda = piece !== 0 && Math.min(Math.abs(x0), Math.abs(z0)) <= cell * 2;
    const maxMove = cell * (borda ? 0.9 : 1.6);
    let x = x0,
      y = y0,
      z = z0;
    const t = dirs ? lineRoot(solid, x0, y0, z0, dirs[3 * i]!, dirs[3 * i + 1]!, dirs[3 * i + 2]!, maxMove * 0.98, tol) : null;
    if (t !== null) {
      x = x0 + t * dirs![3 * i]!;
      y = y0 + t * dirs![3 * i + 1]!;
      z = z0 + t * dirs![3 * i + 2]!;
    } else {
      for (let k = 0; k < 4; k++) {
        const r = newton(solid, x, y, z, e);
        if (r[3] === Infinity) break;
        [x, y, z] = r;
        if (r[3] < tol) break;
      }
    }
    // vinco entre duas superfícies (ex.: esmalte × linha cervical): projeções
    // alternadas levam o vértice à linha de interseção — sem dente de serra
    if (terms && (!creaseGate || Math.abs(creaseGate(x, y, z)) < cell * 1.5)) {
      // filtro barato (só o valor) antes de calcular gradientes
      let candidatos = 0;
      for (const t of terms) if (Math.abs(t(x, y, z)) < cell * 1.5) candidatos++;
      const perto = candidatos >= 2 ? terms.filter((t) => newton(t, x, y, z, e)[3] < cell * 0.6) : [];
      if (perto.length >= 2) {
        let a = x,
          b = y,
          c = z;
        for (let k = 0; k < 6; k++) for (const t of perto.slice(0, 2)) [a, b, c] = newton(t, a, b, c, e);
        if (newton(solid, a, b, c, e)[3] < cell * 0.1 && Math.hypot(a - x0, b - y0, c - z0) < maxMove) {
          x = a;
          y = b;
          z = c;
        }
      }
    }
    if (!(Math.hypot(x - x0, y - y0, z - z0) < maxMove)) continue;
    // mantém o vértice dentro da peça (prende ao plano que cruzou)
    if (piece === 0) {
      /* dente inteiro: sem corte */
    } else if (piece === 1) {
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

/**
 * Face de corte (ou anel cervical) com contorno exato. A face vinha da grade 3D (vértices
 * em degraus de 1 célula → borda serrilhada). Aqui a região f < 0 do plano é
 * poligonizada numa grade 2D fina (marching squares) e cada ponto da borda é
 * achado por bissecção na própria função: contorno liso na escala do pixel.
 * `toP` leva (a, b) do plano para o espaço do dente; `n` é a normal da face.
 */
function capMesh(
  f2: (a: number, b: number) => number,
  toP: (a: number, b: number) => Vec3,
  n: Vec3 | ((x: number, y: number, z: number) => Vec3),
  color: (x: number, y: number, z: number) => Vec3,
  [a0, a1, b0, b1]: [number, number, number, number],
  st: number,
): MeshData {
  const nAt = typeof n === 'function' ? n : () => n;
  const na = Math.ceil((a1 - a0) / st) + 1;
  const nb = Math.ceil((b1 - b0) / st) + 1;
  const V = new Float64Array(na * nb);
  for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) V[j * na + i] = f2(a0 + i * st, b0 + j * st);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const ids = new Map<number, number>();
  const vert = (key: number, a: number, b: number) => {
    const got = ids.get(key);
    if (got !== undefined) return got;
    const p = toP(a, b);
    const c = color(p[0], p[1], p[2]);
    const id = pos.length / 3;
    pos.push(p[0], p[1], p[2]);
    col.push(c[0], c[1], c[2]);
    ids.set(key, id);
    return id;
  };
  const node = (i: number, j: number) => vert(j * na + i, a0 + i * st, b0 + j * st);
  // ponto da borda numa aresta da grade (bissecção na função exata)
  const edge = (i: number, j: number, horiz: boolean) => {
    const key = na * nb + 2 * (j * na + i) + (horiz ? 0 : 1);
    if (ids.has(key)) return ids.get(key)!;
    let ta = 0,
      tb = 1;
    const ax = a0 + i * st,
      bx = b0 + j * st;
    const at = (t: number) => (horiz ? f2(ax + t * st, bx) : f2(ax, bx + t * st));
    const fa = horiz ? V[j * na + i]! : V[j * na + i]!;
    for (let k = 0; k < 18; k++) {
      const tm = (ta + tb) / 2;
      if (at(tm) < 0 === fa < 0) ta = tm;
      else tb = tm;
    }
    const t = (ta + tb) / 2;
    return vert(key, horiz ? ax + t * st : ax, horiz ? bx : bx + t * st);
  };
  const tri = (p: number, q: number, r: number) => {
    const ux = pos[3 * q]! - pos[3 * p]!,
      uy = pos[3 * q + 1]! - pos[3 * p + 1]!,
      uz = pos[3 * q + 2]! - pos[3 * p + 2]!;
    const vx = pos[3 * r]! - pos[3 * p]!,
      vy = pos[3 * r + 1]! - pos[3 * p + 1]!,
      vz = pos[3 * r + 2]! - pos[3 * p + 2]!;
    const m = nAt(pos[3 * p]!, pos[3 * p + 1]!, pos[3 * p + 2]!);
    const d = (uy * vz - uz * vy) * m[0] + (uz * vx - ux * vz) * m[1] + (ux * vy - uy * vx) * m[2];
    if (d === 0) return;
    if (d > 0) idx.push(p, q, r);
    else idx.push(p, r, q);
  };
  const fan = (poly: number[]) => {
    for (let k = 1; k + 1 < poly.length; k++) tri(poly[0]!, poly[k]!, poly[k + 1]!);
  };
  for (let j = 0; j + 1 < nb; j++)
    for (let i = 0; i + 1 < na; i++) {
      // cantos em ordem: (i,j) (i+1,j) (i+1,j+1) (i,j+1)
      const cs = [
        [i, j],
        [i + 1, j],
        [i + 1, j + 1],
        [i, j + 1],
      ] as const;
      const v = cs.map(([x, y]) => V[y * na + x]!);
      const inside = v.map((x) => x < 0);
      const count = inside.filter(Boolean).length;
      if (!count) continue;
      // aresta k liga o canto k ao k+1
      const edgeOf = (k: number) =>
        k === 0 ? edge(i, j, true) : k === 1 ? edge(i + 1, j, false) : k === 2 ? edge(i, j + 1, true) : edge(i, j, false);
      const sela = count === 2 && inside[0] === inside[2];
      if (sela && f2(a0 + (i + 0.5) * st, b0 + (j + 0.5) * st) >= 0) {
        // dois cantos opostos separados: um triângulo em cada
        for (let k = 0; k < 4; k++) if (inside[k]) fan([node(cs[k]![0], cs[k]![1]), edgeOf(k), edgeOf((k + 3) % 4)]);
        continue;
      }
      const poly: number[] = [];
      for (let k = 0; k < 4; k++) {
        if (inside[k]) poly.push(node(cs[k]![0], cs[k]![1]));
        if (inside[k] !== inside[(k + 1) % 4]) poly.push(edgeOf(k));
      }
      fan(poly);
    }
  const nv = pos.length / 3;
  const normals = new Float32Array(nv * 3);
  for (let k = 0; k < nv; k++) normals.set(nAt(pos[3 * k]!, pos[3 * k + 1]!, pos[3 * k + 2]!), 3 * k);
  return { positions: Float32Array.from(pos), normals, colors: Float32Array.from(col), indices: Uint32Array.from(idx) };
}

/** Junta malhas (sem grupos). */
function merge(...ms: MeshData[]): MeshData {
  let nv = 0,
    ni = 0;
  for (const m of ms) {
    nv += m.positions.length;
    ni += m.indices.length;
  }
  const positions = new Float32Array(nv),
    normals = new Float32Array(nv),
    colors = new Float32Array(nv),
    indices = new Uint32Array(ni);
  let ov = 0,
    oi = 0;
  for (const m of ms) {
    positions.set(m.positions, ov);
    normals.set(m.normals, ov);
    colors.set(m.colors, ov);
    for (let k = 0; k < m.indices.length; k++) indices[oi + k] = m.indices[k]! + ov / 3;
    ov += m.positions.length;
    oi += m.indices.length;
  }
  return { positions, normals, colors, indices };
}

/**
 * Separa a casca em dois grupos de material (coroa = 0, raiz = 1) cortando os
 * triângulos exatamente na curva cervical (crownValue = 0). Assim a coroa pode
 * se afastar da raiz (esmalte erguido) sem borda em dente de serra.
 */
function splitGroups(m: MeshData, crownValue: (x: number, y: number) => number): MeshData {
  const idx = m.indices;
  const pos = Array.from(m.positions);
  const nor = Array.from(m.normals);
  const col = Array.from(m.colors);
  const val: number[] = [];
  for (let i = 0; i < pos.length / 3; i++) val.push(crownValue(pos[3 * i]!, pos[3 * i + 1]!));
  const meio = new Map<string, number>();
  const corte = (i: number, j: number): number => {
    const k = i < j ? `${i}_${j}` : `${j}_${i}`;
    const got = meio.get(k);
    if (got !== undefined) return got;
    const t = val[i]! / (val[i]! - val[j]!);
    const v = pos.length / 3;
    for (let c = 0; c < 3; c++) {
      pos.push(pos[3 * i + c]! + (pos[3 * j + c]! - pos[3 * i + c]!) * t);
      col.push(col[3 * i + c]! + (col[3 * j + c]! - col[3 * i + c]!) * t);
    }
    let nx = nor[3 * i]! + (nor[3 * j]! - nor[3 * i]!) * t,
      ny = nor[3 * i + 1]! + (nor[3 * j + 1]! - nor[3 * i + 1]!) * t,
      nz = nor[3 * i + 2]! + (nor[3 * j + 2]! - nor[3 * i + 2]!) * t;
    const l = Math.hypot(nx, ny, nz) || 1;
    nor.push(nx / l, ny / l, nz / l);
    val.push(0);
    meio.set(k, v);
    return v;
  };
  const a: number[] = []; // coroa
  const b: number[] = []; // raiz
  const lado = (i: number) => val[i]! < 0;
  for (let t = 0; t < idx.length; t += 3) {
    const tri = [idx[t]!, idx[t + 1]!, idx[t + 2]!];
    const c = tri.map(lado);
    if (c[0] === c[1] && c[1] === c[2]) {
      (c[0] ? a : b).push(...tri);
      continue;
    }
    // o vértice isolado (lado diferente dos outros dois) fica num triângulo;
    // os outros dois formam um quadrilátero → 2 triângulos (mantém a orientação)
    const s0 = c[0] === c[1] ? 2 : c[0] === c[2] ? 1 : 0;
    const v0 = tri[s0]!,
      v1 = tri[(s0 + 1) % 3]!,
      v2 = tri[(s0 + 2) % 3]!;
    const m01 = corte(v0, v1),
      m02 = corte(v0, v2);
    (c[s0] ? a : b).push(v0, m01, m02);
    (c[s0] ? b : a).push(m01, v1, v2, m01, v2, m02);
  }
  return {
    positions: Float32Array.from(pos),
    normals: Float32Array.from(nor),
    colors: Float32Array.from(col),
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
  /**
   * Só a casca (o que o hero mostra): fica pronta em uma fração do tempo e o
   * dente 3D aparece logo; as demais peças chegam em seguida.
   */
  shellOnly?: boolean;
}

const emptyMesh = (): MeshData => ({
  positions: new Float32Array(0),
  normals: new Float32Array(0),
  colors: new Float32Array(0),
  indices: new Uint32Array(0),
});

const fieldCache = new Map<string, Field2D>();

export function buildTooth(opts: BuildOptions): ToothData {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const step = opts.cell > 0.011 ? 2.5 : 2;
  const nu = Math.ceil(340 / step) + 1;
  const nv = Math.ceil(500 / step) + 1;
  // campos 2D guardados entre chamadas (o worker gera a casca e depois o resto)
  // e só calculados quando usados: a casca só precisa do contorno externo
  const field = (k: 'P' | 'D' | 'Q') => {
    const key = `${k}:${step}`;
    let f = fieldCache.get(key);
    if (!f) {
      f = buildField(pathToPolyline(PATHS[k]), 30, 30, step, nu, nv, k === 'Q' ? 0 : 2);
      fieldCache.set(key, f);
    }
    return f;
  };
  const F = {
    P: field('P'),
    get D() {
      return field('D');
    },
    get Q() {
      return field('Q');
    },
  };

  const fP: Fn = (x, y, z) => inflate(F.P, outerProfile, x, y, z);
  const fDraw: Fn = (x, y, z) => inflate(F.D, dentinProfile, x, y, z);
  /** perto do colo a dentina encosta na superfície (esmalte afina até a junção cervical) */
  const fD: Fn = (x, y, z) => {
    const v = toSvgV(y);
    const cv = cervicalV(toSvgU(x));
    const t = smooth(cv - 55, cv - 4, v);
    const d = fDraw(x, y, z);
    return t <= 0 ? d : lerp(d, fP(x, y, z) + 0.026, t);
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
    }, mode ? g.h * 1.3 : 0, (x, y, z) => Math.max(fP(x, y, z), cs(x, y, z), -fD(x, y, z)), mode ? s : 0, g.h, true, [
      fP,
      cs,
      (x, y, z) => -fD(x, y, z),
    ], cs, [0, 1, 2]);
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
    }, mode ? s : 0, g.h, true, [fD, fP, cs, (x, y, z) => -cs(x, y, z)], cs, [0, 1, 3]);
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
    }, mode ? g.h * 1.3 : 0, fQ, mode ? s : 0, g.h, true, undefined, undefined, []);
  };

  const shell = splitGroups(
    finalize(surfaceNets(shellG), [{ f: fP, s: 1, color: shellColor }], () => 0, 0, fP, 0, shellG.h, false),
    (x, y) => cs(x, y, 0),
  );

  const anchors: Record<string, [number, number, number]> = {
    esmalte: [toWorldX(318), toWorldY(152), 0],
    polpa: [toWorldX(222), toWorldY(214), 0],
    dentina: [toWorldX(279), toWorldY(300), 0],
    raiz: [toWorldX(262), toWorldY(420), 0],
  };
  const meta = () => ({
    top: toWorldY(68),
    bottom: toWorldY(495),
    cervicalY: toWorldY(263),
    crownWidth: (330 - 70) * K,
    anchors,
    ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
  });
  if (opts.shellOnly) {
    const e = emptyMesh;
    return {
      whole: { shell, enamel: e(), core: e(), dentin: e(), enamelInner: e() },
      cut: { enamel: e(), core: e(), pulp: e() },
      quarter: { enamel: e(), core: e(), pulp: e() },
      crowns: { premolar: e(), canine: e(), incisor: e() },
      meta: meta(),
    };
  }
  fillGrid(enamelG, fEnamel);
  fillGrid(coreG, fCore);
  fillGrid(pulpG, fQ);

  // parede da dentina e interior do esmalte: a superfície fD inteira, lisa como
  // a casca (projeção pela normal) e dividida exatamente na curva cervical; só a
  // parte da coroa aparece. Substituem as faces da grade, serrilhadas na borda.
  const dentinG = makeGrid([-0.38, -0.6, -0.32], [0.38, 0.57, 0.32], h);
  fillGrid(dentinG, fD);
  const dentin = splitGroups(
    finalize(surfaceNets(dentinG), [{ f: fD, s: 1, color: coreOuterColor }], () => 0, 0, fD, 0, dentinG.h, false),
    (x, y) => cs(x, y, 0),
  );
  const enamelInner: MeshData = {
    ...dentin,
    positions: dentin.positions.slice(),
    normals: dentin.normals.slice(),
    indices: dentin.indices.slice(),
    colors: new Float32Array(dentin.colors.length).map((_, i) => C.enamelInner[i % 3]!),
  };

  // faces de corte exatas: plano z = 0 (x ≥ 0) e plano x = 0 (z ≥ 0); o quadrante
  // removido usa as mesmas regiões com a normal invertida
  const sc = h * 0.5;
  const caps = (f: Fn, color: (x: number, y: number) => Vec3, sgn: 1 | -1, box: [number, number]) =>
    merge(
      capMesh((a, b) => f(a, b, 0), (a, b) => [a, b, 0], [0, 0, sgn], color, [0, 0.38, box[0], box[1]], sc),
      capMesh((a, b) => f(0, b, a), (a, b) => [0, b, a], [sgn, 0, 0], color, [0, 0.32, box[0], box[1]], sc),
    );
  const capSet = (sgn: 1 | -1) => ({
    enamel: caps(fEnamel, enamelFace, sgn, [-0.02, 0.57]),
    core: caps(fCore, faceColor, sgn, [-0.6, 0.5]),
    pulp: caps(fQ, pulpFace, sgn, [-0.44, 0.33]),
  });
  const capMain = capSet(1);
  const capQuarter = capSet(-1);
  // anel cervical (degrau entre dentina e superfície, à vista quando o esmalte
  // sobe): a superfície cs = 0 é y = yc(x), qualquer z → também uma "face" 2D
  const yc = (x: number) => toWorldY(cervicalV(toSvgU(x)));
  const ycN = (x: number, sgn: 1 | -1): Vec3 => {
    const e = 1e-4;
    const d = (yc(x + e) - yc(x - e)) / (2 * e);
    const l = Math.hypot(d, 1);
    return [(-d / l) * sgn, (1 / l) * sgn, 0];
  };
  const ring = (sgn: 1 | -1, color: (x: number, y: number) => Vec3) =>
    capMesh(
      (a, b) => {
        const y = yc(a);
        return Math.max(fP(a, y, b), -fD(a, y, b));
      },
      (a, b) => [a, yc(a), b],
      (x) => ycN(x, sgn),
      color,
      [-0.38, 0.38, -0.32, 0.32],
      sc,
    );
  const ringCore = ring(1, coreOuterColor); // topo da raiz, voltado para cima
  const ringEnamel = ring(-1, enamelFace); // base do esmalte, voltada para baixo

  // o anel inteiro entra em todas as peças: o recorte na GPU deixa só a parte de cada uma
  const whole = {
    shell,
    enamel: merge(enamelMesh(enamelG, 0), ringEnamel),
    core: merge(coreMesh(coreG, 0), ringCore),
    dentin,
    enamelInner,
  };
  const cut = {
    enamel: merge(enamelMesh(cutMain(enamelG), 1), capMain.enamel, ringEnamel),
    core: merge(coreMesh(cutMain(coreG), 1), capMain.core, ringCore),
    pulp: merge(pulpMesh(cutMain(pulpG), 1), capMain.pulp),
  };
  const quarter = {
    enamel: merge(enamelMesh(cutQuarter(enamelG), -1), capQuarter.enamel, ringEnamel),
    core: merge(coreMesh(cutQuarter(coreG), -1), capQuarter.core, ringCore),
    pulp: merge(pulpMesh(cutQuarter(pulpG), -1), capQuarter.pulp),
  };

  const crowns = buildCrowns(Math.max(0.03, h * 3.2));
  return { whole, cut, quarter, crowns, meta: meta() };
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
    0,
    solid,
    0,
    h,
    false,
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
