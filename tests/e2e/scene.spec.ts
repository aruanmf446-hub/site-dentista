/**
 * Cena 3D e scroll cinematográfico — verificado NO NAVEGADOR:
 * a câmera e o modelo mudam em função do progresso da rolagem, a
 * sequência reverte ao voltar, e as especialidades respondem a rolagem
 * e clique. Capturas de cada estado ficam em tests/.artifacts/scene/.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { url, trackErrors, waitScene, scrollCinema, cinemaState, sceneObjects, sigDiff, type Variant } from '../helpers';

const OUT = 'tests/.artifacts/scene';
fs.mkdirSync(OUT, { recursive: true });

// a cena usa WebGL por software nos testes: poucos em paralelo para não disputar CPU
test.describe.configure({ mode: 'default' });

const PERFIS = [
  { nome: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
  { nome: 'desktop-1024', use: { viewport: { width: 1024, height: 768 } } },
  { nome: 'tablet-768', use: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  { nome: 'android-390', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } },
] as const;

for (const perfil of PERFIS) {
  test.describe(`[${perfil.nome}]`, () => {
    test.use(perfil.use);
    test('cinema: câmera, corte, esmalte e arcada seguem a rolagem de 0 a 100% — e revertem de 100% a 0', async ({ page }) => {
      // GPU emulada por software: quadros de ~0,6 s + scrub de 1,2 s → cada ponto leva ~10–20 s
      test.setTimeout(900_000);
      const errors = trackErrors(page);
      const compact = perfil.use.viewport.width < 900;
      await page.goto(url('alva-demo', '/'));
      await expect(page.locator('html')).toHaveClass(/is-cinema/);
      if (compact) await expect(page.locator('html')).toHaveClass(/cine-compact/);
      else await expect(page.locator('html')).not.toHaveClass(/cine-compact/);
      // primeiro carregamento: interface utilizável antes do 3D (SVG do design no arco)
      await expect(page.locator('#hero-title')).toBeVisible();
      await waitScene(page);
      await expect(page.locator('html')).toHaveClass(/stage-ready/);
      await expect(page.locator('[data-stage-canvas]')).toBeVisible();

      const segs = await page.evaluate(() => (window as any).__cinema.segments as { id: string; start: number; len: number }[]);
      const total = segs.reduce((a, s) => a + s.len, 0);
      const at = (id: string, local: number) => {
        const s = segs.find((x) => x.id === id)!;
        return (s.start + local) / total;
      };
      const frames: Record<string, Awaited<ReturnType<typeof cinemaState>>> = {};
      const objs: Record<string, Awaited<ReturnType<typeof sceneObjects>>> = {};
      const shoot = async (name: string, p: number) => {
        await scrollCinema(page, p);
        await page.waitForTimeout(300);
        frames[name] = await cinemaState(page);
        objs[name] = await sceneObjects(page);
        await page.screenshot({ path: `${OUT}/${perfil.nome}-${name}.png` });
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
      await shoot('08-fim', 1);

      const h = frames['00-hero']!, a = frames['02-quadro-a']!, b = frames['03-quadro-b']!, c = frames['04-quadro-c']!, arc = frames['06-arcada']!;
      // hero: dente inteiro, inclinado
      expect(h.cut).toBe(0);
      expect(h.toothRotZ).toBeCloseTo(-9, 0);
      // quadro A: o dente girou de −20° para perto de 0°
      expect(a.toothRotY).toBeGreaterThan(h.toothRotY + 5);
      // quadro B: câmera orbitou (~35°) e desceu; corte aberto; esmalte subiu
      expect(b.orbit).toBeGreaterThan(25);
      expect(b.elevation).toBeLessThan(0);
      expect(b.cut).toBeGreaterThan(0.95);
      expect(b.enamelLift).toBeGreaterThan(0.08);
      expect(Math.hypot(b.cam[0]! - h.cam[0]!, b.cam[2]! - h.cam[2]!)).toBeGreaterThan(0.5);
      // quadro C: esmalte afastado e inclinado, enquadramento do quadro C
      expect(c.enamelLift).toBeGreaterThan(0.2);
      expect(c.enamelTilt).toBeLessThan(-6);
      expect(c.anchor).toBeCloseTo(3, 1);
      // arcada: dente pousou na arcada, câmera elevada
      expect(arc.arch).toBeCloseTo(1, 2);
      expect(arc.elevation).toBeGreaterThan(40);
      expect(arc.cut).toBe(0);
      expect(frames['07-arcada-ultima']!.spec).toBeCloseTo(n - 1, 1);

      // objetos Three.js reais: grupos, posições e pixels do canvas mudam com a rolagem
      const oh = objs['00-hero']!, ob = objs['03-quadro-b']!, oc = objs['04-quadro-c']!, oa = objs['06-arcada']!;
      expect(oh.cutVisible).toBe(false);
      expect(ob.cutVisible).toBe(true);
      expect(ob.enamelY).toBeGreaterThan(oh.enamelY + 0.05);
      expect(oh.arcadeVisible).toBe(false);
      expect(oa.arcadeVisible).toBe(true);
      expect(oa.archTeethVisible).toBeGreaterThan(8);
      expect(Math.abs(oc.toothRot[1]! - oh.toothRot[1]!) + Math.abs(oc.toothRot[2]! - oh.toothRot[2]!)).toBeGreaterThan(0.1);
      expect(oh.opaque).toBeGreaterThan(0); // o canvas tem o dente desenhado
      expect(sigDiff(oh.sig, ob.sig)).toBeGreaterThan(0.05);
      expect(sigDiff(ob.sig, oa.sig)).toBeGreaterThan(0.05);

      // ROLAR PARA TRÁS reverte: arcada → quadro B → hero
      await scrollCinema(page, at('especialidades', 1.1));
      await scrollCinema(page, at('tratamentos', 1.5));
      const back = await cinemaState(page);
      expect(back.cut).toBeCloseTo(b.cut, 1);
      expect(back.orbit).toBeCloseTo(b.orbit, 0);
      expect(back.arch).toBe(0);
      expect((await sceneObjects(page)).arcadeVisible).toBe(false);
      await page.screenshot({ path: `${OUT}/${perfil.nome}-09-volta-quadro-b.png` });
      await scrollCinema(page, 0);
      const back0 = await cinemaState(page);
      expect(back0.cut).toBe(0);
      expect(back0.orbit).toBeCloseTo(0, 3);
      expect(back0.anchor).toBeCloseTo(0, 3);
      expect((await sceneObjects(page)).cutVisible).toBe(false);

      // depois da sequência, o conteúdo da clínica continua até o agendamento
      await page.locator('#agendamento').scrollIntoViewIfNeeded();
      await expect(page.locator('#agendamento')).toBeInViewport();
      expect(errors, errors.join('\n')).toEqual([]);
    });
  });
}

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

test.describe('celular (cinema compacto)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  test('especialidade: toque na lista rola até ela e muda o destaque na arcada', async ({ page }) => {
    test.setTimeout(200_000);
    const errors = trackErrors(page);
    await page.goto(url('alva-demo', '/'));
    await waitScene(page);
    await expect(page.locator('html')).toHaveClass(/cine-compact/);
    const segs = await page.evaluate(() => (window as any).__cinema.segments as { id: string; start: number; len: number }[]);
    const total = segs.reduce((a, s) => a + s.len, 0);
    const e = segs.find((s) => s.id === 'especialidades')!;
    await scrollCinema(page, (e.start + 1.05) / total);
    await page.locator('[data-spec-index="2"]').tap();
    await page.waitForFunction(() => Math.abs((window as any).__cinema.state.spec - 2) < 0.02, null, { timeout: 60_000 });
    await expect(page.locator('[data-spec-index="2"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-spec-detail="2"]')).toBeVisible();
    await page.screenshot({ path: `${OUT}/mobile-clique-especialidade.png` });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('girar o aparelho e voltar mantém a sequência funcionando', async ({ page }) => {
    test.setTimeout(200_000);
    const errors = trackErrors(page);
    await page.goto(url('alva-demo', '/'));
    await waitScene(page);
    const segs = await page.evaluate(() => (window as any).__cinema.segments as { id: string; start: number; len: number }[]);
    const total = segs.reduce((a, s) => a + s.len, 0);
    const t = segs.find((s) => s.id === 'tratamentos')!;
    // paisagem (ainda compacto) → tablet largo (desktop) → retrato
    for (const vp of [{ width: 844, height: 390 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(vp);
      await page.waitForFunction((w) => {
        const c = (window as any).__cinema;
        return Math.abs(c.st.end - c.st.start - (document.querySelector<HTMLElement>('[data-cinema]')!.offsetHeight - innerHeight)) < 2 && innerWidth === w;
      }, vp.width, { timeout: 20_000 });
      await expect(page.locator('html')).toHaveClass(vp.width < 900 ? /cine-compact/ : /is-cinema/);
      if (vp.width >= 900) await expect(page.locator('html')).not.toHaveClass(/cine-compact/);
      await scrollCinema(page, (t.start + 1.5) / total);
      const st = await cinemaState(page);
      expect(st.cut).toBeGreaterThan(0.95);
      expect(st.orbit).toBeGreaterThan(25);
      const box = await page.locator('[data-stage-canvas]').boundingBox();
      expect(Math.round(box!.width)).toBe(vp.width);
      await scrollCinema(page, 0);
      expect((await cinemaState(page)).cut).toBe(0);
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

test('atualizar a página no meio da sequência retoma o estado da rolagem', async ({ page }) => {
  test.setTimeout(200_000);
  const errors = trackErrors(page);
  await page.goto(url('alva-demo', '/'));
  await waitScene(page);
  const segs = await page.evaluate(() => (window as any).__cinema.segments as { id: string; start: number; len: number }[]);
  const total = segs.reduce((a, s) => a + s.len, 0);
  const t = segs.find((s) => s.id === 'tratamentos')!;
  await scrollCinema(page, (t.start + 1.5) / total);
  const y = await page.evaluate(() => scrollY);
  await page.reload();
  await waitScene(page);
  await page.waitForFunction((y) => Math.abs(scrollY - y) < 4, y, { timeout: 20_000 });
  await page.waitForFunction(() => (window as any).__cinema.state.cut > 0.95, null, { timeout: 30_000 });
  const st = await cinemaState(page);
  expect(st.orbit).toBeGreaterThan(25);
  expect((await sceneObjects(page)).cutVisible).toBe(true);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('âncoras: #tratamentos e #especialidades levam ao trecho certo da sequência', async ({ page }) => {
  test.setTimeout(200_000);
  const errors = trackErrors(page);
  await page.goto(url('alva-demo', '/#especialidades'));
  await waitScene(page);
  await page.waitForFunction(() => (window as any).__cinema.state.arch > 0.99, null, { timeout: 30_000 });
  await expect(page.locator('[data-panel="especialidades"]')).toHaveClass(/is-active/);
  // link do menu volta para os tratamentos (rolagem suave dentro da trilha)
  await page.locator('.hdr a[href$="#tratamentos"]:visible').first().click();
  await page.waitForFunction(() => {
    const c = (window as any).__cinema;
    const t = c.segments.find((s: any) => s.id === 'tratamentos');
    return Math.abs(c.tl.time() - (t.start + 0.02)) < 0.05;
  }, null, { timeout: 30_000 });
  expect((await cinemaState(page)).arch).toBe(0);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('falha do WebGL ao criar a cena: desmonta a sequência e mostra as ilustrações, sem travar a sessão', async ({ page }) => {
  test.setTimeout(120_000);
  // o teste de capacidade passa, mas o canvas do palco não consegue contexto (falha real tardia)
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    (HTMLCanvasElement.prototype as any).getContext = function (this: HTMLCanvasElement, ...args: any[]) {
      if (this.hasAttribute('data-stage-canvas')) return null;
      return (orig as any).apply(this, args);
    };
  });
  const msgs: string[] = [];
  page.on('console', (m) => msgs.push(m.text()));
  await page.goto(url('alva-demo', '/'));
  await page.mouse.wheel(0, 10);
  await expect(page.locator('html')).toHaveClass(/no-webgl/, { timeout: 30_000 });
  await expect(page.locator('html')).not.toHaveClass(/is-cinema/);
  await expect(page.locator('html')).toHaveAttribute('data-webgl-error', /WebGL/);
  expect(msgs.some((m) => /WebGL\/3D indisponível/.test(m))).toBe(true); // falha registrada, não silenciosa
  // layout estático completo e utilizável
  await expect(page.locator('.hero__tooth-svg')).toBeVisible();
  const li = page.locator('[data-cine="trat-list"] li').first();
  await li.scrollIntoViewIfNeeded();
  await expect(li).toBeVisible();
  expect((await li.boundingBox())!.width).toBeGreaterThan(100);
  await page.locator('#especialidades').scrollIntoViewIfNeeded();
  await page.locator('[data-spec-index="1"]').click();
  await expect(page.locator('[data-tooth="12"]')).toHaveClass(/is-hi/);
  // a sessão não fica bloqueada: sem o defeito, o 3D volta na próxima visita
  expect(await page.evaluate(() => sessionStorage.getItem('alva:no-webgl'))).toBeNull();
});
