#!/usr/bin/env node
/**
 * Auditoria técnica de uma variante já construída (dist-<variante>/).
 *   node scripts/qa/audit.mjs [variante=alva-demo]
 * Gera tests/.artifacts/perf/auditoria-<variante>.json e imprime um resumo:
 *  - Lighthouse mobile e desktop (desempenho, acessibilidade, boas práticas, SEO)
 *  - peso dos pacotes JS/CSS (bruto e gzip)
 *  - peso da cena 3D (triângulos, draw calls, tempo de geração da geometria)
 *  - erros de console na home
 * Observação: neste ambiente o WebGL roda por software (SwiftShader); os
 * números de TBT do modo cinema são piores que em aparelhos com GPU.
 */
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium } from '@playwright/test';
import { VARIANTS } from '../variants.mjs';

const variant = process.argv[2] || 'alva-demo';
const port = VARIANTS[variant] ?? 4499;
const dist = `dist-${variant}`;
if (!fs.existsSync(dist)) {
  console.error(`Faltou o build: node scripts/build-variants.mjs ${variant}`);
  process.exit(1);
}
const chrome = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const out = 'tests/.artifacts/perf';
fs.mkdirSync(out, { recursive: true });

const server = spawn('node', ['scripts/serve-static.mjs', dist, String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const base = `http://127.0.0.1:${port}`;
const result = { variante: variant, data: new Date().toISOString(), lighthouse: {}, pacotes: [], cena: null, console: [] };

try {
  for (const [nome, extra] of [
    ['mobile', ''],
    ['desktop', '--preset=desktop'],
  ]) {
    const file = path.join(out, `lh-${variant}-${nome}.json`);
    execSync(
      `npx lighthouse ${base}/ --quiet --chrome-flags="--headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader" ${extra} --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=${file}`,
      { stdio: 'ignore', env: { ...process.env, CHROME_PATH: chrome } },
    );
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    const a = d.audits;
    result.lighthouse[nome] = {
      notas: Object.fromEntries(Object.entries(d.categories).map(([k, v]) => [k, Math.round(v.score * 100)])),
      LCP: a['largest-contentful-paint'].displayValue,
      TBT: a['total-blocking-time'].displayValue,
      CLS: a['cumulative-layout-shift'].displayValue,
      FCP: a['first-contentful-paint'].displayValue,
      peso: a['total-byte-weight'].displayValue,
    };
  }

  for (const f of fs.readdirSync(path.join(dist, '_astro'))) {
    if (!/\.(js|css)$/.test(f)) continue;
    const buf = fs.readFileSync(path.join(dist, '_astro', f));
    result.pacotes.push({ arquivo: f, kb: +(buf.length / 1024).toFixed(1), gzipKb: +(zlib.gzipSync(buf).length / 1024).toFixed(1) });
  }
  result.pacotes.sort((a, b) => b.gzipKb - a.gzipKb);

  const browser = await chromium.launch({ executablePath: fs.existsSync(chrome) ? chrome : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => m.type() === 'error' && result.console.push(m.text()));
  page.on('pageerror', (e) => result.console.push(e.message));
  await page.goto(`${base}/`);
  await page.waitForFunction(() => document.documentElement.classList.contains('stage-ready'), null, { timeout: 60000 }).catch(() => {});
  result.cena = await page.evaluate(() => {
    const c = window.__cinema;
    if (!c?.stage) return null;
    c.stage.render();
    return { ...c.stage.info, segmentos: c.segments };
  });
  await browser.close();
} finally {
  server.kill();
}

fs.writeFileSync(path.join(out, `auditoria-${variant}.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ lighthouse: result.lighthouse, top5: result.pacotes.slice(0, 5), cena: result.cena && { triangulos: result.cena.triangles, chamadas: result.cena.calls }, errosConsole: result.console.length }, null, 2));
