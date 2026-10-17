// Mede quando o dente 3D aparece (classe stage-ready) após abrir a página e fotografa o início.
// Uso: node scripts/qa/startup-time.mjs [url] [prefixo]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const url = process.argv[2] || 'http://127.0.0.1:4400/';
const tag = process.argv[3] || 'startup';
const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (let run = 0; run < 2; run++) {
  const p = await b.newPage({ viewport: { width: 1536, height: 730 } });
  const erros = [];
  p.on('pageerror', (e) => erros.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
  await p.addInitScript(() => {
    window.__lt = [];
    try {
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true });
    } catch {}
  });
  await p.goto(url, { waitUntil: 'commit' });
  const t = await p.evaluate(
    () =>
      new Promise((res) => {
        const marks = {};
        const check = () => {
          const c = document.documentElement.classList;
          if (!marks.cinemaReady && c.contains('cinema-ready')) marks.cinemaReady = Math.round(performance.now());
          if (!marks.load && document.readyState === 'complete') marks.load = Math.round(performance.now());
          if (c.contains('stage-ready')) {
            marks.stageReady = Math.round(performance.now());
            const svg = document.querySelector('.hero__tooth-svg');
            marks.svgVisivelAntes = window.__svgSeen ?? false;
            return res(marks);
          }
          const svg = document.querySelector('.hero__tooth-svg');
          if (svg && getComputedStyle(svg).opacity !== '0' && getComputedStyle(svg).visibility !== 'hidden' && c.contains('is-cinema')) window.__svgSeen = true;
          requestAnimationFrame(check);
        };
        check();
      }),
  );
  if (process.env.LT) console.log('    tarefas longas [início, duração]:', JSON.stringify(await p.evaluate(() => window.__lt.filter((x) => x[1] > 150))));
  console.log(`execução ${run + 1}:`, JSON.stringify(t), erros.length ? erros.slice(0, 3) : 'sem erros');
  if (run === 1) await p.screenshot({ path: `tests/.artifacts/${tag}.png` });
  await p.close();
}
await b.close();
