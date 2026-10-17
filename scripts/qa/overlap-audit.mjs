// Auditoria de sobreposição da sequência 3D: em cada largura e em pontos da timeline,
// cruza o contorno projetado do dente/arcada com os blocos de texto visíveis, procura
// textos sobrepostos entre si e elementos que invadem a margem lateral.
// Uso: node scripts/qa/overlap-audit.mjs <url> [saida.json] [--shots=pasta]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { auditFrame } from './overlap-core.mjs';

const url = process.argv[2] || 'http://127.0.0.1:4400/';
const out = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : null;
const shots = (process.argv.find((a) => a.startsWith('--shots=')) || '').split('=')[1];
const TELAS = [
  { w: 390, h: 844, mobile: true },
  { w: 768, h: 1024, mobile: true },
  { w: 1024, h: 768 },
  { w: 1280, h: 800 },
  { w: 1440, h: 900 },
];
// tempos (em "telas") — o fim é limitado à duração de cada variante
const TEMPOS = [0, 0.3, 0.5, 0.8, 1.0, 1.3, 1.45, 1.6, 1.9, 2.2, 2.5, 2.65, 2.75, 2.85, 3.0, 3.15, 3.3, 3.5, 3.7, 4.1, 4.5, 5.0, 5.6, 6.2, 6.8, 7.4, 8.0, 8.6];

const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({
  executablePath: fs.existsSync(exe) ? exe : undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const relatorio = [];
let total = 0;
for (const t of TELAS) {
  const page = await browser.newPage({ viewport: { width: t.w, height: t.h }, isMobile: !!t.mobile, hasTouch: !!t.mobile });
  const erros = [];
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
  page.on('pageerror', (e) => erros.push(String(e)));
  await page.goto(url);
  await page.mouse.wheel(0, 1);
  await page.waitForFunction(() => window.__cinema?.live, null, { timeout: 60_000 });
  const dur = await page.evaluate(() => window.__cinema.tl.duration());
  for (const tempo of TEMPOS.filter((x) => x <= dur + 0.01)) {
    await page.evaluate((tempo) => {
      const c = window.__cinema;
      window.scrollTo({ top: c.st.start + (tempo / c.tl.duration()) * (c.st.end - c.st.start), behavior: 'instant' });
    }, tempo);
    await page.waitForFunction((tempo) => Math.abs(window.__cinema.tl.time() - tempo) < 0.01, tempo, { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(150);
    const r = await page.evaluate(auditFrame);
    total += r.achados.length;
    relatorio.push({ tela: `${t.w}x${t.h}`, ...r });
    if (r.achados.length) {
      console.log(`${t.w}x${t.h} t=${r.tempo} [${r.alvo} ${JSON.stringify(r.rect3d)}]`);
      for (const a of r.achados) console.log('   ', a.tipo, '|', a.item, '|', a.px + 'px', a.pct ? a.pct + '%' : '');
      if (shots) {
        fs.mkdirSync(shots, { recursive: true });
        await page.screenshot({ path: `${shots}/${t.w}x${t.h}-t${r.tempo}.png` });
      }
    }
  }
  if (erros.length) console.log(`${t.w}x${t.h} ERROS:`, erros.slice(0, 5));
  await page.close();
}
await browser.close();
console.log(`\nTotal de achados: ${total}`);
if (out) fs.writeFileSync(out, JSON.stringify(relatorio, null, 2));
process.exitCode = 0;
