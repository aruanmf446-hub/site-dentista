// @ts-check
import { defineConfig } from 'astro/config';

/**
 * Configuração base do template.
 * - CLINIC: pasta do cliente em src/clients/<CLINIC>/ (padrão: alva-demo)
 * - SITE_URL: URL pública (sobrepõe site.url do cliente nas URLs canônicas)
 * - OUT_DIR: diretório de saída (usado pelos testes de variantes)
 */
export default defineConfig({
  site: process.env.SITE_URL || undefined,
  output: 'static',
  // Estilos escopados alcançam a raiz de componentes filhos via `class`.
  scopedStyleStrategy: 'class',
  trailingSlash: 'always',
  outDir: process.env.OUT_DIR || './dist',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  devToolbar: { enabled: false },
  vite: {
    build: { chunkSizeWarningLimit: 900 },
    worker: { format: 'es' },
  },
});
