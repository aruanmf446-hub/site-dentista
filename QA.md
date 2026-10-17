# QA — testes executados, evidências e limitações

Execução registrada em 16/10/2026, nesta branch, no ambiente de nuvem do Claude Code
(Linux, Chromium 141 do Playwright 1.64, **WebGL por software — SwiftShader**, sem GPU).

## Refino visual — sobreposições e nitidez (17/10/2026)
Investigado no build idêntico ao publicado (`3d326ea`) e no corrigido, em 390 × 844, 768 × 1024,
1024 × 768, 1280 × 800 e 1440 × 900.

**Sobreposições** — `scripts/qa/overlap-audit.mjs` projeta o que está visível do dente (ou de
cada dente da arcada) na tela e cruza com as linhas reais de texto visíveis, além de procurar
textos sobrepostos, texto sob o cabeçalho e invasão da margem lateral.

| Causa | Onde | Correção |
|---|---|---|
| Título do quadro A largo demais (42vw): a 2ª linha passava sob o dente centrado | 1280, 1440 | largura máx. 33vw / 500 px |
| Texto do B ainda visível enquanto o dente atravessava a tela rumo ao C | todas as larguras de desktop | texto/legendas do B saem em 57%; o dente só se desloca a partir de 62%; o C entra em 71% |
| Título A saindo tarde enquanto o dente crescia na órbita do B | 1024–1440 | saída em 13–19% |
| Dente do B sobre o título do B | 1024 | âncora 43% / texto até 30vw (900–1239 px) |
| Legendas "Polpa" e "Dentina" muito próximas: descrição de uma sobre o nome da outra | 390 | abaixo de 600 px só o nome (ligado ao modelo) |
| Aviso "Destaques ilustrativos" sobre as especialidades 5 e 6 | 390 | área segura inferior maior |
| WhatsApp flutuante sobre o arco e os campos do agendamento | desktop | sai de cena enquanto o formulário (que já tem botão de WhatsApp) está na tela |

Resultado: **26 achados → 0** (5 larguras × 28 pontos da timeline). As seções depois da
sequência (Clínica, Equipe, Unidades, Galeria, Convênios, Valores, Depoimentos, Dúvidas,
Agendamento, rodapé, cabeçalho e barras) foram percorridas tela a tela nas 5 larguras, sem
conflitos.

**Nitidez** — medido no navegador (tamanho na tela × resolução real do canvas):

| Aparelho | Antes | Depois |
|---|---|---|
| iPhone 390 (DPR 3) | 585 × 1266 (1,5×, **metade da resolução**), sem antisserrilhado | 780 × 1688 (2×), MSAA 4× |
| iPad 768 (DPR 2) | 1,5×, sem antisserrilhado | 2×, MSAA 4× |
| Notebook Retina 1440 (DPR 2) | 2520 × 1575 (1,75×, esticado 14% por CSS) | 2880 × 1800 (2×), MSAA 4× |

Outras causas: a geometria do celular era a mais grossa (célula 0,017, sem refino, porque o
iPhone informa 4 núcleos e caía em "fraco") → agora 0,016 → 0,011 no worker; as bordas das faces
de corte saíam em degraus da grade → o contorno é projetado na superfície exata
(`tooth-builder.ts`); `will-change: transform` permanente nos textos da cena (texto suave no
Safari) → removido. Imagens: cada foto recebe ≥ 1,1× os pixels necessários em DPR 2 e 3, exceto
o arco grande de "A clínica" no desktop (0,96 por causa do recorte) → `sizes` corrigido.
Antes × depois: `docs/qa/nitidez-iphone-antes-depois.jpg`, `docs/qa/nitidez-retina-antes-depois.jpg`.

Custo: triângulos no quadro B do iPhone 36,7 mil → 88,9 mil; geração da malha +15% (no worker,
fora da thread principal). Um governador baixa a resolução em degraus de 0,25× se os quadros
passarem de ~28 ms durante a rolagem.

**Testes:** `astro check` 0 erros; suíte completa **78 de 78** (16,9 min). Novos em
`tests/e2e/visual-refino.spec.ts`: sem sobreposição em 21 pontos da sequência a 1440, 1024 e
390; canvas = tamanho na tela × DPR (alvo 2×) com MSAA, também depois de girar (Retina e iPhone);
fotos com ≥ 95% dos pixels necessários (390 DPR 3 e 1440 DPR 2); WhatsApp flutuante fora do
formulário. Sequências atualizadas: `docs/qa/*-sequencia.jpg`.

**Limitações:** validado em Chromium com GPU emulada por software; Safari/iPhone real ainda não
(WebKit e o domínio da produção são bloqueados pela rede deste ambiente). Restam franjas finas
na aresta do esmalte cortado e na linha cervical quando o dente está muito ampliado.

## Correção do scroll 3D (16/10/2026)
Reproduzido no build idêntico ao publicado (mesmos arquivos com hash servidos pela Vercel no
deploy `dpl_ADgMC8AxAfCwPs4J7ZNJen7McgNP`, commit `60c1ca9`) com `scripts/qa/probe-scroll.mjs`.

