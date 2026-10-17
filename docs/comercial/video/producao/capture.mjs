import { chromium } from '/home/user/site-dentista/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
const OUT = process.argv[2]; const only = process.argv[3];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
async function open(url, mobile) {
  const p = await b.newPage(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await p.goto(url); await p.mouse.wheel(0, 1);
  await p.waitForFunction(() => window.__cinema?.live, null, { timeout: 60000 });
  await p.waitForTimeout(800);
  return p;
}
async function toT(p, t) {
  await p.evaluate((t) => { const c = window.__cinema; const tot = c.tl.duration();
    window.scrollTo({ top: c.st.start + (Math.min(t, tot) / tot) * (c.st.end - c.st.start), behavior: 'instant' }); }, t);
  await p.waitForFunction((t) => Math.abs(window.__cinema.tl.time() - t) < 0.01 || window.__cinema.tl.time() >= window.__cinema.tl.duration() - 0.01, t, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(60);
}
const ease = (x) => x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x+2, 3)/2;
async function cine(name, url, mobile, t0, t1, n) {
  fs.mkdirSync(`${OUT}/${name}`, { recursive: true });
  const p = await open(url, mobile);
  await toT(p, t0); await p.waitForTimeout(1500);
  for (let i = 0; i < n; i++) { await toT(p, t0 + (t1 - t0) * (i / (n - 1)));
    await p.screenshot({ path: `${OUT}/${name}/${String(i).padStart(4,'0')}.jpg`, type: 'jpeg', quality: 92 }); }
  await p.close(); console.log('ok', name);
}
async function stills(name, url, mobile, ts) {
  const p = await open(url, mobile);
  for (const t of ts) { await toT(p, t); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/${name}-${t}.jpg`, type: 'jpeg', quality: 92 }); }
  await p.close(); console.log('ok', name);
}
async function contato(name, url, n) {
  fs.mkdirSync(`${OUT}/${name}`, { recursive: true });
  const p = await open(url, true);
  const top = await p.evaluate(() => { const s = document.getElementById('agendamento'); return s.getBoundingClientRect().top + scrollY; });
  const y0 = top - 40, y1 = top + 560;
  await p.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y0); await p.waitForTimeout(1500);
  for (let i = 0; i < n; i++) { const y = y0 + (y1 - y0) * ease(i / (n - 1));
    await p.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y); await p.waitForTimeout(30);
    await p.screenshot({ path: `${OUT}/${name}/${String(i).padStart(4,'0')}.jpg`, type: 'jpeg', quality: 92 }); }
  await p.close(); console.log('ok', name);
}
const A = 'http://127.0.0.1:4400/', Z = 'http://127.0.0.1:4407/';
const jobs = {
  stills2: async () => { await stills('desk-verde', 'http://127.0.0.1:4410/', false, [4.3, 6.0]); await stills('desk-rosa', 'http://127.0.0.1:4411/', false, [4.3, 6.0]); },
  stills: async () => { await stills('desk-alva', A, false, [0, 4.3, 6.0]); await stills('desk-azul', Z, false, [0, 4.3, 6.0]); },
  desk: () => cine('desk', A, false, 0, 2.9, 237),
  mob: () => cine('mob', A, true, 2.3, 7.4, 183),
  contato: () => contato('contato', A, 145),
};
for (const [k, f] of Object.entries(jobs)) if (!only || only === k) await f();
await b.close();
