---
name: audit-performance
description: Audita acessibilidade (axe, WCAG 2.2 AA), desempenho (LCP, INP/TBT, CLS), carregamento, erros de console, SEO técnico (title, description, canonical, OG, sitemap, dados estruturados) e o peso da cena 3D do template. Use antes de publicar um cliente ou depois de mudanças em scripts, imagens ou na cena.
---

# audit-performance — auditoria técnica

## Metas do projeto
LCP ≤ 2,5 s · INP ≤ 200 ms (proxy: TBT) · CLS ≤ 0,1 · axe sem violações sérias · 0 erros de console · SEO 100 em produção indexável.

## Comandos
```bash
node scripts/build-variants.mjs alva-demo teste-producao
node scripts/qa/audit.mjs alva-demo          # Lighthouse mobile+desktop, pacotes, cena 3D, console
npx playwright test tests/e2e/fallback-a11y.spec.ts   # axe em 9 páginas, foco, sem WebGL, movimento reduzido
npx playwright test tests/e2e/navigation.spec.ts      # status, links, SEO, dados estruturados
```
Saídas: `tests/.artifacts/perf/auditoria-<variante>.json` e `lh-*.json`.

## Como interpretar
- **Neste ambiente, WebGL roda por software (SwiftShader).** No modo cinema (desktop) o TBT fica inflado (~1,2 s) por chamadas GL que em GPU custam dezenas de ms. Linha de base sem WebGL/movimento reduzido: desempenho 100, TBT 0. Confirme sempre em aparelho real ou no PageSpeed Insights após o deploy.
- SEO 66 na demonstração é esperado (`noindex`). Em produção sem `noindex` deve dar 100.
- `shared.*.js` ≈ 147 KB gzip é o Three.js — carregado só na home e só depois do `load` (desktop) ou da 1ª interação (mobile). Se aparecer na rede antes disso, alguém importou `three` no caminho crítico (ver `src/scripts/cinema/boot.ts`).

## Checklist
1. LCP: o elemento deve ser o `h1` do hero (texto). Fontes pré-carregadas em `BaseHead.astro`; não anime o `h1`.
2. CLS 0: modo cinema decidido no `<head>` antes da pintura; imagens com dimensões (`<Picture>`).
3. JS: nada de bibliotecas novas no caminho crítico; GSAP/Three por `import()` dinâmico.
4. 3D: triângulos por quadro (`window.__cinema.stage.info`), `qualityCells`, `dpr`, render só quando `dirty`.
5. Acessibilidade: contraste (tokens `--c-faint`, `--c-on-primary-*`), foco visível, nomes acessíveis, `aria` das abas, diálogos nativos.
6. SEO: `title`/`description` por página, canonical com `SITE_URL`, OG, sitemap só com rotas ativas, JSON-LD `Dentist` apenas com dados reais (nunca `aggregateRating`).

## Critérios de aceitação
- Mobile (Lighthouse, simulação 4G lenta): desempenho ≥ 90, LCP ≤ 2,5 s, CLS 0.
- axe: 0 violações sérias/críticas nas páginas testadas.
- 0 erros de console em todas as rotas e variantes.
