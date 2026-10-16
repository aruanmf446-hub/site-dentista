#!/usr/bin/env node
/**
 * Cria a pasta de um novo cliente a partir do modelo.
 *   node scripts/nova-clinica.mjs sorriso-pleno
 * Depois: edite src/clients/sorriso-pleno/clinic.ts e rode
 *   CLINIC=sorriso-pleno npm run dev
 */
import fs from 'node:fs';
import path from 'node:path';

const slug = process.argv[2];
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('Uso: node scripts/nova-clinica.mjs <slug-em-minusculas-com-hifens>');
  process.exit(1);
}
const dest = path.join('src', 'clients', slug);
if (fs.existsSync(dest)) {
  console.error(`Já existe: ${dest}`);
  process.exit(1);
}
fs.mkdirSync(path.join(dest, 'fotos'), { recursive: true });
fs.copyFileSync(path.join('src', 'clients', '_modelo', 'clinic.ts'), path.join(dest, 'clinic.ts'));
fs.writeFileSync(path.join(dest, 'fotos', 'LEIA-ME.txt'), 'Coloque aqui as fotos REAIS da clínica (JPG/PNG/WebP, no mínimo 1600 px no lado maior).\nImporte no clinic.ts: import fachada from "./fotos/fachada.jpg";\n');
console.log(`✓ Cliente criado em ${dest}

Próximos passos:
  1. Edite ${dest}/clinic.ts (todos os campos entre [colchetes]).
  2. Veja ao vivo:     CLINIC=${slug} npm run dev
  3. Valide e gere:    CLINIC=${slug} npm run build
  4. Para publicar, mude site.modo para 'producao' — o build falha se faltar algo.
  5. Na Vercel, defina a variável de ambiente CLINIC=${slug} no projeto do cliente.
Guia completo: CUSTOMIZATION.md`);
