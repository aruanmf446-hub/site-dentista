// Captura elementos da página (rolando até eles para disparar as animações).
// Uso: node scripts/qa/element-shots.mjs <url> <pasta> <largura> <altura> <seletor:nome> ...
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [url, outDir, w, h, ...pairs] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('pageerror', (e) => logs.push(e.message));
page.on('console', (m) => m.type() === 'error' && logs.push(m.text()));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
for (const pair of pairs) {
  const [sel, name] = pair.split(':');
  const el = page.locator(sel).first();
  if (!(await el.count())) { logs.push(`não encontrado: ${sel}`); continue; }
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  // percorre o elemento para disparar revelações
  const box = await el.boundingBox();
  if (box) for (let y = 0; y < box.height; y += 300) { await page.mouse.wheel(0, 300); await page.waitForTimeout(120); }
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1800);
  await el.screenshot({ path: `${outDir}/${name}.png` });
}
console.log(logs.join('\n') || 'sem erros de console');
await browser.close();
