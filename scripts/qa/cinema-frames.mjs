// Captura quadros da sequência cinema em pontos da timeline (tempo em "telas").
// Uso: node scripts/qa/cinema-frames.mjs <url> <pasta> [largura] [altura] [--mobile] [--webkit]
import { chromium, webkit } from '@playwright/test';
import fs from 'node:fs';
const [url = 'http://127.0.0.1:4400/', out = 'tests/.artifacts/frames', w = '390', h = '844'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const mobile = process.argv.includes('--mobile');
const useWebkit = process.argv.includes('--webkit');
fs.mkdirSync(out, { recursive: true });
const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = useWebkit
  ? await webkit.launch()
  : await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, isMobile: mobile && !useWebkit, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
const erros = [];
page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
page.on('pageerror', (e) => erros.push(String(e)));
await page.goto(url);
await page.mouse.wheel(0, 1);
await page.waitForFunction(() => window.__cinema?.live, null, { timeout: 60_000 });
const times = [0, 0.5, 1.0, 1.25, 1.6, 2.2, 2.9, 3.6, 4.3, 5.0, 5.6, 6.2];
for (const t of times) {
  await page.evaluate((t) => {
    const c = window.__cinema;
    const total = c.segments.reduce((a, s) => a + s.len, 0);
    window.scrollTo({ top: c.st.start + (Math.min(t, total) / total) * (c.st.end - c.st.start), behavior: 'instant' });
  }, t);
  await page.waitForFunction((t) => Math.abs(window.__cinema.tl.time() - t) < 0.02 || window.__cinema.tl.time() >= window.__cinema.tl.duration() - 0.01, t, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/t${t.toFixed(2)}.png` });
}
console.log('erros:', erros);
await browser.close();
