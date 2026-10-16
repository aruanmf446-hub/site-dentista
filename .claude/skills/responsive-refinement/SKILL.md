---
name: responsive-refinement
description: Corrige layout, tipografia, espaçamento, overflow, comportamento mobile e inconsistências visuais do template, validando em 320, 375, 390, 768, 1024 e 1440 px. Use quando algo quebrar, transbordar ou divergir dos artboards em alguma largura.
---

# responsive-refinement — layout em todas as larguras

## Referências
- Artboards: `design/claude-design/*.dc.html` (desktop 1440 × 900; mobile 390 × 844).
- Tokens: `src/styles/tokens.css` — escalas fluidas calculadas **de 390 a 1440 px** a partir dos tamanhos do design (ex.: `--fs-h2` 36 → 58 px). Para um novo tamanho: `slope = (max−min)/1050`, `intercept = min − slope×390`, `clamp(min, intercept + slope·100vw, max)`.
- Margens: `--gutter` (96 px em 1440, mín. 20 px), `--gutter-r` (128 px à direita nas seções de conteúdo).
- Pontos de quebra usados: **900 px** (modo cinema e header em pílula; abaixo, layout mobile), **1240 px** (menu completo do header), **1024 px** (convênios/valores lado a lado).

## Armadilhas conhecidas (já resolvidas — não reintroduza)
- Estilos de componente filho: o projeto usa `scopedStyleStrategy: 'class'`; componentes reutilizáveis declaram base com `:where(.classe)` para que o pai possa sobrescrever posição/forma.
- `.trat a` / `.hdr a` herdavam cor em botões: use `a:not(.btn)`.
- Barra fixa do mobile: `--mobile-bar-h` (80 px + safe-area) é o `padding-bottom` do body; mude os dois juntos.
- Arcos: `border-radius: 9999px 9999px 0 0` gera semicírculo perfeito em qualquer largura.

## Procedimento
1. Reproduza: `node scripts/qa/shot.mjs http://127.0.0.1:4400/<rota> saida.png <largura> <altura> <scrollY> [fullPage]`.
2. Ache o culpado de overflow com o teste (ele imprime o seletor): `npx playwright test tests/e2e/mobile.spec.ts -g "rolagem horizontal"`.
3. Corrija no componente (CSS escopado) ou em `tokens.css` se for escala global.
4. Compare com o design: `npx playwright test tests/visual` → `tests/.artifacts/visual/*-lado-a-lado.png` e métricas (x, tamanho de fonte, arco, formulário).

## Critérios de aceitação
- Sem rolagem horizontal em 320/375/390/768/1024/1440 em todas as páginas.
- Alvos de toque ≥ 44 px no mobile; texto ≥ 15 px no corpo.
- Métricas do teste visual dentro da tolerância (ex.: título do hero 94 px ± 2, x = 96 ± 4).
- Barra fixa não cobre o rodapé nem o formulário.

## Validação
```bash
node scripts/build-variants.mjs alva-demo teste-unidade-unica
npx playwright test tests/e2e/mobile.spec.ts tests/visual
```
