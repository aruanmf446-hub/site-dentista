---
name: visual-qa
description: Abre o site no navegador (Playwright + Chromium local), captura telas em larguras e pontos da rolagem, testa interações, compara com os artboards do Claude Design e corrige divergências. Inclui validar seções opcionais ligadas/desligadas e a continuidade do scroll 3D. Use antes de entregar qualquer mudança visual.
---

# visual-qa — conferência visual no navegador

## Ferramentas do repositório
| Comando | O que faz |
|---|---|
| `node scripts/build-variants.mjs [variantes]` | Gera `dist-<variante>/` (demo + fixtures de teste). |
| `node scripts/serve-static.mjs dist-<v> <porta>` | Serve o build (gzip, 404). Portas em `scripts/variants.mjs`. |
| `node scripts/qa/shot.mjs <url> <png> <w> <h> [scrollY] [full] [espera]` | Captura simples + erros de console. |
| `node scripts/qa/scroll-states.mjs <url> <pasta> <w> <h> [frações…]` | Percorre a sequência 3D, espera o scrub alcançar e salva PNG + `estados.json` (câmera, corte, arco…). |
| `node scripts/qa/element-shots.mjs <url> <pasta> <w> <h> "#sel:nome"…` | Rola até cada seção (dispara revelações) e captura o elemento. |
| `npx playwright test tests/visual` | Renderiza os artboards (`tests/visual/dc-render.ts`), captura o site no estado equivalente, gera lado a lado + diferença e verifica métricas de layout. |

## Roteiro de QA
1. **Hero (0%)**, **quadros A/B/C**, **arcada**, **clínica**, **agendar** e as 3 telas mobile: `npx playwright test tests/visual` e abrir `tests/.artifacts/visual/*-lado-a-lado.png` (esquerda = design, direita = site).
2. **Continuidade do scroll**: `scroll-states.mjs` com 10+ pontos; conferir que o dente nunca "pula" e que rolar para trás reverte (`tests/e2e/scene.spec.ts` já verifica numericamente).
3. **Seções opcionais**: capturar `teste-minimo` (tudo desligado) e `teste-completo` (tudo ligado) — menu, índice 00–0N, sem espaços vazios.
4. **Interações**: menu mobile, seletor de unidade, formulário (erro/sucesso), abas por camada, lista de especialidades, carrossel.
5. **Larguras**: 320/375/390/768/1024/1440.
6. Corrigir, reconstruir e repetir até as imagens baterem com o design.

## Leitura dos resultados
- Diferença de pixels típica: 1–13% (o site usa 3D real e conteúdo dinâmico). Picos fora disso indicam deslocamento de layout.
- Métricas falhando (ex.: `título: tamanho 47.9 (design 58 ± 2)`) apontam exatamente o que corrigir.
- Neste ambiente o WebGL é por software: aguarde `html.stage-ready`/`views-ready` antes de capturar.

## Critérios de aceitação
- Todos os testes de `tests/visual` passam; lado a lado revisado pessoalmente.
- Nenhum erro de console nas capturas.
- Variantes mínimas e completas sem quebra.

## Validação completa
```bash
npm test   # build de todas as variantes + toda a suíte Playwright
```
