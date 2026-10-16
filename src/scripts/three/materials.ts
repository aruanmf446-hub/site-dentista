/**
 * Materiais do dente. Base física (MeshPhysicalMaterial) com cores por
 * vértice vindas dos gradientes do storyboard, e um uniforme `uFade` que
 * mistura o resultado com a cor do fundo — equivalente a "opacidade sobre
 * fundo liso", sem os problemas de ordenação da transparência.
 */
import * as THREE from 'three';

export interface FadeUniforms {
  uFade: { value: number };
  uBg: { value: THREE.Color };
  /** escurecimento nas bordas (o "volume" vinho dos gradientes do design) */
  uEdge: { value: number };
  uEdgeTint: { value: THREE.Color };
}

export type ToothMaterial = THREE.MeshPhysicalMaterial & { userData: { uniforms: FadeUniforms } };

export type MaterialKind = 'enamel' | 'core' | 'pulp' | 'crown';

const PRESETS: Record<MaterialKind, THREE.MeshPhysicalMaterialParameters> = {
  enamel: {
    roughness: 0.3,
    clearcoat: 0.85,
    clearcoatRoughness: 0.18,
    sheen: 0.35,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color('#fff0f2'),
    specularIntensity: 0.65,
    envMapIntensity: 0.75,
  },
  core: {
    roughness: 0.58,
    clearcoat: 0.2,
    clearcoatRoughness: 0.45,
    specularIntensity: 0.35,
    envMapIntensity: 0.55,
  },
  pulp: {
    roughness: 0.42,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
    emissive: new THREE.Color('#b8384f'),
    emissiveIntensity: 0,
    envMapIntensity: 0.5,
  },
  crown: {
    roughness: 0.32,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
    sheen: 0.3,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color('#fff0f2'),
    specularIntensity: 0.6,
    envMapIntensity: 0.75,
  },
};

const EDGE: Record<MaterialKind, number> = { enamel: 0.55, core: 0.5, pulp: 0.35, crown: 0.5 };

export function makeMaterial(kind: MaterialKind, bg: THREE.Color, extra: THREE.MeshPhysicalMaterialParameters = {}): ToothMaterial {
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, ...PRESETS[kind], ...extra }) as ToothMaterial;
  const uniforms: FadeUniforms = {
    uFade: { value: 0 },
    uBg: { value: bg.clone() },
    uEdge: { value: EDGE[kind] },
    uEdgeTint: { value: new THREE.Color(0.55, 0.36, 0.4) },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFade = uniforms.uFade;
    shader.uniforms.uBg = uniforms.uBg;
    shader.uniforms.uEdge = uniforms.uEdge;
    shader.uniforms.uEdgeTint = uniforms.uEdgeTint;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uFade;\nuniform vec3 uBg;\nuniform float uEdge;\nuniform vec3 uEdgeTint;\nvoid main() {')
      .replace(
        '#include <dithering_fragment>',
        [
          '#include <dithering_fragment>',
          '\tfloat fres = 1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);',
          '\tgl_FragColor.rgb *= mix(vec3(1.0), uEdgeTint, pow(fres, 2.4) * uEdge);',
          '\tgl_FragColor.rgb = mix(gl_FragColor.rgb, uBg, uFade);',
        ].join('\n'),
      );
  };
  mat.customProgramCacheKey = () => `tooth-fade-${kind}`;
  return mat;
}

/** Textura de gradiente radial (sombra de contato / halo). */
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
