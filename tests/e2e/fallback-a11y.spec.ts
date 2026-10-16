/**
 * Fallback sem WebGL, movimento reduzido e acessibilidade (axe-core, WCAG 2.2 AA).
 */
import { test, expect, chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import { url, trackErrors, waitScene } from '../helpers';

const OUT = 'tests/.artifacts/fallback';
fs.mkdirSync(OUT, { recursive: true });

test('sem WebGL: conteúdo completo com as ilustrações do design, sem erros', async () => {
  const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = trackErrors(page);
  await page.goto(url('alva-demo', '/'));
  await waitScene(page);
  const html = page.locator('html');
  await expect(html).toHaveClass(/no-webgl/);
  await expect(html).not.toHaveClass(/is-cinema/);
  await expect(page.locator('.hero__tooth-svg')).toBeVisible();
  await expect(page.locator('[data-cine="trat-list"] li').first()).toBeVisible();
  await expect(page.locator('[data-arcade-css]')).toBeVisible();
  await page.screenshot({ path: `${OUT}/sem-webgl.png`, fullPage: false });
  await page.locator('#especialidades').scrollIntoViewIfNeeded();
  await page.locator('[data-spec-index="1"]').click();
  await expect(page.locator('[data-tooth="12"]')).toHaveClass(/is-hi/);
  expect(errors.filter((e) => !/WebGL/i.test(e)), errors.join('\n')).toEqual([]);
  await browser.close();
});

test.describe('movimento reduzido', () => {
  test.use({ reducedMotion: 'reduce' });
  test('sem cinema nem animações; tratamentos mostram o quadro C parado', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(url('alva-demo', '/'));
    await waitScene(page);
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/is-cinema/);
    await expect(html).not.toHaveClass(/(^|\s)motion(\s|$)/);
    const st = await page.evaluate(() => (window as any).__stacked?.views.find((v: any) => v.name === 'tratamentos')?.state);
    expect(st.cut).toBe(1);
    expect(st.enamelLift).toBeCloseTo(0.25, 2);
    expect(st.idle).toBe(0);
    // conteúdo revelável já visível (nada fica oculto sem animação)
    const hidden = await page.$$eval('[data-reveal]:not([data-reveal="outline"])', (els) => els.filter((e) => Number(getComputedStyle(e).opacity) < 0.99).length);
    expect(hidden).toBe(0);
    await page.screenshot({ path: `${OUT}/reduzido.png` });
    expect(errors).toEqual([]);
  });
});

const PAGINAS = ['/', '/tratamentos/', '/tratamentos/limpeza/', '/contato/', '/equipe/', '/equipe/dentista-ortodontia/', '/unidades/jardins/', '/a-clinica/', '/privacidade/'];
for (const p of PAGINAS) {
  test(`axe WCAG 2.2 AA: ${p}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url('alva-demo', p));
    if (p === '/') await waitScene(page);
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    const serious = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    const report = serious.map((v) => `${v.id}: ${v.help}\n  ${v.nodes.slice(0, 4).map((n) => n.target.join(' ')).join('\n  ')}`).join('\n');
    expect(serious, report).toEqual([]);
  });
}

test('foco visível e link para pular ao conteúdo', async ({ page }) => {
  await page.goto(url('alva-demo', '/contato/'));
  await page.keyboard.press('Tab');
  const skip = page.locator('.skip-link');
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), boxShadow: s.boxShadow };
  });
  expect(outline.style !== 'none' || outline.boxShadow !== 'none').toBe(true);
});
