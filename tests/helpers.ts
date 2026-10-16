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
    { timeout: 60_000, polling: 150 },
  );
}

export async function cinemaState(page: Page) {
  return page.evaluate(() => {
    const c = (window as any).__cinema;
    return { ...c.state, time: c.tl.time(), anchor: c.cine.anchor, shape: c.cine.arch, cam: c.stage.camera.position.toArray() as number[] };
  });
}
