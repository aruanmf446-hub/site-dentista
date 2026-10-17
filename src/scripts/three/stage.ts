/**
 * Palco 3D: cena, luzes, rig de câmera, dente em camadas e arcada.
 *
 * Enquadramento: cada quadro recebe um retângulo-alvo (FrameRect, em px do
 * canvas) medido de elementos do DOM ([data-anchor]). A distância da
 * câmera é calculada para que o objeto caiba nessa altura, e um
 * deslocamento de lente (setViewOffset) põe o alvo no centro do retângulo.
 * Assim a composição 3D acompanha o layout responsivo sem coordenadas fixas.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeMaterial, radialTexture, type MaterialKind, type ToothMaterial } from './materials';
import type { ToothAssets } from './model-source';
import { clamp01, lerp, smoothstep, type FrameRect, type SceneState } from './state';
import { LARGURAS, PROPORCAO, TIPOS, TOOTH_COUNT, anguloDente } from '@/lib/arcade';

const DEG = Math.PI / 180;
const FOV = 28;
/** dente da arcada que é o próprio dente da cena de tratamentos (molar inferior esquerdo da vista) */
const HERO_SLOT = 12;

export interface StageColors {
  bg: string;
  bgDark: string;
  primary: string;
  primaryDark: string;
  gum: string;
}

export interface SpecPreset {
  dentes: number[];
  efeito: string;
}

function outColor(hex: string): THREE.Color {
  // cor no espaço de saída (sRGB), para misturar depois do tone mapping
  const n = parseInt(hex.replace('#', ''), 16);
  return new THREE.Color().setRGB(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, THREE.LinearSRGBColorSpace);
}

interface ArchTooth {
  group: THREE.Group;
  mats: ToothMaterial[];
  ring: THREE.Mesh;
  base: THREE.Vector3;
  yaw: number;
  height: number;
  index: number;
}

