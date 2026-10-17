// Recorta o dente em pontos da timeline e imprime o estado da cena (corte, esmalte, arcada).
// Uso: SHOT=1 node scripts/qa/tooth-frames.mjs 2.5,4.3 prefixo 2   (tempos, prefixo, DPR)
// Servidor do build em http://127.0.0.1:4400/; imagens em tests/.artifacts/<prefixo>-<t>.png
import { chromium } from '@playwright/test';
const times = (process.argv[2]||'3.5').split(',').map(Number); const tag = process.argv[3]||'s'; const dpr = Number(process.argv[4]||1.25);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1536, height: 730 }, deviceScaleFactor: dpr });
await p.goto('http://127.0.0.1:4400/');
await p.mouse.wheel(0,1);
await p.waitForFunction(() => window.__cinema?.live, null, { timeout: 180000 });
await p.waitForTimeout(4000);
for (const t of times) {
  await p.evaluate((t) => { const c = window.__cinema; window.scrollTo({ top: c.st.start + (t / c.tl.duration()) * (c.st.end - c.st.start), behavior: 'instant' }); }, t);
  await p.waitForFunction((t) => Math.abs(window.__cinema.tl.time() - t) < 0.005, t, { timeout: 180000 });
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => { const c = window.__cinema; const s = c.stage; const st = c.state; const rr = s.screenRect('tooth', 3); const cv = document.querySelector('[data-stage-canvas]').getBoundingClientRect();
    return { st: Object.fromEntries(['cut','enamelLift','enamelTilt','arch','archTeeth','rootClip','orbit','toothRotY','dark'].map(k=>[k,+st[k].toFixed(3)])), r: rr && { x: rr.left + cv.left, y: rr.top + cv.top, w: rr.right - rr.left, h: rr.bottom - rr.top } }; });
  console.log(t, JSON.stringify(r.st));
  if (r.r && process.env.SHOT) { const c = r.r; await p.screenshot({ path: `tests/.artifacts/${tag}-${t}.png`, clip: { x: Math.max(0,c.x-10), y: Math.max(0,c.y-10), width: Math.min(c.w+20, 1536), height: Math.min(730-Math.max(0,c.y-10), c.h+20) } }); }
}
await b.close();
