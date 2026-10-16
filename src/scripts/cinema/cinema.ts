/**
 * MODO CINEMA — o progresso da rolagem dirige a cena.
 *
 * Uma única timeline GSAP (ScrollTrigger com scrub) cobre a trilha
 * .cinema. A duração da timeline é medida em "alturas de tela" (vh) e cada
 * cena ativa ocupa um segmento [start, start + len] calculado no build
 * (Cinema.astro). A timeline anima:
 *   - `state`  → estado 3D (câmera, dente, camadas, arcada) lido pelo palco;
 *   - `cine`   → composição do palco no DOM (âncora do enquadramento, arco vinho);
 *   - textos e listas dos painéis (entradas e saídas).
 * Rolar para cima reverte tudo, porque tudo é função do progresso.
 *
 * Detalhes de keyframes e como ajustar: MOTION.md.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Stage3D } from '../three/stage';
import { defaultState, lerp, clamp01, type FrameRect, type SceneState } from '../three/state';
import { dpr, loadAssets, readColors, readPresets } from './shared';
import { espHooks, especialidadesApi } from '../ui/especialidades';

gsap.registerPlugin(ScrollTrigger);

interface Segment {
  id: 'inicio' | 'tratamentos' | 'especialidades';
  start: number;
  len: number;
}

/** Composição do palco no DOM. */
interface Cine {
  /** índice fracionário na lista de âncoras do dente (hero, trat-a, trat-b, trat-c) */
  anchor: number;
  /** forma do arco vinho: 0 arco do hero · 1 arco largo (quadro A) · 2 tela cheia · 3 recolhido */
  arch: number;
  archAlpha: number;
}

type Rect = { left: number; top: number; width: number; height: number };

