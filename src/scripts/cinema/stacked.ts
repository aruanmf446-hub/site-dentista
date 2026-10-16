/**
 * MODO EMPILHADO — mobile, "reduzir movimento" ou desktop estreito.
 *
 * Um único renderizador WebGL fora da tela desenha cada vista ([data-view])
 * no seu próprio <canvas> 2D, que rola junto com a página (sem atraso
 * entre rolagem e desenho). Vistas:
 *   hero          → dente girando devagar, acompanha a rolagem do hero
 *   tratamentos   → abas por camada (esmalte, dentina e polpa, raiz)
 *   especialidades→ arcada com o destaque da especialidade escolhida
 * Com movimento reduzido: quadros estáticos (quadro C nos tratamentos).
 */
import { gsap } from 'gsap';
import { Stage3D } from '../three/stage';
import { defaultState, type SceneState } from '../three/state';
import { dpr, loadAssets, readColors, readPresets } from './shared';
import { espHooks, especialidadesApi } from '../ui/especialidades';

interface View {
  name: 'hero' | 'tratamentos' | 'especialidades';
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: SceneState;
  visible: boolean;
  dirty: boolean;
  live: boolean;
}

const LAYERS: Record<string, Partial<SceneState>> = {
  esmalte: { cut: 0, enamelLift: 0.17, enamelTilt: -4, enamelFade: 0, coreFade: 0.5, pulpGlow: 0, orbit: 16, elevation: 6, toothRise: -0.04 },
  'dentina-polpa': { cut: 1, enamelLift: 0.24, enamelTilt: -8, enamelFade: 0.6, coreFade: 0, pulpGlow: 1, orbit: 28, elevation: 2, toothRise: 0 },
  raiz: { cut: 1, enamelLift: 0.3, enamelTilt: -8, enamelFade: 0.72, coreFade: 0, pulpGlow: 0.5, orbit: -18, elevation: -6, toothRise: 0.06 },
};

export async function initStacked(): Promise<void> {
  const html = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const offscreen = document.createElement('canvas');
  const stage = new Stage3D(offscreen, readColors(), { antialias: true });
  stage.setPresets(readPresets());

  const views: View[] = [];
  const mk = (name: View['name'], extra: Partial<SceneState>) => {
    const canvas = document.querySelector<HTMLCanvasElement>(`canvas[data-view="${name}"]`);
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    views.push({ name, canvas, ctx, state: { ...defaultState(), ...extra }, visible: false, dirty: true, live: false });
  };
  mk('hero', { toothRotY: -22, toothRotZ: -9, elevation: 4, idle: reduced ? 0 : 1, dark: 1 });
  mk('tratamentos', reduced
    ? { toothRotY: 0, toothRotZ: 0, orbit: 26, elevation: 3, cut: 1, enamelLift: 0.25, enamelTilt: -8, pulpGlow: 1, idle: 0, dark: 1 }
    : { toothRotY: 0, toothRotZ: 0, idle: 0, dark: 1, ...LAYERS.esmalte });
  mk('especialidades', {
    arch: 1,
    archTeeth: 1,
    rootClip: 1,
    toothRotY: -93,
    toothRotZ: 0,
    elevation: 48,
    orbit: 0,
    dark: 0,
    shadow: 0,
    idle: 0,
    spec: 0,
  });
  if (!views.length) return;

  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        const v = views.find((x) => x.canvas === en.target);
        if (v) {
          v.visible = en.isIntersecting;
          v.dirty = true;
        }
      }),
    { rootMargin: '120px 0px' },
  );
  views.forEach((v) => io.observe(v.canvas));

  // abas por camada (tratamentos)
  const tabs = document.querySelector<HTMLElement>('[data-layer-tabs]');
  const svgLayers = document.querySelector<HTMLElement>('[data-layers-svg]');
  const tratView = views.find((v) => v.name === 'tratamentos');
  tabs?.addEventListener('tabchange', (e) => {
    const id = (e as CustomEvent<{ id: string }>).detail.id;
    if (svgLayers) svgLayers.dataset.layer = id;
    const target = LAYERS[id];
    if (!tratView || !target) return;
    if (reduced) Object.assign(tratView.state, target);
    else gsap.to(tratView.state, { ...target, duration: 0.9, ease: 'power3.inOut', onUpdate: () => (tratView.dirty = true) });
    tratView.dirty = true;
  });

  // especialidades: o clique troca o destaque
  const espView = views.find((v) => v.name === 'especialidades');
  espHooks.onSelect = (i) => {
    if (!espView) return;
    if (reduced) espView.state.spec = i;
    else gsap.to(espView.state, { spec: i, duration: 0.7, ease: 'power2.inOut', onUpdate: () => (espView.dirty = true) });
    espView.dirty = true;
  };
  const api = especialidadesApi();
  if (espView && api) espView.state.spec = 0;

  // rolagem do hero gira o dente (3D real ligado à rolagem também no mobile)
  const heroView = views.find((v) => v.name === 'hero');
  const heroSection = document.querySelector<HTMLElement>('[data-panel="hero"]');
  const onScroll = () => {
    if (!heroView || !heroSection || reduced) return;
    const r = heroSection.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
    heroView.state.toothRotY = -22 + p * 50;
    heroView.state.elevation = 4 + p * 10;
    heroView.dirty = true;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const draw = (v: View) => {
    const r = v.canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const ratio = dpr(2);
    const w = Math.round(r.width * ratio);
    const h = Math.round(r.height * ratio);
    if (v.canvas.width !== w || v.canvas.height !== h) {
      v.canvas.width = w;
      v.canvas.height = h;
    }
    stage.setSize(r.width, r.height, ratio);
    const full = { cx: r.width / 2, cy: r.height / 2, h: r.height * (v.name === 'hero' ? 1 : 0.86) };
    stage.apply(v.state, full, { cx: r.width / 2, cy: r.height * 0.52, h: r.height * 0.95, w: r.width * 0.98 });
    stage.render();
    v.ctx.clearRect(0, 0, w, h);
    v.ctx.drawImage(stage.renderer.domElement, 0, 0, w, h);
    if (!v.live) {
      v.live = true;
      v.canvas.classList.add('is-live');
      html.classList.add('views-ready');
    }
  };

  const assets = await loadAssets('stacked', (refined) => {
    stage.setAssets(refined);
    views.forEach((v) => (v.dirty = true));
  });
  stage.setAssets(assets);
  await stage.warmup();

  let last = performance.now();
  let acc = 0;
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt;
    stage.tick(dt);
    // movimento ocioso a ~30 fps no mobile (economia de bateria)
    const idleFrame = acc >= 1 / 30;
    if (idleFrame) acc = 0;
    for (const v of views) {
      if (!v.visible) continue;
      if (v.dirty || (v.state.idle > 0.001 && idleFrame)) {
        v.dirty = false;
        draw(v);
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.addEventListener('resize', () => views.forEach((v) => (v.dirty = true)));
  (window as unknown as { __stacked: unknown }).__stacked = { views, stage };
}
