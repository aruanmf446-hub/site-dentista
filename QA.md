# QA — testes executados, evidências e limitações

Execução registrada em 16/10/2026, nesta branch, no ambiente de nuvem do Claude Code
(Linux, Chromium 141 do Playwright 1.64, **WebGL por software — SwiftShader**, sem GPU).

## Como reproduzir
```bash
npm ci
npx astro check          # TypeScript + componentes Astro
npm test                 # constrói as 9 variantes (dist-*) e roda toda a suíte Playwright
node scripts/qa/audit.mjs   # Lighthouse + peso da cena (depois de npm test, com os servidores no ar)
```

## Resultado
| Verificação | Resultado |
|---|---|
| `npx astro check` | **0 erros, 0 avisos** (111 arquivos) |
| Build de produção das 9 variantes (`scripts/build-variants.mjs`) | **ok** — alva-demo, teste-unidade-unica, teste-tres-unidades, teste-dois-tratamentos, teste-dez-tratamentos, teste-minimo, teste-completo, teste-azul-foto, teste-producao |
| Playwright (unitários + e2e + visuais) | **63 de 63 aprovados** (7,4 min) |

Na primeira execução completa, 62 passaram e 1 falhou (`empilhado (mobile) › vistas 3D ancoradas`):
o teste lia a rotação inicial sem garantir que a página estava no topo e esperava 400 ms fixos.
Foi corrigido para partir do topo e esperar a rotação mudar; repetido 3× isoladamente e depois na
suíte inteira — aprovado. Não houve mudança no código do site para isso.

## Os 20 testes obrigatórios
| # | Requisito | Onde é verificado | Status |
|---|---|---|---|
| 1 | Build de produção | `npm test` → `build-variants.mjs`; `teste-producao` passa a validação de produção | ✅ |
| 2 | TypeScript | `npx astro check` (modo estrito) | ✅ |
| 3 | Schema e configuração | `tests/unit/schema.spec.ts` (12 testes: demo, `_modelo`, Valores desligado, placeholders bloqueados em produção, consentimento, revisão de preços, referências, cores/slugs, 1 tratamento, contraste, mensagem do WhatsApp) | ✅ |
| 4 | Menu e links | `navigation.spec.ts`: todas as rotas de 5 variantes respondem 200, sem links internos quebrados; menu só com seções ativas; rotas desligadas = 404 | ✅ |
| 5 | Formulários e WhatsApp | `forms.spec.ts`: validação, erros, mensagem montada, abre o WhatsApp da unidade escolhida, nunca "confirma" horário; demo abre aviso em vez de número inventado | ✅ |
| 6 | Uma unidade | `forms.spec.ts` (sem seletor, WhatsApp direto) + `navigation.spec.ts` (`/unidades/` não gerada) | ✅ |
| 7 | Três unidades | `forms.spec.ts` (escolha de unidade antes do WhatsApp) | ✅ |
| 8 | Dois tratamentos | `scene.spec.ts` `[teste-dois-tratamentos]` (lista de 2, layout "poucos") | ✅ |
| 9 | Dez tratamentos | `scene.spec.ts` `[teste-dez-tratamentos]` (10 itens, 2 colunas) | ✅ |
| 10 | Opcionais desativadas | `teste-minimo`: navegação, menu, cena adaptada, rotas 404 | ✅ |
| 11 | Opcionais ativadas | `teste-completo`: todas as rotas, menu completo | ✅ |
| 12 | Navegação mobile | `mobile.spec.ts`: menu em diálogo (teclado, Esc, foco), barra fixa, alvos ≥ 44 px, sem rolagem horizontal em 320/375/390/768/1024/1440 | ✅ |
| 13 | Abas de tratamentos | `mobile.spec.ts`: ARIA `tablist`, setas do teclado, troca da vista 3D | ✅ |
| 14 | Especialidades interativas | `scene.spec.ts`: clique rola até o trecho e muda o destaque na arcada (desktop) e no mobile | ✅ |
| 15 | Cena 3D | `scene.spec.ts`: valores de câmera/rotação/corte/esmalte/arcada lidos do palco em cada estado; legendas presas à projeção (< 3 px) | ✅ |
| 16 | Scroll para frente e para trás | `scene.spec.ts`: avança até a arcada e volta ao quadro B; estado revertido confere | ✅ |
| 17 | Sem erros de console | todas as specs e2e registram `console.error`/`pageerror` e falham se houver | ✅ |
| 18 | Fallback sem WebGL | `fallback-a11y.spec.ts`: WebGL desligado → ilustrações SVG do design, conteúdo completo | ✅ |
| 19 | Movimento reduzido | `fallback-a11y.spec.ts`: sem cinema nem animações; quadro C parado | ✅ |
| 20 | Comparação com os artboards | `tests/visual/visual.spec.ts`: renderiza os `.dc.html` originais e compara lado a lado + métricas de posição | ✅ |