export async function initCinema(): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-cinema]')!;
  const viewport = root.querySelector<HTMLElement>('[data-viewport]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-stage-canvas]')!;
  const archEl = root.querySelector<HTMLElement>('[data-stage-arch]')!;
  const leaders = Array.from(root.querySelectorAll<HTMLElement>('[data-leader]'));
  const segments = JSON.parse(root.dataset.segments || '[]') as Segment[];
  const seg = (id: Segment['id']) => segments.find((s) => s.id === id);
  const total = segments.reduce((a, s) => a + s.len, 0);
  const heroVisual = root.dataset.heroVisual === 'foto' ? 'foto' : '3d';
  const html = document.documentElement;

  /* ---------- ids das cenas passam para os marcadores (âncoras de navegação) ---------- */
  segments.forEach((s) => {
    const panel = document.getElementById(s.id);
    const marker = root.querySelector<HTMLElement>(`[data-cinema-marker="${s.id}"]`);
    if (panel && marker && panel !== marker) {
      panel.dataset.anchorId = s.id;
      panel.removeAttribute('id');
      marker.id = s.id;
    }
  });

  /* ---------- palco 3D ---------- */
  // o contexto WebGL é criado só depois do carregamento da página (ver start3D)
  let stage: Stage3D | null = null;
  const state: SceneState = { ...defaultState() };
  const cine: Cine = { anchor: 0, arch: 0, archAlpha: 1 };

  /* ---------- medidas (âncoras de composição) ---------- */
  let W = viewport.clientWidth;
  let H = viewport.clientHeight;
  let vpRect = viewport.getBoundingClientRect();
  const toothAnchorNames = ['hero', 'trat-a', 'trat-b', 'trat-c'];
  const rects: Record<string, FrameRect> = {};
  let heroArch: Rect = { left: W * 0.58, top: H * 0.17, width: W * 0.35, height: H * 0.83 };
  const rel = (el: Element | null): Rect | null => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left - vpRect.left, top: r.top - vpRect.top, width: r.width, height: r.height };
  };
  const toFrame = (r: Rect): FrameRect => ({ cx: r.left + r.width / 2, cy: r.top + r.height / 2, h: r.height, w: r.width });
  const measure = () => {
    W = viewport.clientWidth;
    H = viewport.clientHeight;
    vpRect = viewport.getBoundingClientRect();
    stage?.setSize(W, H, dpr(1.75));
    const ha = rel(root.querySelector('[data-hero-arch]'));
    if (ha) heroArch = ha;
    for (const name of [...toothAnchorNames, 'arcada']) {
      const r = rel(root.querySelector(`[data-anchor="${name}"]`));
      if (r && r.height > 0) rects[name] = toFrame(r);
    }
    // hero com foto: o dente nasce no enquadramento do quadro A, vindo de baixo
    if (!rects.hero) rects.hero = rects['trat-a'] ?? { cx: W * 0.5, cy: H * 0.5, h: H * 0.6 };
    if (!rects['trat-a']) rects['trat-a'] = rects.hero;
    if (!rects['trat-b']) rects['trat-b'] = rects['trat-a'];
    if (!rects['trat-c']) rects['trat-c'] = rects['trat-b'];
    if (!rects.arcada) rects.arcada = { cx: W * 0.66, cy: H * 0.5, h: H * 0.7, w: W * 0.55 };
    dirty = true;
  };
  const toothRect = (): FrameRect => {
    const i = Math.max(0, Math.min(toothAnchorNames.length - 1, cine.anchor));
    const a = rects[toothAnchorNames[Math.floor(i)]!]!;
    const b = rects[toothAnchorNames[Math.min(toothAnchorNames.length - 1, Math.floor(i) + 1)]!]!;
    const t = i - Math.floor(i);
    return { cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), h: lerp(a.h, b.h, t) };
  };

  /* ---------- arco vinho (clip-path animado) ---------- */
  type Shape = [number, number, number, number, number, number, number, number]; // t r b l rtx rty rbx rby
  const shapeAt = (s: number): Shape => {
    const k0: Shape = [
      heroArch.top,
      W - heroArch.left - heroArch.width,
      H - heroArch.top - heroArch.height,
      heroArch.left,
      heroArch.width / 2,
      heroArch.width / 2,
      0,
      0,
    ];
    const k1: Shape = [(24 / 900) * H, 0, 0, 0, W / 2, (300 / 900) * H, 0, 0];
    const k2: Shape = [0, 0, 0, 0, W / 2, 0, W / 2, 0];
    const k3: Shape = [0, 0, H * 1.35, 0, W / 2, 0, W / 2, H * 0.35];
    const ks = [k0, k1, k2, k3];
    const i = Math.max(0, Math.min(2, Math.floor(s)));
    const t = clamp01(s - i);
    const a = ks[i]!,
      b = ks[i + 1]!;
    return a.map((v, j) => lerp(v, b[j]!, t)) as Shape;
  };
  const applyArch = () => {
    const [t, r, b, l, rtx, rty, rbx, rby] = shapeAt(cine.arch);
    archEl.style.clipPath = `inset(${t.toFixed(1)}px ${r.toFixed(1)}px ${b.toFixed(1)}px ${l.toFixed(1)}px round ${rtx.toFixed(1)}px ${rtx.toFixed(1)}px ${rbx.toFixed(1)}px ${rbx.toFixed(1)}px / ${rty.toFixed(1)}px ${rty.toFixed(1)}px ${rby.toFixed(1)}px ${rby.toFixed(1)}px)`;
    archEl.style.opacity = String(cine.archAlpha);
    const dark = cine.archAlpha > 0.5 && cine.arch > 0.55 && cine.arch < 2.42;
    const surface = dark ? 'dark' : 'light';
    if (inView && html.dataset.surface !== surface) {
      html.dataset.surface = surface;
      document.dispatchEvent(new Event('surfacechange'));
    }
  };

  /* ---------- legendas anatômicas presas ao modelo ---------- */
  const labels = Array.from(root.querySelectorAll<HTMLElement>('.trat__label[data-label]'));
  const updateLeaders = () => {
    if (!stage) return;
    const st3 = stage;
    labels.forEach((label) => {
      const id = label.dataset.label!;
      const leader = leaders.find((l) => l.dataset.leader === id);
      const op = Number(getComputedStyle(label).opacity);
      if (!leader) return;
      if (op < 0.01) {
        leader.style.opacity = '0';
        return;
      }
      const p = st3.project(id);
      const labelLeft = label.getBoundingClientRect().left - vpRect.left;
      label.style.top = `${(p.y - 9).toFixed(1)}px`;
      leader.style.opacity = String(op);
      leader.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      leader.style.setProperty('--len', `${Math.max(0, labelLeft - p.x - 14).toFixed(1)}px`);
    });
  };

  /* ---------- timeline ---------- */
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  const q = <T extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll<T>(sel));
  const one = (sel: string) => root.querySelector<HTMLElement>(sel);
  const S = (props: Partial<SceneState>, at: number, dur: number, ease = 'power1.inOut') =>
    tl.to(state, { ...props, duration: dur, ease }, at);
  const Cn = (props: Partial<Cine>, at: number, dur: number, ease = 'power1.inOut') => tl.to(cine, { ...props, duration: dur, ease }, at);
  const enter = (targets: gsap.TweenTarget, at: number, dur: number, from: gsap.TweenVars, stagger = 0) => {
    if (!targets || (Array.isArray(targets) && !targets.length)) return;
    gsap.set(targets, { ...from });
    tl.to(targets, { opacity: 1, x: 0, y: 0, duration: dur, stagger, ease: 'power2.out' }, at);
  };
  const exit = (targets: gsap.TweenTarget, at: number, dur: number, to: gsap.TweenVars, stagger = 0) => {
    if (!targets || (Array.isArray(targets) && !targets.length)) return;
    tl.to(targets, { opacity: 0, ...to, duration: dur, stagger, ease: 'power2.in' }, at);
  };

  const hero = seg('inicio')!;
  const trat = seg('tratamentos');
  const esp = seg('especialidades');
  const nextAfterHero = trat ? 'tratamentos' : esp ? 'especialidades' : null;

  // estado inicial (progresso 0 = artboard Main)
  Object.assign(state, {
    toothRotY: -22,
    toothRotZ: -9,
    elevation: 4,
    dark: 1,
    idle: 1,
    toothRise: heroVisual === 'foto' ? -3 : 0,
    shadow: heroVisual === 'foto' ? 0 : 1,
  });

  /* ===== 00 · Hero → próxima cena ===== */
  {
    const h0 = hero.start;
    const L = hero.len;
    const copy = one('[data-cine="hero-copy"]');
    const bottom = one('[data-cine="hero-quick"]');
    const archLine = one('[data-hero-arch-line]');
    const hint = one('.hero__scroll');
    const photo = one('.hero__photo');
    exit(copy, h0 + 0.02 * L, 0.42 * L, { y: -48 });
    exit(bottom, h0, 0.32 * L, { y: 24 });
    exit(archLine, h0, 0.3 * L, { scale: 1.04 });
    exit(hint, h0, 0.18 * L, { y: 12 });
    if (photo) exit(photo, h0 + 0.05 * L, 0.35 * L, { scale: 1.06 });
    if (nextAfterHero === 'tratamentos') {
      Cn({ anchor: 1 }, h0, L, 'power1.inOut');
      Cn({ arch: 1 }, h0 + 0.04 * L, 0.92 * L, 'power2.inOut');
      S({ toothRotY: -20, toothRotZ: -6, elevation: 2, idle: 0.35 }, h0, L);
      // hero com foto: o dente sobe para a cena a partir de baixo
      S({ toothRise: 0, shadow: 1 }, h0 + (heroVisual === 'foto' ? 0.3 : 0) * L, (heroVisual === 'foto' ? 0.7 : 1) * L, 'power2.out');
    } else if (nextAfterHero === 'especialidades') {
      Cn({ archAlpha: 0 }, h0 + 0.1 * L, 0.45 * L);
      S({ idle: 0, toothRise: 0, toothRotZ: 0 }, h0, 0.4 * L);
    } else {
      S({ toothRotY: 20, idle: 0.6 }, h0, L);
    }
  }

  /* ===== 01 · Tratamentos: quadros A → B → C ===== */
  if (trat) {
    const t0 = trat.start;
    const L = trat.len; // 3 telas
    const T = (f: number) => t0 + f * L; // f = fração da cena (storyboard)
    const D = (f: number) => f * L;
    const a = one('[data-cine="trat-a"]');
    const hint = one('[data-cine="trat-hint"]');
    const bText = one('[data-cine="trat-b"]');
    const cHead = one('.trat__c-head');
    const items = q('[data-cine="trat-list"] li');
    const listEl = one('[data-cine="trat-list"]');
    const cta = one('[data-cine="trat-cta"]');
    const hero0 = hero.start + hero.len;
    // A entra no fim da transição do hero
    enter(a, hero0 - 0.42 * hero.len, 0.36 * hero.len, { opacity: 0, y: 28 });
    enter(hint, hero0 - 0.2 * hero.len, 0.18 * hero.len, { opacity: 0, x: -12 });
    // Quadro A (0–15%): dente gira −20° → 0°
    S({ toothRotY: 0, toothRotZ: -2, idle: 0 }, T(0), D(0.15));
    Cn({ arch: 2 }, T(0.06), D(0.16), 'power2.inOut');
    exit(a, T(0.15), D(0.08), { y: -40 });
    exit(hint, T(0.1), D(0.06), { x: 12 });
    // Quadro B (15–55%): órbita 35°, desce, aproxima; corte; esmalte sobe; polpa brilha
    Cn({ anchor: 2 }, T(0.15), D(0.25));
    S({ orbit: 35, elevation: -5, distance: 0.95, toothRotZ: 0 }, T(0.15), D(0.4));
    S({ cut: 1 }, T(0.17), D(0.24), 'power2.out');
    S({ enamelLift: 0.105 }, T(0.22), D(0.28), 'power2.inOut');
    S({ pulpGlow: 1 }, T(0.3), D(0.24));
    enter(bText, T(0.25), D(0.09), { opacity: 0, y: 26 });
    enter(labels, T(0.32), D(0.07), { opacity: 0, x: 16 }, D(0.045));
    exit(labels, T(0.6), D(0.05), { x: 10 }, D(0.012));
    exit(bText, T(0.6), D(0.07), { y: -32 });
    // Quadro C (55–100%): câmera recua, dente vai ao terço esquerdo, esmalte se afasta
    Cn({ anchor: 3 }, T(0.55), D(0.2));
    S({ enamelLift: 0.25, enamelTilt: -8 }, T(0.55), D(0.22), 'power2.inOut');
    S({ orbit: 26, elevation: 3, distance: 1 }, T(0.55), D(0.25));
    S({ idle: 0.55 }, T(0.72), D(0.08));
    enter(cHead, T(0.66), D(0.07), { opacity: 0, y: 24 });
    enter(listEl, T(0.67), D(0.03), { opacity: 0 });
    enter(items, T(0.68), D(0.06), { opacity: 0, x: 56 }, Math.min(D(0.02), D(0.18) / Math.max(1, items.length)));
    enter(cta, T(0.88), D(0.05), { opacity: 0, y: 16 });
  }

  /* ===== 02 · Especialidades: o dente vira arcada ===== */
  if (esp) {
    const e0 = esp.start;
    const n = Math.max(1, especialidadesApi()?.count ?? 1);
    if (trat) {
      // saída do quadro C + reconstrução do dente
      exit(q('[data-cine="trat-list"] li'), e0, 0.16, { x: 30 }, 0.01);
      exit(one('[data-cine="trat-list"]'), e0 + 0.12, 0.06, {});
      exit(one('.trat__c-head'), e0 + 0.02, 0.16, { y: -24 });
      exit(one('[data-cine="trat-cta"]'), e0, 0.12, { y: 12 });
      S({ idle: 0 }, e0, 0.15);
      S({ enamelLift: 0, enamelTilt: 0, cut: 0, pulpGlow: 0 }, e0 + 0.05, 0.32, 'power2.inOut');
      Cn({ arch: 3 }, e0 + 0.14, 0.42, 'power2.inOut');
    }
    S({ dark: 0, shadow: 0 }, e0 + 0.3, 0.22);
    S({ arch: 1, elevation: 48, orbit: 0, toothRotY: -93, toothRotZ: 0, toothRise: 0, distance: 1 }, e0 + 0.34, 0.54, 'power2.inOut');
    S({ rootClip: 1 }, e0 + 0.42, 0.32);
    S({ archTeeth: 1 }, e0 + 0.55, 0.45, 'power1.out');
    const copy = one('[data-cine="esp-copy"]');
    const head = copy ? Array.from(copy.querySelectorAll<HTMLElement>('[data-eyebrow], .esp__title')) : [];
    const items = q('[data-cine="esp-list"] li');
    enter(one('[data-cine="esp-list"]'), e0 + 0.69, 0.04, { opacity: 0 });
    enter(head, e0 + 0.6, 0.22, { opacity: 0, y: 30 }, 0.05);
    enter(items, e0 + 0.7, 0.16, { opacity: 0, x: -24 }, Math.min(0.04, 0.24 / items.length));
    enter(one('[data-cine="esp-detail"]'), e0 + 0.86, 0.14, { opacity: 0, y: 18 });
    enter(one('.esp__note'), e0 + 0.9, 0.1, { opacity: 0 });
    // progressão pela rolagem: segura cada especialidade e passa para a próxima
    for (let i = 1; i < n; i++) S({ spec: i }, e0 + 1 + (i - 1) * 0.55 + 0.35, 0.2, 'power2.inOut');
  }
  tl.set({}, {}, total);

  /* ---------- ScrollTrigger ---------- */
  let dirty = true;
  let inView = true;
  let lastSpec = -1;
  const panels = q<HTMLElement>('[data-panel]');
  const activePanel = (time: number) => {
    let id = 'hero';
    if (trat && time >= trat.start + 0.1) id = 'tratamentos';
    if (esp && time >= esp.start + 0.55) id = 'especialidades';
    if (!trat && esp && time < esp.start + 0.55) id = 'hero';
    if (time < hero.start + hero.len * 0.5) id = 'hero';
    return id;
  };
  const onTime = () => {
    dirty = true;
    const time = tl.time();
    const act = activePanel(time);
    panels.forEach((p) => p.classList.toggle('is-active', p.dataset.panel === act));
    if (esp) {
      const api = especialidadesApi();
      const i = Math.round(state.spec);
      if (api && i !== lastSpec) {
        lastSpec = i;
        api.select(i, 'scroll');
      }
    }
  };
  const st = ScrollTrigger.create({
    trigger: root,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.7,
    animation: tl,
    invalidateOnRefresh: false,
    onUpdate: onTime,
    onRefresh: () => {
      measure();
      onTime();
    },
    onToggle: (self) => {
      // a visibilidade real vem do IntersectionObserver; aqui só o tom de fundo
      if (!self.isActive) {
        delete html.dataset.surface;
        document.dispatchEvent(new Event('surfacechange'));
      }
    },
  });
  tl.eventCallback('onUpdate', onTime);
  html.classList.add('cinema-ready');

  /* ---------- navegação: âncoras, foco e cliques na lista ---------- */
  const scrollTop = () => window.scrollY + root.getBoundingClientRect().top;
  const timeToY = (t: number) => scrollTop() + (t / total) * (st.end - st.start);
  espHooks.scrollTo = (i: number) => {
    if (!esp) return false;
    window.scrollTo({ top: timeToY(esp.start + 1 + i * 0.55 + 0.15), behavior: 'smooth' });
    return true;
  };
  // Ao navegar por teclado, leva a rolagem ao trecho em que o elemento focado está visível.
  const focusTime = (el: HTMLElement): number | null => {
    const spec = el.closest<HTMLElement>('[data-spec-index]');
    if (spec && esp) return esp.start + 1 + Number(spec.dataset.specIndex) * 0.55 + 0.15;
    const g = el.closest<HTMLElement>('[data-cine]')?.dataset.cine ?? '';
    if (g.startsWith('hero')) return 0;
    if (trat && g === 'trat-a') return trat.start + 0.3;
    if (trat && (g === 'trat-b' || g === 'trat-labels')) return trat.start + 1.4;
    if (trat && g.startsWith('trat')) return trat.start + 2.9;
    if (esp && g.startsWith('esp')) return esp.start + 1.02;
    return null;
  };
  root.addEventListener('focusin', (e) => {
    const t = focusTime(e.target as HTMLElement);
    if (t === null) return;
    if (Math.abs(tl.time() - t) > 0.12) window.scrollTo({ top: timeToY(t), behavior: 'auto' });
  });
  const goToHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const s = segments.find((x) => x.id === id);
    if (s) window.scrollTo({ top: timeToY(s.start + (s.id === 'inicio' ? 0 : s.id === 'tratamentos' ? 0.02 : 0.98)), behavior: 'auto' });
  };
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href*="#"]');
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname) return;
    const s = segments.find((x) => x.id === url.hash.slice(1));
    if (!s) return;
    e.preventDefault();
    history.pushState(null, '', url.hash);
    const target = timeToY(s.start + (s.id === 'inicio' ? 0 : s.id === 'tratamentos' ? 0.02 : 0.98));
    window.scrollTo({ top: target, behavior: 'smooth' });
  });

  /* ---------- laço de renderização ---------- */
  measure();
  applyArch();
  if (location.hash) requestAnimationFrame(goToHash);

  let first = true;
  const io = new IntersectionObserver(([en]) => (inView = !!en?.isIntersecting), { rootMargin: '0px' });
  io.observe(root);
  gsap.ticker.add((_t, deltaMs) => {
    if (!inView) return;
    const idle = state.idle > 0.001 && !!stage?.ready;
    if (!dirty && !idle) return;
    dirty = false;
    applyArch(); // o arco (DOM) anima mesmo antes do 3D
    if (!stage?.ready) return;
    if (idle) stage.tick(Math.min(0.05, deltaMs / 1000));
    stage.apply(state, toothRect(), rects.arcada!);
    stage.render();
    updateLeaders();
    if (first) {
      first = false;
      html.classList.add('stage-ready');
    }
  });
  window.addEventListener('resize', () => ScrollTrigger.refresh());
  (window as unknown as { __cinema: unknown }).__cinema = {
    tl,
    state,
    cine,
    segments,
    st,
    get stage() {
      return stage;
    },
  };

  /* ---------- 3D: depois do carregamento (o SVG do design cobre o intervalo) ---------- */
  await afterLoad();
  try {
    stage = new Stage3D(canvas, readColors());
  } catch (err) {
    // sem WebGL de verdade: recarrega no modo estático
    sessionStorage.setItem('alva:no-webgl', '1');
    window.location.reload();
    throw err;
  }
  stage.setPresets(readPresets());
  stage.setSize(W, H, dpr(1.75));
  const assets = await loadAssets('cinema', (refined) => {
    stage?.setAssets(refined);
    dirty = true;
  });
  stage.setAssets(assets);
  stage.apply(state, toothRect(), rects.arcada!);
  await stage.warmup();
  measure();
  dirty = true;
}

/** Resolve após o evento load + um instante ocioso (ou na primeira rolagem). */
function afterLoad(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      resolve();
    };
    window.addEventListener('wheel', go, { once: true, passive: true });
    window.addEventListener('keydown', go, { once: true });
    const idle = () => {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o: { timeout: number }) => void }).requestIdleCallback;
      if (ric) ric(go, { timeout: 800 });
      else window.setTimeout(go, 300);
    };
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
  });
}
