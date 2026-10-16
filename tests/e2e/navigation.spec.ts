/**
 * Menu, links, páginas e ausência de erros de console.
 */
import { test, expect } from '@playwright/test';
import { url, routes, trackErrors, waitScene, type Variant } from '../helpers';

const VARIANTES: Variant[] = ['alva-demo', 'teste-minimo', 'teste-completo', 'teste-unidade-unica', 'teste-producao'];

for (const v of VARIANTES) {
  test(`[${v}] todas as páginas respondem, sem erros de console e sem links internos quebrados`, async ({ page, request }) => {
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    const paths = await routes(page, v);
    expect(paths).toContain('/');
    const links = new Set<string>();
    for (const p of paths) {
      const res = await page.goto(url(v, p), { waitUntil: 'load' });
      expect(res?.status(), p).toBe(200);
      await expect(page.locator('h1').first(), `h1 em ${p}`).toBeAttached();
      await expect(page.locator('main#conteudo')).toBeAttached();
      const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
      hrefs.filter((h) => h.startsWith('/') && !h.startsWith('//')).forEach((h) => links.add(h));
    }
    for (const href of links) {
      const [path, hash] = href.split('#');
      const res = await request.get(url(v, path || '/'));
      expect(res.status(), `link ${href}`).toBe(200);
      if (hash) {
        const html = await res.text();
        expect(html.includes(`id="${hash}"`), `âncora #${hash} em ${path || '/'}`).toBe(true);
      }
    }
    // home com a cena (sem erros mesmo depois de carregar o 3D)
    await page.goto(url(v, '/'));
    await waitScene(page);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('menu mostra só as seções ativas (completo × mínimo)', async ({ page }) => {
  await page.goto(url('teste-completo', '/'));
  const full = await page.locator('.hdr-full__nav a').allInnerTexts();
  expect(full).toEqual(['Tratamentos', 'Especialidades', 'Equipe', 'Unidades', 'Convênios', 'Contato']);
  await page.goto(url('teste-minimo', '/'));
  const min = await page.locator('.hdr-full__nav a').allInnerTexts();
  expect(min).toEqual(['Tratamentos', 'Contato']);
  for (const id of ['especialidades', 'sobre', 'equipe', 'unidades', 'convenios', 'valores', 'depoimentos', 'galeria', 'faq']) {
    await expect(page.locator(`#${id}`), `#${id} não deve existir`).toHaveCount(0);
  }
  // índice de progresso renumerado: 00 início, 01 tratamentos, 02 agendamento
  await expect(page.locator('[data-progress] .progress__num')).toHaveText(['00', '01', '02']);
  await expect(page.locator('#agendamento .eyebrow__text')).toHaveText('02 · Agendamento');
});

test('rotas desligadas não são geradas', async ({ request }) => {
  for (const p of ['/equipe/', '/unidades/', '/unidades/centro/']) {
    expect((await request.get(url('teste-minimo', p))).status(), p).toBe(404);
  }
  expect((await request.get(url('teste-unidade-unica', '/unidades/'))).status()).toBe(404);
  expect((await request.get(url('alva-demo', '/unidades/jardins/'))).status()).toBe(200);
});

test('SEO: title, description, canonical, OG, sitemap e robots', async ({ page, request }) => {
  await page.goto(url('teste-producao', '/tratamentos/limpeza/'));
  await expect(page).toHaveTitle(/Limpeza · Clínica Fictícia de Teste/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /placa/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://clinica-ficticia-de-teste.invalid/tratamentos/limpeza/');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Limpeza/);
  const sitemap = await (await request.get(url('teste-producao', '/sitemap.xml'))).text();
  expect(sitemap).toContain('/tratamentos/limpeza/');
  expect(sitemap).not.toContain('/equipe/');
  // demonstração: não indexável
  await page.goto(url('alva-demo', '/'));
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  expect(await (await request.get(url('alva-demo', '/robots.txt'))).text()).toContain('Disallow: /');
});

test('dados estruturados: só dados reais, sem avaliações', async ({ page }) => {
  await page.goto(url('teste-producao', '/'));
  const ld = await page.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => JSON.parse(x.textContent || '{}')));
  const dentist = ld.find((x) => x['@type'] === 'Dentist');
  expect(dentist?.address?.addressLocality).toBe('Cidade Fictícia');
  expect(dentist?.openingHoursSpecification?.[0]?.opens).toBe('08:00');
  expect(JSON.stringify(ld)).not.toMatch(/aggregateRating|review/i);
  // demonstração com placeholders: nenhum LocalBusiness
  await page.goto(url('alva-demo', '/'));
  const demoLd = await page.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => x.textContent));
  expect(demoLd.join('')).not.toContain('Dentist');
});
