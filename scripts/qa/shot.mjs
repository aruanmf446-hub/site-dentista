// Uso: node scripts/qa/shot.mjs <url> <saida.png> [largura] [altura] [scrollY] [fullPage] [waitMs]
import { chromium } from '@playwright/test';
const [url, out, w = '1440', h = '900', scrollY = '0', full = '0', wait = '600'] = process.argv.slice(2);
const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(+wait);
if (+scrollY) { await page.evaluate((y) => window.scrollTo(0, y), +scrollY); await page.waitForTimeout(+wait); }
await page.screenshot({ path: out, fullPage: full === '1' });
console.log(logs.join('\n') || 'sem erros de console');
await browser.close();
