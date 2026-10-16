// Sonda a experiência de rolagem 3D em várias telas e registra o estado real da cena.
// Uso: node scripts/qa/probe-scroll.mjs <url> [saida.json] [--browser=chromium|webkit]
// Funciona contra o build local ou contra a produção (se a rede permitir).
import { chromium, webkit, devices } from '@playwright/test';
import fs from 'node:fs';

const url = process.argv[2] || 'http://127.0.0.1:4400/';
const out = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : null;
const engine = (process.argv.find((a) => a.startsWith('--browser=')) || '--browser=chromium').split('=')[1];
const PERFIS = [
  { nome: 'desktop-1440', viewport: { width: 1440, height: 900 } },
  { nome: 'desktop-1024', viewport: { width: 1024, height: 768 } },
  { nome: 'tablet-768', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true },
  { nome: 'android-390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
];

const launcher = engine === 'webkit' ? webkit : chromium;
const localChrome = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await launcher.launch(
  engine === 'chromium'
    ? { executablePath: fs.existsSync(localChrome) ? localChrome : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }
    : {},
);
const relatorio = [];
for (const p of PERFIS) {
  const ctx = await browser.newContext({ ...p, ...(p.nome.startsWith('android') ? { userAgent: devices['Pixel 7'].userAgent } : {}) });
  const page = await ctx.newPage();
  const erros = [];
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
  page.on('pageerror', (e) => erros.push(String(e)));
  page.on('requestfailed', (r) => erros.push(`falhou: ${r.url()} ${r.failure()?.errorText}`));
  await page.goto(url, { waitUntil: 'load' });
  await page.mouse.wheel(0, 1);
  await page
    .waitForFunction(() => /stage-ready|views-ready|no-webgl/.test(document.documentElement.className), null, { timeout: 45_000 })
    .catch(() => erros.push('cena não ficou pronta em 45 s'));
  const info = await page.evaluate(() => ({
    classes: document.documentElement.className,
    experiencia: document.documentElement.dataset.experience,
    alturaDoc: document.documentElement.scrollHeight,
    alturaTela: innerHeight,
  }));
  const amostras = [];
  const H = info.alturaDoc - info.alturaTela;
  for (const f of [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.4, 0.2, 0]) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(f * H));
    await page.waitForTimeout(900);
    amostras.push(
      await page.evaluate((f) => {
        const w = window;
        const c = w.__cinema;
        const s = c?.state ?? w.__stacked?.views?.find((v) => v.name === 'hero')?.state;
        const canvas = document.querySelector('.stage__canvas, .view-canvas.is-live');
        const cs = canvas ? getComputedStyle(canvas) : null;
        return {
          f,
          y: Math.round(scrollY),
          tempo: c ? +c.tl.time().toFixed(2) : null,
          rotY: s ? +s.toothRotY.toFixed(1) : null,
          orbita: s ? +s.orbit.toFixed(1) : null,
          corte: s ? +s.cut.toFixed(2) : null,
          arcada: s ? +s.archTeeth.toFixed(2) : null,
          canvasVisivel: !!cs && cs.opacity !== '0' && cs.display !== 'none' && cs.visibility !== 'hidden',
        };
      }, f),
    );
  }
  await page.screenshot({ path: `tests/.artifacts/probe-${engine}-${p.nome}.png` });
  relatorio.push({ perfil: p.nome, ...info, erros, amostras });
  console.log(`\n== ${p.nome} (${engine}) experiência=${info.experiencia} classes="${info.classes}"`);
  for (const a of amostras) console.log(JSON.stringify(a));
  if (erros.length) console.log('ERROS:', erros.slice(0, 8));
  await ctx.close();
}
await browser.close();
if (out) fs.writeFileSync(out, JSON.stringify(relatorio, null, 2));
