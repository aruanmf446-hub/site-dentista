/**
 * Responsividade e experiência mobile: larguras obrigatórias, menu,
 * barra fixa, abas por camada e alvos de toque.
 */
import { test, expect } from '@playwright/test';
import { url, trackErrors, waitScene } from '../helpers';

const LARGURAS = [320, 375, 390, 768, 1024, 1440];
const PAGINAS = ['/', '/tratamentos/', '/tratamentos/implantes/', '/contato/', '/equipe/dentista-ortodontia/', '/unidades/centro/', '/privacidade/'];

for (const w of LARGURAS) {
  test(`sem rolagem horizontal em ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: w < 900 ? 800 : 900 });
    for (const p of PAGINAS) {
      await page.goto(url('alva-demo', p));
      if (p === '/') await waitScene(page);
      const { sw, cw, culprit } = await page.evaluate(() => {
        const cw = document.documentElement.clientWidth;
        let culprit = '';
        document.querySelectorAll('body *').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (!culprit && r.right > cw + 1 && getComputedStyle(el).position !== 'fixed' && r.width > 0) {
            // ignora elementos dentro de contêineres com overflow oculto/rolável
            let p = el.parentElement;
            let clipped = false;
            while (p && p !== document.body) {
              const o = getComputedStyle(p).overflowX;
              if (o === 'hidden' || o === 'auto' || o === 'scroll' || o === 'clip') {
                clipped = true;
                break;
              }
              p = p.parentElement;
            }
            if (!clipped) culprit = `${el.tagName.toLowerCase()}.${(el as HTMLElement).className}`;
          }
        });
        return { sw: document.documentElement.scrollWidth, cw, culprit };
      });
      expect(sw, `${p} @${w}px: ${culprit}`).toBeLessThanOrEqual(cw);
    }
  });
}

test.describe('mobile 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  test('menu em diálogo: abre, navega por teclado, fecha com Esc e devolve o foco', async ({ page }) => {
    await page.goto(url('alva-demo', '/'));
    const btn = page.locator('.hdr-full [data-menu-open]');
    await btn.click();
    const menu = page.locator('dialog[data-menu]');
    await expect(menu).toBeVisible();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.getByRole('link', { name: /Especialidades/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(btn).toBeFocused();
    await btn.click();
    await menu.getByRole('link', { name: /Contato/ }).click();
    await expect(menu).toBeHidden();
    await expect(page.locator('#agendamento')).toBeInViewport();
  });

  test('barra fixa: WhatsApp + Agendar, troca para Ligar no formulário e não cobre conteúdo', async ({ page }) => {
    // sem telefone real (demonstração) o botão "Ligar" não existe
    await page.goto(url('alva-demo', '/'));
    await expect(page.locator('[data-mbar-ligar]')).toHaveCount(0);
    await page.goto(url('teste-unidade-unica', '/'));
    const bar = page.locator('[data-mobile-bar]');
    await expect(bar).toBeVisible();
    const barH = await bar.evaluate((b) => b.getBoundingClientRect().height);
    const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
    expect(pad).toBeGreaterThanOrEqual(barH - 1);
    await expect(bar.getByRole('link', { name: 'Agendar' })).toBeVisible();
    await page.locator('#agendamento').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.getElementById('agendamento')!.scrollIntoView({ block: 'center' }));
    await expect(bar.getByRole('link', { name: /Ligar/ })).toBeVisible();
    // o último elemento do rodapé fica acima da barra no fim da página
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(400);
    const footerBottom = await page.locator('footer').evaluate((f) => f.getBoundingClientRect().bottom);
    const barTop = await bar.evaluate((b) => b.getBoundingClientRect().top);
    expect(footerBottom).toBeLessThanOrEqual(barTop + 1);
  });

  // As abas por camada são a alternativa acessível à sequência (movimento reduzido);
  // com movimento normal, o celular roda o cinema compacto (tests/e2e/scene.spec.ts).
  test('movimento reduzido — abas por camada: ARIA, setas do teclado e troca da vista 3D', async ({ page }) => {
    const errors = trackErrors(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url('alva-demo', '/'));
    await expect(page.locator('html')).not.toHaveClass(/is-cinema/);
    await waitScene(page);
    const tabs = page.locator('[data-layer-tabs] [role="tab"]');
    await expect(tabs).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const id = await tabs.nth(i).getAttribute('aria-controls');
      await expect(page.locator(`#${id}`)).toHaveAttribute('role', 'tabpanel');
    }
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#painel-dentina-polpa')).toBeVisible();
    await expect(page.locator('#painel-esmalte')).toBeHidden();
    await page.keyboard.press('End');
    await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
    await page.locator('#tratamentos').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const s = (window as any).__stacked;
      const v = s?.views.find((x: any) => x.name === 'tratamentos');
      return v && v.state.cut > 0.99 && v.state.enamelFade > 0.7;
    }, null, { timeout: 30_000 });
    await expect(page.locator('canvas[data-view="tratamentos"]')).toHaveClass(/is-live/);
    expect(errors).toEqual([]);
  });

  test('alvos de toque com pelo menos 44 px', async ({ page }) => {
    await page.goto(url('alva-demo', '/'));
    const small = await page.$$eval('a, button, [role="tab"], summary', (els) =>
      els
        .filter((e) => {
          const r = e.getBoundingClientRect();
          const st = getComputedStyle(e);
          return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && !e.closest('dialog:not([open])') && !e.closest('[inert]') && !e.closest('.sr-only, .skip-link, .ftr');
        })
        .filter((e) => {
          const r = e.getBoundingClientRect();
          // links dentro de texto corrido são exceção do WCAG 2.5.8
          if (e.tagName === 'A' && e.closest('p, label')) return false;
          return r.height < 44 && r.width < 44;
        })
        .map((e) => `${e.tagName} ${(e.textContent || '').trim().slice(0, 30)}`),
    );
    expect(small, small.join('\n')).toEqual([]);
  });
});
