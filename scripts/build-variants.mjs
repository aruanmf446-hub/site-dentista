// Gera um build estático por variante em dist-<nome>/ (para os testes).
// Uso: node scripts/build-variants.mjs [nome...]
import { execSync } from 'node:child_process';
import { VARIANTS } from './variants.mjs';
const only = process.argv.slice(2);
const names = only.length ? only : Object.keys(VARIANTS);
for (const name of names) {
  const t = Date.now();
  execSync('npx astro build', {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, CLINIC: name, OUT_DIR: `./dist-${name}`, ASTRO_TELEMETRY_DISABLED: '1' },
  });
  console.log(`✓ ${name} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
}
