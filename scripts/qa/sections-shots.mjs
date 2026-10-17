// Capturas das seções depois da sequência 3D (página inteira abaixo do cinema).
// Uso: node scripts/qa/sections-shots.mjs <url> <pasta>
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [url = 'http://127.0.0.1:4400/', out = 'tests/.artifacts/secoes'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({
  executablePath: fs.existsSync(exe) ? exe : undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
for (const [w, h, mobile] of [
  [390, 844, 1],
  [768, 1024, 1],
  [1024, 768, 0],
  [1280, 800, 0],
  [1440, 900, 0],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: !!mobile, hasTouch: !!mobile, deviceScaleFactor: 1 });
  await page.goto(url);
  // telas reais (como o visitante vê), da saída do cinema até o rodapé
  const top = await page.evaluate(() => {
    const c = document.querySelector('[data-cinema]');
    return c ? Math.round(scrollY + c.getBoundingClientRect().bottom) : 0;
  });
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  let i = 0;
  for (let y = top; y < H; y += Math.round(h * 0.85)) {
    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), Math.min(y, H - h));
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${out}/${w}-${String(i++).padStart(2, '0')}.png` });
    if (y >= H - h) break;
  }
  await page.close();
}
await browser.close();