| Causa reproduzida | Evidência (antes) | Correção |
|---|---|---|
| Abaixo de 900 px não havia sequência: `is-cinema` só ≥ 900 px; celular/tablet caíam no modo empilhado | 390 e 768 px: `experience=stacked`, sem timeline; corte e arcada nunca mudavam com a rolagem | Cinema em qualquer largura; `cine-compact` muda composição, rolagem por cena (72vh) e qualidade |
| Desktop: o primeiro quadro compilava os shaders na thread principal | rolar no instante em que o dente aparece: resposta em 992–1113 ms, tarefas longas de 757–824 ms + 249–309 ms | O palco só desenha depois de `warmup()` (compilação assíncrona + PMREM); resposta em 9–14 ms, sem tarefas longas > 100 ms |
| Atualizar/voltar no meio da sequência levava ao hero | `scrollY` 3600 → 0 após recarregar (o `scrollTo(0,0)` de medição do ScrollTrigger cancela a restauração do navegador) | Posição guardada em `pagehide` e devolvida após a montagem (só em recarregar/voltar) |
| Falha do WebGL recarregava a página e gravava `alva:no-webgl`, desligando o 3D na sessão inteira | código: `sessionStorage.setItem('alva:no-webgl','1'); location.reload()` | Teste de capacidade antes de montar; falha tardia desmonta na própria página, registra `console.error` e `data-webgl-error`; nada fica gravado (a chave antiga é apagada) |
| Desmontagem incompleta deixava a lista de tratamentos com largura 0 | `clearProps: 'all'` apagava o `style="--rows:…"` do markup | Limpa só as propriedades animadas |
| 1024 × 768: dente do quadro B sobre as legendas; arcada sobre o título das especialidades | capturas | Âncoras próprias para 900–1239 px |
| Barra de endereço do celular | trilha em `100vh`/`100svh` mudaria ao rolar | Palco em `vh` (viewport grande, estável) + faixa `--cine-ui-bottom`; redimensionamentos só de altura < 160 px não refazem a trilha |

Medição com `probe-scroll.mjs` (mesmos pontos de rolagem, Chromium):

| Perfil | Antes | Depois |
|---|---|---|
| desktop 1440 × 900 | cinema; corte e arcada mudam com a rolagem | idem |
| desktop 1024 × 768 | cinema | idem |
| tablet 768 × 1024 | empilhado: sem timeline, corte/arcada nunca aparecem | cinema compacto: corte abre, arcada forma, reverte |
| Android 390 × 844 | empilhado: só o dente do hero gira | cinema compacto: corte abre, arcada forma, reverte |

Sequências capturadas por tempo da timeline: `docs/qa/desktop-1440-sequencia.jpg`,
`docs/qa/desktop-1024-sequencia.jpg`, `docs/qa/tablet-768-sequencia.jpg`,
`docs/qa/mobile-390-sequencia.jpg` (hero → A → B → C → reconstrução → arcada → especialidades).

**Testes desta correção:** `npx astro check` 0 erros; suíte completa **70 de 70** (9,5 min).
Novos ou reescritos: sequência 0 → 100% → 0 em 4 perfis (1440, 1024, 768 tablet, 390 Android)
verificando variáveis da timeline **e** objetos Three.js (grupo do corte, arcada visível, posição
do esmalte, rotação do dente, câmera) **e** amostras de pixels lidas do canvas WebGL; toque em
especialidade no celular; girar o aparelho (390 → 844 paisagem → 1024 → 390); atualizar no meio
da sequência; âncoras `#especialidades`/`#tratamentos`; falha tardia do WebGL (desmontagem);
abas por camada agora sob movimento reduzido.

**Não executado:** Safari/WebKit — o download do WebKit (`cdn.playwright.dev`,
`playwright.download.prss.microsoft.com`) é recusado pela política de rede deste ambiente; testes
direto na URL de produção — o host `site-dentista-peach.vercel.app` também é recusado (o HTML e
os scripts publicados foram conferidos pela integração da Vercel). Ver "Limitações".

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
3. **Safari/Firefox não testados** — a suíte roda só em Chromium (com emulação de celular). O
   WebKit não pôde ser baixado neste ambiente (rede). O cinema compacto foi feito para o Safari
   (sem `normalizeScroll`, palco em `vh` estável, giro ocioso a ~30 quadros/s, DPR ≤ 1,5, sem
   MSAA), mas **precisa ser conferido num iPhone real** antes de ser dado como validado.
4. **Diferenças visuais deliberadas** do design estão listadas em `DESIGN.md`.
5. **Conteúdo** da demonstração é placeholder (`[Nome Sobrenome]`, `[Foto real — …]`); o build de
   produção recusa esses placeholders.
6. **Publicação** — o push para o GitHub foi liberado depois (acesso do app em "All
   repositories") e a Vercel publica a `main` (projeto `site-dentista`, produção
   `https://site-dentista-peach.vercel.app/`). Este contêiner não consegue abrir o domínio
   `*.vercel.app` (rede); a conferência da produção é feita pela integração da Vercel (status do
   deployment, logs, HTML e scripts servidos).
