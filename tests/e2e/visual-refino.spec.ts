/**
 * Refino visual: sem sobreposição entre o 3D e os textos ao longo da sequência,
 * canvas WebGL nítido (resolução real = tamanho na tela × DPR, com antisserrilhado),
 * fotos entregues na resolução da tela e WhatsApp flutuante fora do formulário.
 */
import { test, expect, type Page } from '@playwright/test';
import { url, trackErrors, waitScene } from '../helpers';
// módulo JS compartilhado com scripts/qa/overlap-audit.mjs
import { auditFrame } from '../../scripts/qa/overlap-core.mjs';

const TEMPOS = [0, 0.5, 0.8, 1.0, 1.3, 1.45, 1.6, 1.9, 2.2, 2.5, 2.65, 2.75, 2.85, 3.0, 3.15, 3.5, 3.85, 4.3, 5.0, 5.6, 6.8, 8.0];

async function irPara(page: Page, t: number) {
  await page.evaluate((t) => {
    const c = (window as any).__cinema;
    window.scrollTo({ top: c.st.start + (t / c.tl.duration()) * (c.st.end - c.st.start), behavior: 'instant' });
  }, t);
  await page.waitForFunction((t) => Math.abs((window as any).__cinema.tl.time() - t) < 0.01, t, { timeout: 90_000 });
  await page.waitForTimeout(100);
}

const TELAS = [
  { nome: '1440', use: { viewport: { width: 1440, height: 900 } } },
  { nome: '1024', use: { viewport: { width: 1024, height: 768 } } },
  // notebook com zoom do sistema em 150% (tela "baixa")
  { nome: '1260x587', use: { viewport: { width: 1260, height: 587 }, deviceScaleFactor: 1.5 } },
  { nome: '390', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
] as const;

for (const tela of TELAS) {
  test.describe(`[${tela.nome}]`, () => {
    test.use(tela.use);
    test('sem sobreposição do dente/arcada com textos, nem textos sobrepostos, em toda a sequência', async ({ page }) => {
      // GPU emulada por software: quadros lentos + scrub de 1,2 s
      test.setTimeout(900_000);
      const errors = trackErrors(page);
      await page.goto(url('alva-demo', '/'));
      await waitScene(page);
      const dur = await page.evaluate(() => (window as any).__cinema.tl.duration());
      const achados: string[] = [];
      for (const t of TEMPOS.filter((x) => x <= dur)) {
        await irPara(page, t);
        const r = await page.evaluate(auditFrame);
        for (const a of r.achados) achados.push(`t=${r.tempo} ${a.tipo} | ${a.item} | ${a.px}px`);
      }
      expect(achados, achados.join('\n')).toEqual([]);
      expect(errors, errors.join('\n')).toEqual([]);
    });
  });
}

test.describe('nitidez do canvas', () => {
  const casos = [
    { nome: 'retina 1440 (DPR 2)', use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, ratio: 2 },
    { nome: 'iPhone 390 (DPR 3)', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, ratio: 2 },
  ];
  for (const c of casos) {
    test.describe(c.nome, () => {
      test.use(c.use);
      test('resolução real = tamanho na tela × DPR (até 2×), com antisserrilhado; acompanha a rotação', async ({ page }) => {
        test.setTimeout(200_000);
        await page.goto(url('alva-demo', '/'));
        await waitScene(page);
        const medir = () =>
          page.evaluate(() => {
            const cv = document.querySelector<HTMLCanvasElement>('[data-stage-canvas]')!;
            const b = cv.getBoundingClientRect();
            const s = (window as any).__cinema.stage;
            const gl = s.renderer.getContext() as WebGLRenderingContext;
            return {
              cssW: b.width,
              cssH: b.height,
              w: cv.width,
              h: cv.height,
              ratio: s.renderer.getPixelRatio() as number,
              alvo: (window as any).__cinema.targetRatio as number,
              samples: gl.getParameter(gl.SAMPLES) as number,
            };
          });
        const m = await medir();
        // pedido: 2× (telas 3× também ficam em 2×); o governador só reduz se o
        // aparelho não sustentar a rolagem — aqui a GPU é emulada por software
        expect(m.alvo).toBe(c.ratio);
        expect(m.ratio).toBeLessThanOrEqual(c.ratio);
        expect(m.ratio).toBeGreaterThanOrEqual(1);
        expect(m.w).toBe(Math.floor(m.cssW * m.ratio));
        expect(m.h).toBe(Math.floor(m.cssH * m.ratio));
        expect(m.samples).toBeGreaterThanOrEqual(4);
        // girar / redimensionar: o canvas é refeito no novo tamanho (nunca esticado por CSS)
        const vp = c.use.viewport;
        await page.setViewportSize({ width: vp.height, height: vp.width });
        await page.waitForFunction(() => {
          const cv = document.querySelector<HTMLCanvasElement>('[data-stage-canvas]')!;
          const r = (window as any).__cinema.stage.renderer.getPixelRatio();
          return Math.abs(cv.width - Math.floor(cv.getBoundingClientRect().width * r)) <= 1;
        }, null, { timeout: 20_000 });
        const g = await medir();
        expect(g.cssW).toBe(vp.height);
        expect(Math.abs(g.w - Math.floor(g.cssW * g.ratio))).toBeLessThanOrEqual(1);
        expect(Math.abs(g.h - Math.floor(g.cssH * g.ratio))).toBeLessThanOrEqual(1);
      });
    });
  }
});

test.describe('fotos na resolução da tela', () => {
  for (const [w, h, dpr] of [[390, 844, 3], [1440, 900, 2]] as const) {
    test.describe(`${w} DPR ${dpr}`, () => {
      test.use({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: w < 900 });
      test('cada foto recebe um arquivo com pixels suficientes (≥ 95% do necessário)', async ({ page }) => {
        test.setTimeout(150_000);
        await page.goto(url('teste-completo', '/'));
        const H = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < H; y += 600) {
          await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
          await page.waitForTimeout(40);
        }
        await page.waitForTimeout(1500);
        const fotos = await page.evaluate(async () =>
          Promise.all(
            Array.from(document.querySelectorAll<HTMLImageElement>('img'))
              .filter((i) => i.currentSrc && !i.currentSrc.endsWith('.svg') && i.getBoundingClientRect().width > 0)
              .map(async (i) => {
                const b = i.getBoundingClientRect();
                const im = new Image();
                im.src = i.currentSrc;
                await im.decode();
                const need = Math.max((b.width * devicePixelRatio) / im.naturalWidth, (b.height * devicePixelRatio) / im.naturalHeight);
                return { src: i.currentSrc.split('/').pop(), cobertura: 1 / need };
              }),
          ),
        );
        expect(fotos.length).toBeGreaterThan(0);
        for (const f of fotos) expect(f.cobertura, f.src).toBeGreaterThanOrEqual(0.95);
      });
    });
  }
});