Acessibilidade adicional: axe-core (regras WCAG 2.0/2.1/2.2 A e AA) em 9 páginas — **0 violações
sérias ou críticas**; foco visível e link "pular para o conteúdo" testados.

## Evidências — scroll 3D no navegador
Capturas geradas pelos testes (originais em `tests/.artifacts/`, não versionadas; cópias
comprimidas em `docs/qa/`).

| Estado | Imagem |
|---|---|
| Hero (0) | `docs/qa/cena-00-hero.jpg` |
| Quadro A | `docs/qa/cena-02-quadro-a.jpg` |
| Quadro B — corte, esmalte erguido, legendas | `docs/qa/cena-03-quadro-b.jpg` |
| Quadro C — lista e CTA | `docs/qa/cena-04-quadro-c.jpg` |
| Reconstrução do dente | `docs/qa/cena-05-reconstrucao.jpg` |
| Arcada das especialidades | `docs/qa/cena-06-arcada.jpg` |
| Clique em Periodontia | `docs/qa/cena-09-clique-periodontia.jpg` |
| Mobile: hero 3D / arcada | `docs/qa/mobile-hero.jpg`, `docs/qa/mobile-arcada.jpg` |
| Variantes (mínimo, 2 e 10 tratamentos, cor azul + foto) | `docs/qa/variante-*.jpg` |
| Sem WebGL / movimento reduzido | `docs/qa/fallback-sem-webgl.jpg`, `docs/qa/fallback-movimento-reduzido.jpg` |
| Design × implementação | `docs/qa/design-*.jpg` |

Valores medidos pelo teste de cena (`window.__cinema.state`) mudam com o progresso e voltam ao
rolar para trás; a cena no hero tem 19.890 triângulos e 3 chamadas de desenho.

## Comparação visual com os artboards (1440 × 900 e 390 × 844)
Diferença de pixels (pixelmatch, limiar 0,18) entre o artboard renderizado e o site:

| Artboard | Diferença | Observação |
|---|---|---|
| Main (hero) | 5,0 % | métricas de posição (título, arco, formulário) dentro da tolerância |
| Tratamentos A / B / C | 6,4 % / 8,2 % / 6,2 % | o dente 3D substitui o SVG plano do design |
| Especialidades | 0,8 % | |
| Agendar | 10,2 % | campo "WhatsApp" removido (LGPD) — ver `DESIGN.md` |
| Clínica | 1,5 % | |
| Mobile Hero / Tratamentos / Agendar | 8,8 % / 12,7 % / 10,6 % | 3D real e abas com painel de texto |

## Desempenho (Lighthouse 13, servidor estático local com gzip)
| Página | Perf. | LCP | TBT | CLS | A11y | Boas práticas |
|---|---|---|---|---|---|---|
| Home demo — mobile | 95–97 | 2,2–2,3 s | 130–210 ms | 0 | 100 | 100 |
| Home produção (fixture) — mobile | 98 | 2,2 s | 70 ms | 0 | 100 | 100 |
| Tratamento `/tratamentos/limpeza/` — mobile | 99 | 1,9 s | 20 ms | 0 | 100 | 100 |
| Home demo — mobile sem WebGL | 94 | 2,4 s | 200 ms | 0 | — | — |
| Home demo — desktop (cinema) | 70–71 | 0,7 s | 1,2 s | 0 | 100 | 100 |

SEO marca 66 porque a demonstração e a fixture de produção (fictícia) são **propositalmente**
`noindex` + `robots.txt Disallow` — o único item reprovado é `is-crawlable`. Um cliente real em
produção sem `site.noindex` gera página indexável.

Pacotes (gzip): three ≈ 147 KB, GSAP 26 KB, ScrollTrigger 17 KB — carregados só depois do
evento `load`; a geometria é gerada em Web Worker.

## Limitações conhecidas (honestas)
1. **WebGL por software.** Todo o 3D foi verificado com SwiftShader. O TBT de 1,2 s no desktop é
   dominado pela compilação de shaders e pelo desenho em CPU; em GPU real deve cair bastante, mas
   **isso não foi medido**. Falta validar em aparelhos reais (iPhone/Safari, Android médio,
   notebook com GPU integrada). INP não é medido pelo Lighthouse em laboratório; o TBT é o
   indicador usado aqui.
2. **Bordas do corte do dente.** Com a resolução atual da malha (Surface Nets), as bordas do corte
   longitudinal mostram pequenos degraus quando o dente está muito ampliado (quadro B). Melhoria
   possível: resolução maior só para o corte, ou um GLB modelado (`cena3d.modeloGlb`).
3. **Safari/Firefox não testados** — a suíte roda só em Chromium.
4. **Diferenças visuais deliberadas** do design estão listadas em `DESIGN.md`.
5. **Conteúdo** da demonstração é placeholder (`[Nome Sobrenome]`, `[Foto real — …]`); o build de
   produção recusa esses placeholders.
6. **Publicação** — ver o relatório final da entrega (push e deploy dependem de permissões externas).
