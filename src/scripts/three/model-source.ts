/**
 * Fontes do modelo 3D. A lógica de rolagem só conhece `ToothAssets`;
 * trocar a geometria procedural por um GLB não exige mexer na timeline.
 *
 * Convenção do GLB (ver MOTION.md): Y para cima, altura total ≈ 1,07,
 * topo da coroa em y ≈ 0,53, linha cervical em y ≈ 0,04, frente em +Z.
 * Nós (mesh) com estes nomes; os ausentes caem no procedural:
 *   shell                              — dente inteiro em malha única (grupo 0 = coroa, 1 = raiz)
 *   enamel, core                       — dente inteiro em camadas (esmalte separável)
 *   enamel_cut, core_cut, pulp_cut     — dente com o quadrante (x>0, z>0) removido
 *   enamel_quarter, core_quarter, pulp_quarter — o quadrante removido
 *   crown_premolar, crown_canine, crown_incisor — coroas da arcada (largura ≈ 1, base em y = 0)
 */
import * as THREE from 'three';
import type { MeshData, ToothData } from './geometry/tooth-builder';

export type PartName =
  | 'shell'
  | 'enamel'
  | 'core'
  | 'enamel_cut'
  | 'core_cut'
  | 'pulp_cut'
  | 'enamel_quarter'
  | 'core_quarter'
  | 'pulp_quarter'
  | 'crown_premolar'
  | 'crown_canine'
  | 'crown_incisor';

export interface ToothAssets {
  parts: Record<PartName, THREE.BufferGeometry>;
  meta: ToothData['meta'];
  source: 'procedural' | 'glb';
}

export function toGeometry(m: MeshData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(m.colors, 3));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  m.groups?.forEach(([start, count, mat]) => g.addGroup(start, count, mat));
  g.computeBoundingSphere();
  return g;
}

export function assetsFromData(d: ToothData): ToothAssets {
  return {
    source: 'procedural',
    meta: d.meta,
    parts: {
      shell: toGeometry(d.whole.shell),
      enamel: toGeometry(d.whole.enamel),
      core: toGeometry(d.whole.core),
      enamel_cut: toGeometry(d.cut.enamel),
      core_cut: toGeometry(d.cut.core),
      pulp_cut: toGeometry(d.cut.pulp),
      enamel_quarter: toGeometry(d.quarter.enamel),
      core_quarter: toGeometry(d.quarter.core),
      pulp_quarter: toGeometry(d.quarter.pulp),
      crown_premolar: toGeometry(d.crowns.premolar),
      crown_canine: toGeometry(d.crowns.canine),
      crown_incisor: toGeometry(d.crowns.incisor),
    },
  };
}

export interface ProceduralOptions {
  /** células em ordem: a primeira aparece rápido, as seguintes refinam */
  cells: number[];
  onRefine?: (assets: ToothAssets) => void;
}

/** Gera a geometria num Web Worker (fallback: thread principal). */
export function loadProcedural(opts: ProceduralOptions): Promise<ToothAssets> {
  return new Promise((resolve, reject) => {
    let first = true;
    const handle = (data: ToothData) => {
      const assets = assetsFromData(data);
      if (first) {
        first = false;
        resolve(assets);
      } else opts.onRefine?.(assets);
    };
    try {
      const worker = new Worker(new URL('./tooth.worker.ts', import.meta.url), { type: 'module' });
      let pending = opts.cells.length;
      worker.onmessage = (e: MessageEvent<{ data: ToothData }>) => {
        handle(e.data.data);
        if (--pending === 0) worker.terminate();
      };
      worker.onerror = (err) => {
        worker.terminate();
        if (first) {
          import('./geometry/tooth-builder')
            .then((m) => handle(m.buildTooth({ cell: opts.cells[0]! })))
            .catch(reject);
        } else console.warn('[cena] refinamento falhou', err);
      };
      worker.postMessage({ cells: opts.cells });
    } catch {
      import('./geometry/tooth-builder')
        .then((m) => handle(m.buildTooth({ cell: opts.cells[0]! })))
        .catch(reject);
    }
  });
}

/** Carrega um GLB com os nós da convenção acima; completa o que faltar com o procedural. */
export async function loadGlb(url: string, fallback: () => Promise<ToothAssets>): Promise<ToothAssets> {
  const [{ GLTFLoader }, base] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), fallback()]);
  const gltf = await new GLTFLoader().loadAsync(url);
  const parts = { ...base.parts };
  gltf.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.name in parts) {
      const g = mesh.geometry.clone();
      mesh.updateWorldMatrix(true, false);
      g.applyMatrix4(mesh.matrixWorld);
      if (!g.getAttribute('color')) {
        const n = g.getAttribute('position').count;
        g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
      }
      parts[mesh.name as PartName] = g;
    }
  });
  return { ...base, parts, source: 'glb' };
}
