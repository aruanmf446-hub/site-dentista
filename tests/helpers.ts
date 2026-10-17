import type { Page, ConsoleMessage } from '@playwright/test';
import { VARIANTS } from '../scripts/variants.mjs';

export type Variant = keyof typeof VARIANTS;

export const url = (v: Variant, path = '/') => `http://127.0.0.1:${VARIANTS[v]}${path}`;

/** Coleta erros de console e exceções da página. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Rotas publicadas da variante (a partir do sitemap gerado). */
export async function routes(page: Page, v: Variant): Promise<string[]> {
  const res = await page.request.get(url(v, '/sitemap.xml'));
  const xml = await res.text();
  return [...xml.matchAll(/<loc>[^<]*?(\/[^<]*)<\/loc>/g)].map((m) => new URL(m[0].replace(/<\/?loc>/g, '')).pathname);
}

/** Espera o palco 3D ficar pronto (cinema) ou as vistas (empilhado). */
export async function waitScene(page: Page) {
  await page.waitForFunction(
    () => {
      const c = document.documentElement.classList;
      return c.contains('stage-ready') || c.contains('views-ready') || c.contains('no-webgl');
    },
    null,
    { timeout: 60_000 },
  );
}

/** Rola até a fração `p` da sequência cinematográfica e espera a timeline alcançar. */
export async function scrollCinema(page: Page, p: number) {
  await page.evaluate((p) => {
    const c = document.querySelector<HTMLElement>('[data-cinema]')!;
    const top = window.scrollY + c.getBoundingClientRect().top;
    window.scrollTo(0, Math.round(top + p * (c.offsetHeight - window.innerHeight)));
  }, p);
  // espera o ScrollTrigger registrar a nova posição E a timeline (scrub) alcançá-la
  await page.waitForFunction(
    (p) => {
      const c = (window as any).__cinema;
      if (!c) return false;
      return Math.abs(c.st.progress - p) < 0.003 && Math.abs(c.tl.time() - c.st.progress * c.tl.duration()) < 0.01;
    },
    p,
    { timeout: 120_000, polling: 150 },
  );
}

export async function cinemaState(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).__cinema;
    return { ...c.state, time: c.tl.time(), anchor: c.cine.anchor, shape: c.cine.arch, cam: c.stage.camera.position.toArray() as number[] };
  });
}

/**
 * Estado real dos objetos Three.js (não só das variáveis da timeline) e uma
 * assinatura dos pixels do canvas WebGL lida logo após um quadro desenhado.
 */
export async function sceneObjects(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).__cinema;
    const s = c.stage;
    s.render();
    const gl: WebGLRenderingContext = s.renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const px = new Uint8Array(4);
    const sig: number[] = [];
    let opaque = 0;
    for (let j = 1; j < 16; j++)
      for (let i = 1; i < 16; i++) {
        gl.readPixels(Math.floor((i / 16) * w), Math.floor((j / 16) * h), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        sig.push(px[0]! + px[1]! + px[2]!);
        if (px[3]! > 8) opaque++;
      }
    const v = (o: any) => o.getWorldPosition(new (o.position.constructor as any)()).toArray().map((x: number) => +x.toFixed(4));
    return {
      toothPos: v(s.toothRoot) as number[],
      toothRot: [s.toothRoot.rotation.x, s.toothRoot.rotation.y, s.toothRoot.rotation.z].map((x: number) => +x.toFixed(4)),
      enamelY: +s.enamelPivot.position.y.toFixed(4),
      cutVisible: !!s.cutGroup.visible,
      wholeVisible: !!s.wholeGroup.visible,
      arcadeVisible: !!s.arcade.visible,
      archTeethVisible: (s.archTeeth as any[]).filter((t) => t.group.visible).length,
      cam: s.camera.position.toArray().map((x: number) => +x.toFixed(4)) as number[],
      opaque,
      sig,
    };
  });
}

/** Fração de amostras de pixel que mudaram de forma perceptível entre duas assinaturas. */
export function sigDiff(a: number[], b: number[]) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i]! - b[i]!) > 24) n++;
  return n / a.length;
}
