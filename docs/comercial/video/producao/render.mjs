import { chromium } from '/home/user/site-dentista/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
const S = '/tmp/claude-0/-home-user-site-dentista/48f1d8b6-3991-5f79-88c9-b5478f3e2d78/scratchpad';
const [out, times] = [process.argv[2], process.argv[3]];
fs.mkdirSync(out, { recursive: true });
const FR = Object.fromEntries(['desk', 'mob', 'contato'].map((d) => [d, fs.readdirSync(`${S}/cap/${d}`).length]));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await pg.addInitScript((f) => { window.FRAMES = f; }, FR);
await pg.goto('http://127.0.0.1:4500/comp/index.html'); await pg.evaluate(() => document.fonts.ready);
const list = times ? times.split(',').map(Number) : Array.from({ length: Math.round(37.5 * 30) }, (_, i) => i / 30);
for (const [i, t] of list.entries()) {
  await pg.evaluate((t) => window.render(t), t);
  await pg.screenshot({ path: times ? `${out}/p${t.toFixed(2)}.jpg` : `${out}/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 94 });
}
console.log('frames', list.length, FR); await b.close();