test.describe('antes do 3D ficar pronto', () => {
  test.use({ viewport: { width: 1904, height: 881 } });
  test('a arcada em CSS das especialidades não aparece sobre o hero', async ({ page }) => {
    // segura o worker da geometria: a página fica no intervalo entre a timeline e o 3D
    await page.route(/worker/i, (r) => (r.request().resourceType() === 'script' ? new Promise(() => {}) : r.continue()));
    await page.goto(url('alva-demo', '/'));
    await page.waitForFunction(() => document.documentElement.classList.contains('cinema-ready'));
    await page.waitForTimeout(1500);
    const estado = await page.evaluate(() => ({
      pronto: document.documentElement.classList.contains('stage-ready'),
      arcada: getComputedStyle(document.querySelector('.esp [data-arcade-css]')!).visibility,
      denteHero: getComputedStyle(document.querySelector('.hero__tooth-svg')!).visibility,
    }));
    expect(estado.pronto).toBe(false);
    expect(estado.arcada).toBe('hidden');
    expect(estado.denteHero).toBe('visible');
  });
});

test('desktop: o WhatsApp flutuante sai de cena sobre o formulário de agendamento', async ({ page }) => {
  await page.goto(url('alva-demo', '/'));
  const flutuante = page.locator('[data-wa-float]');
  await expect(flutuante).toBeVisible();
  await expect(flutuante).not.toHaveClass(/is-away/);
  await page.evaluate(() => document.getElementById('agendamento')!.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(flutuante).toHaveClass(/is-away/);
  await expect(flutuante).toHaveAttribute('aria-hidden', '');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(flutuante).not.toHaveClass(/is-away/);
});
