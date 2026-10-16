/**
 * Cena 3D e scroll cinematográfico — verificado NO NAVEGADOR:
 * a câmera e o modelo mudam em função do progresso da rolagem, a
 * sequência reverte ao voltar, e as especialidades respondem a rolagem
 * e clique. Capturas de cada estado ficam em tests/.artifacts/scene/.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { url, trackErrors, waitScene, scrollCinema, cinemaState, type Variant } from '../helpers';

const OUT = 'tests/.artifacts/scene';
fs.mkdirSync(OUT, { recursive: true });

test.describe.configure({ mode: 'serial' });

test('cinema: câmera, corte, esmalte e arcada seguem a rolagem — e revertem', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = trackErrors(page);
  await page.goto(url('alva-demo', '/'));
  await expect(page.locator('html')).toHaveClass(/is-cinema/);
  await waitScene(page);
  await expect(page.locator('html')).toHaveClass(/stage-ready/);

  const segs = await page.evaluate(() => (window as any).__cinema.segments as { id: string; start: number; len: number }[]);
  const total = segs.reduce((a, s) => a + s.len, 0);
  const at = (id: string, local: number) => {
    const s = segs.find((x) => x.id === id)!;
    return (s.start + local) / total;
  };

  const frames: Record<string, Awaited<ReturnType<typeof cinemaState>>> = {};
  const shoot = async (name: string, p: number) => {
    await scrollCinema(page, p);
    await page.waitForTimeout(300);
    frames[name] = await cinemaState(page);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  };

  await shoot('00-hero', 0);
  await shoot('01-hero-transicao', at('inicio', 0.5));
  await shoot('02-quadro-a', at('tratamentos', 0.3));
  await shoot('03-quadro-b', at('tratamentos', 1.5));
  await shoot('04-quadro-c', at('tratamentos', 2.85));
  await shoot('05-reconstrucao', at('especialidades', 0.35));
  await shoot('06-arcada', at('especialidades', 1.1));
  const n = await page.locator('[data-spec-index]').count();
  await shoot('07-arcada-ultima', at('especialidades', 1 + (n - 1) * 0.55 + 0.2));

  const h = frames['00-hero']!, b = frames['03-quadro-b']!, c = frames['04-quadro-c']!, arc = frames['06-arcada']!;
  // hero: dente inteiro, inclinado
  expect(h.cut).toBe(0);
  expect(h.toothRotZ).toBeCloseTo(-9, 0);
  // quadro B: câmera orbitou (~35°) e desceu; corte aberto; esmalte subiu
  expect(b.orbit).toBeGreaterThan(25);
  expect(b.elevation).toBeLessThan(0);
  expect(b.cut).toBeGreaterThan(0.95);
  expect(b.enamelLift).toBeGreaterThan(0.08);
  expect(Math.hypot(b.cam[0]! - h.cam[0]!, b.cam[2]! - h.cam[2]!)).toBeGreaterThan(0.5);
  // quadro C: esmalte afastado e inclinado, âncora no terço esquerdo
  expect(c.enamelLift).toBeGreaterThan(0.2);
  expect(c.enamelTilt).toBeLessThan(-6);
  expect(c.anchor).toBeCloseTo(3, 1);
  // arcada: dente pousou na arcada, câmera elevada
  expect(arc.arch).toBeCloseTo(1, 2);
  expect(arc.elevation).toBeGreaterThan(40);
  expect(arc.cut).toBe(0);
  expect(frames['07-arcada-ultima']!.spec).toBeCloseTo(n - 1, 1);

  // ROLAR PARA TRÁS reverte: volta ao quadro B e ao hero
  await scrollCinema(page, at('tratamentos', 1.5));
  const back = await cinemaState(page);
  expect(back.cut).toBeCloseTo(b.cut, 1);
  expect(back.orbit).toBeCloseTo(b.orbit, 0);
  expect(back.arch).toBe(0);
  await page.screenshot({ path: `${OUT}/08-volta-quadro-b.png` });
  await scrollCinema(page, 0);
  const back0 = await cinemaState(page);
  expect(back0.cut).toBe(0);
  expect(back0.orbit).toBeCloseTo(0, 3);
  expect(back0.anchor).toBeCloseTo(0, 3);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('cinema: legendas do quadro B acompanham a projeção do modelo', async ({ page }) => {
  test.setTimeout(200_000);
  await page.goto(url('alva-demo', '/'));
  await waitScene(page);
  const segs = await page.evaluate(() => (window as any).__cinema.segments as { id: string; start: number; len: number }[]);
  const total = segs.reduce((a, s) => a + s.len, 0);
  const t = segs.find((s) => s.id === 'tratamentos')!;
  await scrollCinema(page, (t.start + 1.5) / total);
  await page.waitForTimeout(400);
  const data = await page.evaluate(() => {
    const c = (window as any).__cinema;
    return ['esmalte', 'polpa', 'dentina', 'raiz'].map((id) => {
      const p = c.stage.project(id);
      const dot = document.querySelector<HTMLElement>(`[data-leader="${id}"]`)!;
      const r = dot.getBoundingClientRect();
      const label = document.querySelector<HTMLElement>(`.trat__label[data-label="${id}"]`)!;
      return { py: p.y, dotY: r.top, op: Number(getComputedStyle(label).opacity), labelTop: label.getBoundingClientRect().top };
    });
  });
  for (const d of data) {
    expect(d.op).toBeGreaterThan(0.9);
    expect(Math.abs(d.dotY - d.py)).toBeLessThan(3);
    expect(Math.abs(d.labelTop + 9 - d.py)).toBeLessThan(3);
  }
  // de cima para baixo: esmalte, polpa, dentina, raiz
  expect(data[0]!.py).toBeLessThan(data[1]!.py);
  expect(data[2]!.py).toBeLessThan(data[3]!.py);
});

test('cinema: clique em especialidade rola até ela e destaca na arcada', async ({ page }) => {
  test.setTimeout(200_000);
  await page.goto(url('alva-demo', '/'));
  await waitScene(page);
  const segs = await page.evaluate(() => (window as any).__cinema.segments as { id: string; start: number; len: number }[]);
  const total = segs.reduce((a, s) => a + s.len, 0);
  const e = segs.find((s) => s.id === 'especialidades')!;
  await scrollCinema(page, (e.start + 1.05) / total);
  await page.locator('[data-spec-index="3"]').click();
  await page.waitForFunction(() => Math.abs((window as any).__cinema.state.spec - 3) < 0.02, null, { timeout: 60_000 });
  await expect(page.locator('[data-spec-index="3"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-spec-detail="3"]')).toBeVisible();
  await expect(page.locator('[data-spec-detail="3"]')).toContainText('Periodontia');
  await page.screenshot({ path: `${OUT}/09-clique-periodontia.png` });
});

for (const v of ['teste-minimo', 'teste-dois-tratamentos', 'teste-dez-tratamentos', 'teste-azul-foto'] as Variant[]) {
  test(`[${v}] sequência se adapta às seções ativas sem erros`, async ({ page }) => {
    test.setTimeout(200_000);
    const errors = trackErrors(page);
    await page.goto(url(v, '/'));
    await waitScene(page);
    const segs = await page.evaluate(() => (window as any).__cinema.segments.map((s: any) => s.id));
    if (v === 'teste-minimo') expect(segs).toEqual(['inicio', 'tratamentos']);
    else expect(segs).toEqual(['inicio', 'tratamentos', 'especialidades']);
    for (const p of [0, 0.3, 0.6, 1]) {
      await scrollCinema(page, p);
      await page.screenshot({ path: `${OUT}/${v}-${p}.png` });
    }
    const items = await page.locator('[data-cine="trat-list"] li').count();
    if (v === 'teste-dois-tratamentos') {
      expect(items).toBe(2);
      await expect(page.locator('.trat__list')).toHaveClass(/trat__list--poucos/);
    }
    if (v === 'teste-dez-tratamentos') {
      expect(items).toBe(10);
      await expect(page.locator('.trat__list')).toHaveAttribute('data-cols', '2');
    }
    if (v === 'teste-azul-foto') {
      const primary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim());
      expect(primary.toLowerCase()).toBe('#2f3b52');
    }
    // depois da sequência, o conteúdo normal continua
    await page.locator('#agendamento').scrollIntoViewIfNeeded();
    await expect(page.locator('#agendamento')).toBeInViewport();
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test.describe('empilhado (mobile)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('vistas 3D ancoradas: hero gira com a rolagem; especialidade muda o destaque', async ({ page }) => {
    test.setTimeout(200_000);
    const errors = trackErrors(page);
    await page.goto(url('alva-demo', '/'));
    await waitScene(page);
    await expect(page.locator('html')).not.toHaveClass(/is-cinema/);
    const heroRot = () => page.evaluate(() => (window as any).__stacked.views.find((v: any) => v.name === 'hero').state.toothRotY as number);
    // parte do topo (a página pode ter rolado durante a espera do 3D)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForFunction(() => Math.abs((window as any).__stacked.views.find((v: any) => v.name === 'hero').state.toothRotY + 22) < 0.5);
    const rot0 = await heroRot();
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
    await page.waitForFunction((r0) => (window as any).__stacked.views.find((v: any) => v.name === 'hero').state.toothRotY > r0 + 3, rot0, { timeout: 5_000 });
    expect(await heroRot()).toBeGreaterThan(rot0 + 3);
    await page.screenshot({ path: `${OUT}/mobile-hero.png` });
    await page.locator('#especialidades').scrollIntoViewIfNeeded();
    await page.locator('[data-spec-index="1"]').click();
    await page.waitForFunction(() => Math.abs((window as any).__stacked.views.find((v: any) => v.name === 'especialidades').state.spec - 1) < 0.01);
    await page.locator('.esp__arcade').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/mobile-arcada.png` });
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