export class Stage3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 80);
  private colors: StageColors;
  private bgLight: THREE.Color;
  private bgDark: THREE.Color;

  private toothRoot = new THREE.Group();
  private wholeGroup = new THREE.Group();
  private cutGroup = new THREE.Group();
  private quarterGroup = new THREE.Group();
  private enamelPivot = new THREE.Group();
  private enamelHolder = new THREE.Group();
  private mats: Record<string, ToothMaterial> = {};
  private quarterMats: ToothMaterial[] = [];
  private shadow!: THREE.Sprite;
  private rootPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 10);
  /**
   * Corte longitudinal na GPU para a casca lisa: remove o quadrante x>0, z>0
   * (clipIntersection: só some o que está do lado negativo dos dois planos).
   * Um par segue a raiz (toothRoot) e outro o esmalte (que sobe e inclina).
   */
  private rootCut = [new THREE.Plane(), new THREE.Plane()];
  private enamelCutPlanes = [new THREE.Plane(), new THREE.Plane()];
  /** casca lisa (coroa/raiz) usada quando o dente está cortado ou o esmalte erguido */
  private liftGroup = new THREE.Group();
  private hiddenMat = new THREE.MeshBasicMaterial({ visible: false });
  private gumPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  private arcade = new THREE.Group();
  private archTeeth: ArchTooth[] = [];
  private wire!: THREE.Mesh;
  private brackets: THREE.Mesh[] = [];
  private gum!: THREE.Mesh;
  private glow!: THREE.Mesh;
  private archCenter = new THREE.Vector3();
  private archWidth = 6;
  private archDepth = 3.6;
  private presets: SpecPreset[] = [];

  private meta!: ToothAssets['meta'];
  private width = 1;
  private height = 1;
  private time = 0;
  ready = false;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, colors: StageColors, opts: { antialias?: boolean } = {}) {
    this.colors = colors;
    this.bgLight = outColor(colors.bg);
    this.bgDark = outColor(colors.bgDark);
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas as HTMLCanvasElement,
      alpha: true,
      antialias: opts.antialias ?? true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.localClippingEnabled = true;

    this.scene.environmentIntensity = 0.6;

    const hemi = new THREE.HemisphereLight(0xffffff, new THREE.Color(colors.primaryDark), 0.55);
    const key = new THREE.DirectionalLight(0xfff8f2, 2.7);
    key.position.set(-2.6, 3.6, 3.2);
    const rim = new THREE.DirectionalLight(0xffdce2, 2.2);
    rim.position.set(3.2, 1.2, -2.6);
    const fill = new THREE.DirectionalLight(0xf1f4ff, 0.45);
    fill.position.set(2.2, -1.2, 3);
    this.scene.add(hemi, key, rim, fill);

    this.toothRoot.add(this.wholeGroup, this.cutGroup, this.quarterGroup, this.liftGroup);
    this.enamelPivot.add(this.enamelHolder);
    this.scene.add(this.toothRoot, this.arcade);
  }

  /** Monta (ou troca, ao refinar) as malhas a partir dos assets. */
  setAssets(a: ToothAssets): void {
    const replacing = this.ready;
    this.meta = a.meta;
    const P = a.parts;
    const mk = (kind: MaterialKind, key: string, extra?: THREE.MeshPhysicalMaterialParameters) => {
      if (!this.mats[key]) this.mats[key] = makeMaterial(kind, this.bgDark, { clippingPlanes: [this.rootPlane], ...extra });
      return this.mats[key]!;
    };
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => {
      const x = new THREE.Mesh(g, m);
      x.frustumCulled = false;
      return x;
    };
    const dispose = (grp: THREE.Object3D) => {
      grp.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.());
      grp.clear();
    };
    dispose(this.wholeGroup);
    dispose(this.cutGroup);
    dispose(this.quarterGroup);
    dispose(this.enamelHolder);
    this.liftGroup.clear();

    // pivô do esmalte no centro da coroa (inclinação de −8° do quadro C)
    const pivotY = 0.3;
    this.enamelPivot.position.set(0, pivotY, 0);
    this.enamelHolder.position.set(0, -pivotY, 0);
    const enamelWhole = mesh(P.enamel, mk('enamel', 'enamel'));
    const enamelCut = mesh(P.enamel_cut, mk('enamel', 'enamelCut', { side: THREE.DoubleSide }));
    enamelWhole.name = 'enamelWhole';
    enamelCut.name = 'enamelCut';
    this.enamelHolder.add(enamelWhole, enamelCut);
    this.toothRoot.add(this.enamelPivot);
    const coreWhole = mesh(P.core, mk('core', 'core'));
    coreWhole.name = 'coreWhole';
    const shell = new THREE.Mesh(P.shell, [mk('enamel', 'enamel'), mk('core', 'core')]);
    shell.name = 'shell';
    shell.frustumCulled = false;
    this.wholeGroup.add(coreWhole, shell);
    this.cutGroup.add(mesh(P.core_cut, mk('core', 'coreCut')), mesh(P.pulp_cut, mk('pulp', 'pulp')));
    // superfície externa do dente cortado/aberto = a mesma casca lisa do dente
    // inteiro (coroa no esmalte, raiz no núcleo), recortada na GPU pelo corte;
    // as malhas de corte só trazem as faces planas e o interior
    const shellCrown = new THREE.Mesh(P.shell, [
      mk('enamel', 'enamelShell', { clippingPlanes: this.enamelCutPlanes, clipIntersection: true }),
      this.hiddenMat,
    ]);
    shellCrown.name = 'shellCrown';
    shellCrown.frustumCulled = false;
    this.enamelHolder.add(shellCrown);
    const shellRoot = new THREE.Mesh(P.shell, [this.hiddenMat, mk('core', 'coreShell', { clippingPlanes: this.rootCut, clipIntersection: true })]);
    shellRoot.name = 'shellRoot';
    shellRoot.frustumCulled = false;
    this.liftGroup.add(shellRoot);

    if (!this.quarterMats.length) {
      this.quarterMats = [
        makeMaterial('enamel', this.bgDark, { transparent: true }),
        makeMaterial('core', this.bgDark, { transparent: true }),
        makeMaterial('pulp', this.bgDark, { transparent: true }),
      ];
    }
    this.quarterGroup.add(
      mesh(P.enamel_quarter, this.quarterMats[0]!),
      mesh(P.core_quarter, this.quarterMats[1]!),
      mesh(P.pulp_quarter, this.quarterMats[2]!),
    );

    if (!this.shadow) {
      const tex = radialTexture('rgba(255,255,255,0.95)', 'rgba(255,255,255,0)');
      this.shadow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(this.colors.primaryDark), depthWrite: false, transparent: true }));
      this.shadow.renderOrder = -1;
      this.scene.add(this.shadow);
    }
    this.buildArcade(a, replacing);
    this.ready = true;
  }

  private buildArcade(a: ToothAssets, replacing: boolean): void {
    this.arcade.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry && !replacing) m.geometry.dispose();
    });
    this.arcade.clear();
    this.archTeeth = [];
    this.brackets = [];

    const s = this.meta.crownWidth / LARGURAS[HERO_SLOT]!; // mundo por px do design
    const A = 290 * s;
    const B = 330 * s;
    const yBase = this.meta.cervicalY;
    this.gumPlane.constant = -yBase + 0.002;
    const local = (i: number) => {
      const th = anguloDente(i) * DEG;
      return { x: A * Math.cos(th), z: -B * Math.sin(th), tx: -A * Math.sin(th), tz: -B * Math.cos(th) };
    };
    const slot = local(HERO_SLOT);
    // a arcada é posicionada para que o dente da cena ocupe a posição 12 na origem
    this.arcade.position.set(-slot.x, 0, -slot.z);
    const zFar = -B - 0.35;
    const zNear = B * Math.sin(12 * DEG) + 0.45;
    this.archCenter.set(-slot.x, yBase + 0.15, -slot.z + (zFar + zNear) / 2);
    this.archWidth = 2 * A + 1.0;
    this.archDepth = zNear - zFar;

    const bg = this.bgLight;
    const crownGeo = (t: string) =>
      t === 'pre-molar' ? a.parts.crown_premolar : t === 'canino' ? a.parts.crown_canine : a.parts.crown_incisor;
    const ringGeo = new THREE.RingGeometry(0.91, 1, 56);
    ringGeo.rotateX(-Math.PI / 2);
    const primary = new THREE.Color(this.colors.primary);

    for (let i = 0; i < TOOTH_COUNT; i++) {
      const L = local(i);
      const yaw = Math.atan2(-L.tz, L.tx);
      const w = LARGURAS[i]! * s;
      const depth = w * PROPORCAO[i]!;
      const g = new THREE.Group();
      g.position.set(L.x, 0, L.z);
      g.rotation.y = yaw;
      const mats: ToothMaterial[] = [];
      let height = 0.5;
      if (i !== HERO_SLOT) {
        if (TIPOS[i] === 'molar') {
          const k = w / this.meta.crownWidth;
          const holder = new THREE.Group();
          holder.scale.setScalar(k);
          holder.position.y = yBase * (1 - k);
          const me = makeMaterial('enamel', bg, { clippingPlanes: [this.gumPlane] });
          const mc = makeMaterial('core', bg, { clippingPlanes: [this.gumPlane] });
          holder.add(new THREE.Mesh(a.parts.shell, [me, mc]));
          g.add(holder);
          mats.push(me, mc);
          height = (this.meta.top - yBase) * k;
        } else {
          const m = makeMaterial('crown', bg);
          const crown = new THREE.Mesh(crownGeo(TIPOS[i]!), m);
          // altura-alvo da coroa (mundo) / altura local da geometria
          const alvo = TIPOS[i] === 'canino' ? [0.46, 1.0] : TIPOS[i] === 'incisivo' ? [0.42, 0.9] : [0.4, 0.86];
          crown.scale.set(w * 1.1, alvo[0]! / alvo[1]!, depth * 1.1);
          crown.position.y = yBase;
          g.add(crown);
          mats.push(m);
          height = TIPOS[i] === 'canino' ? 0.46 : 0.41;
        }
      } else {
        height = this.meta.top - yBase;
      }
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: primary, transparent: true, opacity: 0, depthWrite: false }));
      ring.scale.set(w * 0.62, 1, depth * 0.62);
      ring.position.y = yBase + 0.003;
      g.add(ring);
      this.arcade.add(g);
      this.archTeeth.push({ group: g, mats, ring, base: g.position.clone(), yaw, height, index: i });
    }

    // halo radial sob a arcada
    const glowTex = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTex, color: primary, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.glow.scale.set(A * 2.6, 1, B * 2.3);
    this.glow.position.set(0, yBase - 0.01, -B * 0.35);
    this.glow.renderOrder = -2;
    this.arcade.add(this.glow);

    // gengiva (periodontia) e fio ortodôntico, ao longo da curva
    const gumPts: THREE.Vector3[] = [];
    const wirePts: THREE.Vector3[] = [];
    for (let k = -0.06; k <= 1.06; k += 0.02) {
      const th = (-12 + k * 204) * DEG;
      gumPts.push(new THREE.Vector3(A * Math.cos(th), yBase - 0.05, -B * Math.sin(th)));
    }
    this.archTeeth.forEach((t) => {
      const th = anguloDente(t.index) * DEG;
      const out = new THREE.Vector2(Math.cos(th) / A, -Math.sin(th) / B).normalize();
      const depth = LARGURAS[t.index]! * s * PROPORCAO[t.index]!;
      const p = new THREE.Vector3(t.base.x + out.x * depth * 0.5, yBase + Math.min(0.2, t.height * 0.5), t.base.z + out.y * depth * 0.5);
      wirePts.push(p);
      const br = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.075, 0.035),
        new THREE.MeshStandardMaterial({ color: primary, roughness: 0.35, metalness: 0.3, transparent: true, opacity: 0 }),
      );
      br.position.copy(p);
      br.rotation.y = t.yaw;
      this.brackets.push(br);
      this.arcade.add(br);
    });
    const gumCurve = new THREE.CatmullRomCurve3(gumPts);
    this.gum = new THREE.Mesh(
      new THREE.TubeGeometry(gumCurve, 160, 0.2, 16, false),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(this.colors.gum), roughness: 0.6, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.gum.scale.y = 0.55;
    this.gum.renderOrder = -1;
    this.arcade.add(this.gum);
    this.wire = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wirePts), 200, 0.011, 8, false),
      new THREE.MeshStandardMaterial({ color: primary, roughness: 0.3, metalness: 0.5, transparent: true, opacity: 0 }),
    );
    this.arcade.add(this.wire);
  }

  /**
   * Compila os shaders sem travar a página (KHR_parallel_shader_compile,
   * quando disponível). Chamado antes do primeiro quadro.
   */
  async warmup(): Promise<void> {
    // mapa de ambiente (reflexos da porcelana) em uma tarefa separada
    await new Promise((r) => setTimeout(r, 0));
    if (!this.scene.environment) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }
    await new Promise((r) => setTimeout(r, 0));
    const prev = this.arcade.visible;
    this.arcade.visible = true;
    this.cutGroup.visible = true;
    this.quarterGroup.visible = true;
    this.liftGroup.visible = true;
    const crown = this.enamelHolder.getObjectByName('shellCrown');
    if (crown) crown.visible = true;
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } catch {
      /* navegadores sem compilação assíncrona compilam no primeiro quadro */
    }
    this.arcade.visible = prev;
  }

  /** Planos do corte em coordenadas de mundo (a casca é recortada na GPU). */
  private updateCutPlanes(active: boolean): void {
    const set = (planes: THREE.Plane[], frame: THREE.Object3D) => {
      if (!active) {
        // longe de tudo: nada fica do lado negativo dos dois planos
        planes[0]!.set(new THREE.Vector3(-1, 0, 0), 1e3);
        planes[1]!.set(new THREE.Vector3(0, 0, -1), 1e3);
        return;
      }
      frame.updateWorldMatrix(true, false);
      planes[0]!.set(new THREE.Vector3(-1, 0, 0), 0).applyMatrix4(frame.matrixWorld);
      planes[1]!.set(new THREE.Vector3(0, 0, -1), 0).applyMatrix4(frame.matrixWorld);
    };
    set(this.rootCut, this.toothRoot);
    set(this.enamelCutPlanes, this.enamelHolder);
  }

  setPresets(p: SpecPreset[]): void {
    this.presets = p;
  }

  setSize(w: number, h: number, dpr: number): void {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
  }

  /** Atualiza tempo de animação ociosa (segundos). */
  tick(dt: number): void {
    this.time += dt;
  }

  /**
   * Aplica o estado. `toothRect` é onde o dente deve aparecer; `archRect`,
   * onde a arcada deve aparecer (usado à medida que state.arch → 1).
   */
  apply(st: SceneState, toothRect: FrameRect, archRect: FrameRect = toothRect): void {
    if (!this.ready) return;
    const t = this.time;
    const idle = st.idle;
    const meta = this.meta;

    /* ---------- dente ---------- */
    const cut = clamp01(st.cut);
    const showCut = cut > 0.001;
    this.wholeGroup.visible = !showCut;
    this.cutGroup.visible = showCut;
    this.quarterGroup.visible = showCut && cut < 0.999;
    const enamelWhole = this.enamelHolder.getObjectByName('enamelWhole')!;
    const enamelCut = this.enamelHolder.getObjectByName('enamelCut')!;
    // malha única (sem costura cervical) enquanto o esmalte está assentado
    const useShell = !showCut && st.enamelLift < 0.0015 && Math.abs(st.enamelTilt) < 0.05;
    enamelWhole.visible = !showCut && !useShell;
    enamelCut.visible = showCut;
    this.wholeGroup.getObjectByName('shell')!.visible = useShell;
    this.wholeGroup.getObjectByName('coreWhole')!.visible = !useShell;
    this.enamelHolder.getObjectByName('shellCrown')!.visible = !useShell;
    this.liftGroup.visible = !useShell;

    const q = smoothstep(0, 1, cut);
    this.quarterGroup.position.set(0.55 * q, 0.04 * q, 0.9 * q);
    this.quarterGroup.rotation.set(0, 0.5 * q, -0.2 * q);
    const qOpacity = 1 - smoothstep(0.08, 0.6, cut);
    this.quarterMats.forEach((m) => {
      m.opacity = qOpacity;
      m.depthWrite = qOpacity > 0.98;
    });

    this.enamelPivot.position.y = 0.3 + st.enamelLift;
    this.enamelPivot.rotation.z = st.enamelTilt * DEG;

    const sway = Math.sin(t * 0.42) * 7 * idle;
    const float = Math.sin(t * 0.9) * 0.012 * idle;
    this.toothRoot.rotation.set(0, (st.toothRotY + sway) * DEG, st.toothRotZ * DEG, 'YXZ');
    this.toothRoot.position.set(0, st.toothRise + float * (1 - st.arch), 0);
    this.updateCutPlanes(showCut);

    // esmaecimento por camada (abas do mobile) e cor de fundo atual
    const bgNow = this.bgLight.clone().lerp(this.bgDark, clamp01(st.dark));
    const setFade = (key: string, v: number) => {
      const m = this.mats[key];
      if (m) {
        m.userData.uniforms.uFade.value = v;
        m.userData.uniforms.uBg.value.copy(bgNow);
      }
    };
    setFade('enamel', st.enamelFade);
    setFade('enamelCut', st.enamelFade);
    setFade('core', st.coreFade);
    setFade('coreCut', st.coreFade);
    setFade('enamelShell', st.enamelFade);
    setFade('coreShell', st.coreFade);
    setFade('pulp', st.coreFade * 0.6);
    this.quarterMats.forEach((m) => m.userData.uniforms.uBg.value.copy(bgNow));
    const pulp = this.mats.pulp;
    if (pulp) pulp.emissiveIntensity = 0.55 * st.pulpGlow;

    // raiz "entra" na gengiva ao pousar na arcada
    const clipY = lerp(-5, meta.cervicalY + 0.002, smoothstep(0, 1, st.rootClip));
    this.rootPlane.constant = -clipY;

    /* ---------- arcada ---------- */
    const archVis = st.arch > 0.001 || st.archTeeth > 0.001;
    this.arcade.visible = archVis;
    if (archVis) this.updateArcade(st);

    /* ---------- sombra de contato ---------- */
    const shadowAlpha = st.shadow * (1 - smoothstep(0.1, 0.6, st.arch));
    this.shadow.visible = shadowAlpha > 0.01;
    const sm = this.shadow.material as THREE.SpriteMaterial;
    sm.opacity = shadowAlpha * lerp(0.55, 0.9, st.dark);
    sm.color.set(this.colors.primaryDark);
    if (st.dark < 0.5) sm.color.lerp(new THREE.Color('#8a6a70'), 0.5 - st.dark);
    this.shadow.position.set(0, meta.bottom - 0.03 + st.toothRise, -0.15);
    this.shadow.scale.set(0.72, 0.075, 1);

    /* ---------- câmera ---------- */
    const a = smoothstep(0, 1, st.arch);
    const lift = st.enamelLift;
    const toothTarget = new THREE.Vector3(0, (meta.top + meta.bottom) / 2 + lift * 0.5 + st.toothRise * 0.3, 0);
    const toothFrameH = meta.top - meta.bottom + lift * 0.9;
    // altura projetada da arcada vista de cima; se a largura limitar, usa a largura
    const elA = Math.max(0.2, st.elevation * DEG);
    let archFrameH = this.archDepth * Math.sin(elA) + 0.55 * Math.cos(elA);
    if (archRect.w) archFrameH = Math.max(archFrameH, (this.archWidth * archRect.h) / archRect.w);
    archFrameH *= 1.06;
    const target = toothTarget.clone().lerp(this.archCenter, a);
    const frameH = Math.exp(lerp(Math.log(toothFrameH), Math.log(archFrameH), a));
    const rect: FrameRect = {
      cx: lerp(toothRect.cx, archRect.cx, a),
      cy: lerp(toothRect.cy, archRect.cy, a),
      h: Math.exp(lerp(Math.log(Math.max(1, toothRect.h)), Math.log(Math.max(1, archRect.h)), a)),
    };
    const fov = FOV * DEG;
    const dist = (frameH / 2 / Math.tan(fov / 2)) * (this.height / rect.h) * st.distance;
    const az = st.orbit * DEG;
    const el = st.elevation * DEG;
    this.camera.position.set(
      target.x + dist * Math.cos(el) * Math.sin(az),
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(el) * Math.cos(az),
    );
    this.camera.near = Math.max(0.05, dist * 0.2);
    this.camera.far = dist * 4 + 20;
    this.camera.lookAt(target);
    this.camera.setViewOffset(this.width, this.height, this.width / 2 - rect.cx, this.height / 2 - rect.cy, this.width, this.height);
    this.camera.updateProjectionMatrix();
  }

  private updateArcade(st: SceneState): void {
    const n = this.presets.length;
    const weights = new Array<number>(TOOTH_COUNT).fill(n ? 0 : 1);
    let wire = 0,
      gum = 0,
      implant = 0;
    if (n) {
      const s = Math.max(0, Math.min(n - 1, st.spec));
      const i0 = Math.floor(s);
      const i1 = Math.min(n - 1, i0 + 1);
      const f = smoothstep(0, 1, s - i0);
      const add = (p: SpecPreset, k: number) => {
        p.dentes.forEach((d) => (weights[d] = (weights[d] ?? 0) + k));
        if (p.efeito === 'aparelho') wire += k;
        if (p.efeito === 'gengiva') gum += k;
        if (p.efeito === 'implante') implant += k;
      };
      add(this.presets[i0]!, 1 - f);
      if (i1 !== i0) add(this.presets[i1]!, f);
    }
    const appear = st.archTeeth;
    const reveal = smoothstep(0.2, 1, appear);
    this.archTeeth.forEach((t) => {
      // onda: os dentes surgem a partir do dente da cena, em volta da curva
      const order = Math.abs(t.index - HERO_SLOT) / TOOTH_COUNT;
      const local = t.index === HERO_SLOT ? 1 : smoothstep(order * 0.75, order * 0.75 + 0.25, appear);
      const w = clamp01(weights[t.index]!) * reveal;
      const dim = lerp(0, 0.5, (1 - w) * reveal);
      if (t.index !== HERO_SLOT) {
        t.group.visible = local > 0.001;
        t.group.scale.setScalar(lerp(0.4, 1, local));
        t.group.position.set(t.base.x, lerp(-0.35, 0, local) + 0.035 * w, t.base.z);
        t.mats.forEach((m) => {
          m.userData.uniforms.uFade.value = 1 - local + dim * local;
          m.userData.uniforms.uBg.value.copy(this.bgLight);
          m.color.setRGB(1, 1, 1).lerp(new THREE.Color('#f6e2d6'), implant * w * 0.9);
        });
      } else {
        // o próprio dente da cena: esmaece como os demais quando não destacado
        ['enamel', 'core'].forEach((k) => {
          const m = this.mats[k]!;
          m.userData.uniforms.uFade.value = Math.max(m.userData.uniforms.uFade.value, dim);
          m.color.setRGB(1, 1, 1).lerp(new THREE.Color('#f6e2d6'), implant * w * 0.9);
        });
      }
      (t.ring.material as THREE.MeshBasicMaterial).opacity = w * 0.85 * local * (wire > 0.5 ? 0.45 : 1);
    });
    (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.16 * reveal;
    (this.gum.material as THREE.MeshStandardMaterial).opacity = 0.85 * gum * reveal;
    this.gum.visible = gum * reveal > 0.01;
    (this.wire.material as THREE.MeshStandardMaterial).opacity = wire * reveal;
    this.wire.visible = wire * reveal > 0.01;
    this.brackets.forEach((b) => {
      (b.material as THREE.MeshStandardMaterial).opacity = wire * reveal;
      b.visible = wire * reveal > 0.01;
    });
  }

  render(): void {
    if (!this.ready) return;
    this.renderer.render(this.scene, this.camera);
  }

  /** Projeta uma âncora anatômica (coordenadas do dente) para px do canvas. */
  project(name: string): { x: number; y: number; visible: boolean } {
    const p = this.meta?.anchors[name];
    if (!p) return { x: 0, y: 0, visible: false };
    const v = new THREE.Vector3(...p);
    const parent = name === 'esmalte' ? this.enamelHolder : this.toothRoot;
    parent.updateWorldMatrix(true, false);
    v.applyMatrix4(parent.matrixWorld);
    v.project(this.camera);
    return { x: ((v.x + 1) / 2) * this.width, y: ((1 - v.y) / 2) * this.height, visible: v.z < 1 };
  }

  /**
   * Retângulo em px do canvas ocupado pelo que está visível do dente ou da
   * arcada (amostra de vértices projetados). Usado pelo QA de sobreposição.
   */
  screenRect(target: 'tooth' | 'arcade' | THREE.Object3D, step = 7): { left: number; top: number; right: number; bottom: number } | null {
    const root = target === 'tooth' ? this.toothRoot : target === 'arcade' ? this.arcade : target;
    if (!root.visible) return null;
    root.updateWorldMatrix(true, true);
    const v = new THREE.Vector3();
    let l = Infinity,
      t = Infinity,
      r = -Infinity,
      b = -Infinity;
    root.traverseVisible((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.Material[];
      if (mats.every((x) => x.transparent && x.opacity < 0.05)) return;
      const pos = m.geometry.getAttribute('position');
      if (!pos) return;
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        // abaixo da gengiva (plano de corte) a raiz não aparece
        if (target !== 'tooth' || this.rootPlane.distanceToPoint(v) >= 0) {
          v.project(this.camera);
          const x = ((v.x + 1) / 2) * this.width;
          const y = ((1 - v.y) / 2) * this.height;
          if (x < l) l = x;
          if (x > r) r = x;
          if (y < t) t = y;
          if (y > b) b = y;
        }
      }
    });
    return l === Infinity ? null : { left: l, top: t, right: r, bottom: b };
  }

  /** Um retângulo por dente visível da arcada (a curva tem o miolo vazio). */
  archToothRects(): { left: number; top: number; right: number; bottom: number }[] {
    if (!this.arcade.visible) return [];
    return this.archTeeth.map((t) => (t.group.visible ? this.screenRect(t.group, 5) : null)).filter((r): r is NonNullable<typeof r> => !!r);
  }

  get info() {
    const r = this.renderer.info.render;
    return { triangles: r.triangles, calls: r.calls };
  }

  dispose(): void {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.renderer.dispose();
  }
}
