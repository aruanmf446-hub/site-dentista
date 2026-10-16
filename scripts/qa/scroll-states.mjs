// Captura a sequência cinematográfica em vários pontos da rolagem.
// Uso: node scripts/qa/scroll-states.mjs <url> <pasta-saida> [largura] [altura] [pontos...]
// Os pontos são frações do percurso da .cinema (0..1). Ex.: 0 0.1 0.2 ...
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [url, outDir, w = '1440', h = '900', ...pts] = process.argv.slice(2);
const points = pts.length ? pts.map(Number) : [0, 0.06, 0.11, 0.16, 0.22, 0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.8, 0.9, 1];
fs.mkdirSync(outDir, { recursive: true });
const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.documentElement.classList.contains('stage-ready') || document.documentElement.classList.contains('views-ready'), null, { timeout: 30000 }).catch(() => logs.push('stage não ficou pronto'));
await page.waitForTimeout(800);
const info = [];
for (const p of points) {
  const y = await page.evaluate((p) => {
    const c = document.querySelector('[data-cinema]');
    const top = window.scrollY + c.getBoundingClientRect().top;
    const dist = c.offsetHeight - window.innerHeight;
    return Math.round(top + p * dist);
  }, p);
  await page.evaluate((y) => window.scrollTo(0, y), y);
  // espera a timeline (scrub) alcançar a rolagem — renderização por software é lenta
  await page.waitForFunction(() => {
    const c = window.__cinema;
    if (!c) return true;
    const target = c.st.progress * c.tl.duration();
    return Math.abs(c.tl.time() - target) < 0.01;
  }, null, { timeout: 20000, polling: 200 }).catch(() => {});
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => {
    const c = window.__cinema;
    if (!c) return null;
    const s = c.state;
    return { t: +c.tl.time().toFixed(3), orbit: +s.orbit.toFixed(2), elev: +s.elevation.toFixed(2), cut: +s.cut.toFixed(3), lift: +s.enamelLift.toFixed(3), arch: +s.arch.toFixed(3), spec: +s.spec.toFixed(2), anchor: +c.cine.anchor.toFixed(3), shape: +c.cine.arch.toFixed(3), cam: c.stage.camera.position.toArray().map((v) => +v.toFixed(3)) };
  });
  info.push({ p, y, ...st });
  await page.screenshot({ path: `${outDir}/p${String(Math.round(p * 1000)).padStart(4, '0')}.png` });
}
fs.writeFileSync(`${outDir}/estados.json`, JSON.stringify(info, null, 2));
console.log(JSON.stringify(info));
console.log(logs.join('\n') || 'sem erros de console');
await browser.close();
