/**
 * Comparação visual com os artboards do Claude Design.
 *
 * 1. Renderiza cada artboard (design/claude-design/*.dc.html) → referência.
 * 2. Captura o site no estado equivalente (mesma largura/altura e ponto da rolagem).
 * 3. Gera imagem lado a lado + diferença de pixels (tests/.artifacts/visual/).
 * 4. Verifica métricas de layout (posição/tamanho de título, arco, formulário)
 *    contra as coordenadas do design, com tolerância.
 *
 * A diferença de pixels é informativa: o site usa o dente 3D real, conteúdo
 * dinâmico e animações; as métricas é que garantem a composição.
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { renderArtboard } from './dc-render';
import { url, waitScene, scrollCinema } from '../helpers';

const OUT = 'tests/.artifacts/visual';
const DESIGN = 'design/claude-design';
fs.mkdirSync(OUT, { recursive: true });
const report: Record<string, unknown> = {};

async function reference(page: Page, file: string, crop?: { y: number; h: number }): Promise<Buffer> {
  const { html, width, height } = renderArtboard(path.join(DESIGN, file));
  await page.setViewportSize({ width, height: crop ? crop.h : height });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  if (crop) {
    await page.setViewportSize({ width, height });
    return page.screenshot({ clip: { x: 0, y: crop.y, width, height: crop.h } });
  }
  return page.screenshot();
}

function compare(name: string, ref: Buffer, ours: Buffer) {
  const a = PNG.sync.read(ref);
  const b = PNG.sync.read(ours);
  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  const crop = (img: PNG) => {
    const out = new PNG({ width: w, height: h });
    PNG.bitblt(img, out, 0, 0, w, h, 0, 0);
    return out;
  };
  const A = crop(a);
  const B = crop(b);
  const diff = new PNG({ width: w, height: h });
  const n = pixelmatch(A.data, B.data, diff.data, w, h, { threshold: 0.18 });
  const side = new PNG({ width: w * 2 + 24, height: h });
  side.data.fill(255);
  PNG.bitblt(A, side, 0, 0, w, h, 0, 0);
  PNG.bitblt(B, side, 0, 0, w, h, w + 24, 0);
  fs.writeFileSync(`${OUT}/${name}-lado-a-lado.png`, PNG.sync.write(side));
  fs.writeFileSync(`${OUT}/${name}-diferenca.png`, PNG.sync.write(diff));
  const ratio = n / (w * h);
  report[name] = { ...(report[name] as object), pixelsDiferentes: +(ratio * 100).toFixed(1) + '%' };
  return ratio;
}

async function rect(page: Page, sel: string) {
  const r = await page.locator(sel).first().boundingBox();
  if (!r) throw new Error(`sem caixa: ${sel}`);
  return r;
}
const near = (value: number, target: number, tol: number, label: string) =>
  expect(Math.abs(value - target), `${label}: ${value.toFixed(1)} (design ${target} ± ${tol})`).toBeLessThanOrEqual(tol);

test.describe.configure({ mode: 'serial' });
test.afterAll(() => fs.writeFileSync(`${OUT}/relatorio.json`, JSON.stringify(report, null, 2)));

test('Main (hero, 0%) — 1440×900', async ({ page, browser }) => {
  test.setTimeout(200_000);
  const ref = await reference(page, 'Main.dc.html');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(url('alva-demo', '/'));
  await waitScene(p);
  await p.waitForTimeout(1200);
  const ours = await p.screenshot();
  compare('01-main', ref, ours);
  // métricas do artboard Main
  const h1 = await rect(p, '#hero-title');
  near(h1.x, 96, 4, 'título: x');
  const fs1 = await p.locator('#hero-title').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  near(fs1, 94, 2, 'título: tamanho da fonte');
  const arch = await rect(p, '[data-hero-arch]');
  near(arch.x, 830, 24, 'arco: x');
  near(arch.y, 156, 24, 'arco: y');
  near(arch.width, 500, 24, 'arco: largura');
  near(arch.y + arch.height, 900, 2, 'arco: encosta na base');
  const form = await rect(p, '.quick__form');
  near(form.x, 96, 4, 'agendamento rápido: x');
  near(form.y, 724, 40, 'agendamento rápido: y');
  near(form.height, 76, 2, 'agendamento rápido: altura');
  const header = await rect(p, '.hdr-full__inner');
  near(header.height, 88, 1, 'header: altura');
  report['01-main'] = { ...(report['01-main'] as object), metricas: 'ok' };
  await ctx.close();
});

test('Tratamentos — quadros A, B e C do storyboard', async ({ page, browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(url('alva-demo', '/'));
  await waitScene(p);
  const segs = await p.evaluate(() => (window as any).__cinema.segments as { id: string; start: number; len: number }[]);
  const total = segs.reduce((a, s) => a + s.len, 0);
  const t = segs.find((s) => s.id === 'tratamentos')!;
  for (const [name, y, local] of [
    ['02-quadro-a', 440, 0.12],
    ['03-quadro-b', 1660, 1.5],
    ['04-quadro-c', 2880, 2.9],
  ] as const) {
    const ref = await reference(page, 'Tratamentos.dc.html', { y, h: 900 });
    await scrollCinema(p, (t.start + local) / total);
    await p.waitForTimeout(500);
    compare(name, ref, await p.screenshot());
  }
  // quadro C: lista à direita (x ≈ 700) e dente no terço esquerdo
  const list = await rect(p, '.trat__c-title');
  near(list.x, 700, 32, 'quadro C: título da lista x');
  const anchor = await rect(p, '[data-anchor="trat-c"]');
  expect(anchor.x + anchor.width / 2).toBeLessThan(1440 / 3 + 40);
  await ctx.close();
});

test('Especialidades (50%) — 1440×900, Implantodontia ativa', async ({ page, browser }) => {
  test.setTimeout(200_000);
  const ref = await reference(page, 'Especialidades.dc.html');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(url('alva-demo', '/'));
  await waitScene(p);
  const segs = await p.evaluate(() => (window as any).__cinema.segments as { id: string; start: number; len: number }[]);
  const total = segs.reduce((a, s) => a + s.len, 0);
  const e = segs.find((s) => s.id === 'especialidades')!;
  await scrollCinema(p, (e.start + 1 + 0.55 + 0.15) / total);
  await p.waitForTimeout(600);
  compare('05-especialidades', ref, await p.screenshot());
  const title = await rect(p, '#esp-title');
  near(title.x, 96, 4, 'título: x');
  const fsz = await p.locator('#esp-title').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  near(fsz, 58, 2, 'título: tamanho');
  const item = await rect(p, '.esp__item');
  near(item.height, 58, 2, 'item da lista: altura');
  const arc = await rect(p, '[data-anchor="arcada"]');
  near(arc.x, 560, 30, 'arcada: x');
  near(arc.width, 800, 30, 'arcada: largura');
  await expect(p.locator('[data-spec-index="1"]')).toHaveAttribute('aria-pressed', 'true');
  await ctx.close();
});

test('Agendar (100%) — 1440×900', async ({ page, browser }) => {
  test.setTimeout(200_000);
  const ref = await reference(page, 'Agendar.dc.html');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(url('alva-demo', '/contato/'));
  await p.waitForTimeout(800);
  compare('06-agendar', ref, await p.screenshot());
  const fsz = await p.locator('#ct-title').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  near(fsz, 78, 2, 'título: tamanho');
  const arch = await rect(p, '.ag__arch');
  near(arch.width, 544, 30, 'arco do formulário: largura');
  near(arch.x, 740, 40, 'arco do formulário: x');
  await ctx.close();
});

test('Clínica (75%) — trecho "A clínica"', async ({ page, browser }) => {
  test.setTimeout(200_000);
  const ref = await reference(page, 'Clinica.dc.html', { y: 0, h: 900 });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(url('alva-demo', '/'));
  await p.evaluate(() => {
    const s = document.getElementById('sobre')!;
    window.scrollTo(0, window.scrollY + s.getBoundingClientRect().top - 130);
  });
  await p.waitForTimeout(800);
  compare('07-clinica', ref, await p.screenshot());
  const f1 = await rect(p, '.sobre__fig--1 .arch');
  near(f1.width, 340, 20, 'foto 1: largura');
  near(f1.height, 500, 20, 'foto 1: altura');
  await ctx.close();
});

for (const [file, name, sel] of [
  ['MobileHero.dc.html', '08-mobile-hero', null],
  ['MobileTratamentos.dc.html', '09-mobile-tratamentos', '#tratamentos'],
  ['MobileAgendar.dc.html', '10-mobile-agendar', '#agendamento'],
] as const) {
  test(`${file} — 390×844`, async ({ page, browser }) => {
    test.setTimeout(200_000);
    const ref = await reference(page, file);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.goto(url('alva-demo', '/'));
    await waitScene(p);
    if (sel) {
      await p.evaluate((sel) => {
        const s = document.querySelector(sel)!;
        window.scrollTo({ top: window.scrollY + s.getBoundingClientRect().top - (sel === '#tratamentos' ? 0 : 0), behavior: 'instant' });
      }, sel);
    }
    await p.waitForTimeout(1500);
    compare(name, ref, await p.screenshot());
    if (name === '08-mobile-hero') {
      const h1 = await rect(p, '#hero-title');
      near(h1.x, 20, 2, 'título: x');
      const fsz = await p.locator('#hero-title').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      near(fsz, 50, 3, 'título: tamanho');
      const bar = await rect(p, '[data-mobile-bar]');
      near(bar.height, 80, 4, 'barra fixa: altura');
    }
    await ctx.close();
  });
}
