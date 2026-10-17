# Motion — timeline 3D e animações

## 1. Sequência cinematográfica (modo cinema)
Uma **única timeline** GSAP, controlada por um ScrollTrigger (`scrub: 1.2`) sobre `.cinema`.
A unidade de tempo é **uma cena** (`--cine-unit` de rolagem: 1,5 tela no desktop, 1,1 no celular). As cenas ativas formam segmentos:

| Segmento | Comprimento | Conteúdo |
|---|---|---|
| `inicio` | 1 | Hero → arco se expande → quadro A |
| `tratamentos` | 3 | Storyboard A (0–15%), B (15–55%), C (55–100%) |
| `especialidades` | 1 + n × 0,55 + 0,35 | Reconstrução → arcada → uma especialidade a cada 0,55 tela |

Sem `tratamentos`, o hero vai direto à arcada; sem `especialidades`, a sequência termina no quadro C.

### Estado animado
- `state` (`src/scripts/three/state.ts`) → lido pelo palco 3D a cada quadro.
- `cine` → âncora de enquadramento (índice fracionário em `hero, trat-a, trat-b, trat-c`) e forma
  do arco vinho (`0` arco do hero · `1` arco largo do quadro A · `2` tela cheia · `3` recolhido).
- Textos dos painéis → `opacity/x/y` pela mesma timeline.

### Keyframes (de `src/scripts/cinema/cinema.ts`)
**Hero → A** (segmento `inicio`)
| Faixa | O que acontece |
|---|---|
| 0–0,44 | texto do hero sobe e some; formulário desce; contorno do arco e "Role para conhecer" somem |
| 0,04–0,96 | arco vinho expande do arco do hero ao arco largo (clip-path) |
| 0–1 | enquadramento hero → quadro A; dente −22° → −20°, inclinação −9° → −6°, elevação 4° → 2° |
| 0,58–0,94 | título do quadro A entra (sobe 28 px); "Role para abrir" |

**Tratamentos** (`T(f)` = fração da cena)
| Faixa | Câmera / objeto | Interface |
|---|---|---|
| 0–0,15 (A) | dente gira −20° → 0° | arco vira tela cheia (0,06–0,22) |
| 0,15–0,60 (B) | órbita 0° → 35°, desce até −5°, distância 0,95; corte abre (0,17–0,41); esmalte sobe 0 → 0,105 (≈ 55 px); polpa brilha | título A sai (0,13–0,19, antes de o dente crescer); texto B entra (0,25); legendas uma a uma (0,32–0,52), presas ao modelo por projeção; texto e legendas saem (0,57) |
| 0,60–1 (C) | só depois que o texto B saiu: enquadramento vai ao terço esquerdo (0,62–0,80); esmalte → 0,25 (≈ 130 px) e −8°; órbita 26°, elevação 3°; giro lento (ocioso) | lista entra da direita em sequência (0,73–0,89); CTA (0,90) |

**Especialidades**
| Faixa | O que acontece |
|---|---|
| 0–0,37 | quadro C sai; o dente se **reconstrói** (quadrante volta, esmalte desce, polpa apaga) |
| 0,14–0,56 | o fundo vinho recolhe com borda em arco invertido |
| 0,34–0,88 | câmera sobe a 48° e recua para a arcada; o dente gira −93° e pousa na posição 12; a raiz "entra" na gengiva (plano de corte) |
| 0,55–1 | os demais dentes surgem em onda ao redor da curva |
| 1 + i × 0,55 | troca da especialidade i (destaque interpolado entre presets) |

### Interação e acessibilidade
- Clique na especialidade → rola até o trecho dela (`espHooks.scrollTo`).
- Links `/#tratamentos`, `/#especialidades` → os ids passam para marcadores na trilha.
- Foco por teclado dentro de um painel invisível → rola até o trecho em que ele aparece.
- `prefers-reduced-motion` → modo empilhado estático (quadro C parado, abas por camada).

### Celular e tablet (< 900 px): a mesma sequência, compacta
A timeline é **a mesma** do desktop. `html.cine-compact` muda só:

| O quê | Desktop | Compacto |
|---|---|---|
| Rolagem por cena (`--cine-unit`) | 150vh | 110vh |
| Composição | âncoras e textos do artboard Main | hero do MobileHero; quadro A centrado no arco; B com o dente à esquerda e legendas à direita; C com o dente no canto superior direito e a lista (até 6 itens) abaixo; arcada sob o título, especialidades em 2 colunas |
| Qualidade 3D | DPR até 2, MSAA 4×, geometria 0,016 → 0,0095 | DPR até 2, MSAA 4×, geometria 0,016 → 0,011 |
| Giro ocioso | 60 quadros/s | ~30 quadros/s |
| Legendas do quadro B | nome + descrição | só o nome abaixo de 600 px (polpa e dentina ficam muito próximas) |

**Nitidez.** O canvas é desenhado em até 2× a tela (telas 3× também ficam em 2×: diferença
imperceptível, 2,25× menos pixels) com antisserrilhado 4×, e sempre no tamanho real em que
aparece (redimensionar, girar, zoom do navegador ou trocar de monitor refazem o canvas — nunca
é esticado por CSS). Um governador de resolução reduz 0,25× por vez quando os quadros desenhados
em sequência passam de ~40 ms (abaixo de ~25 quadros/s), nunca abaixo da densidade nativa da
tela no desktop nem de 1,5× no celular. A geometria fina é
gerada no worker; as faces de corte têm o contorno projetado sobre a superfície exata
(`projectCutOutline`/`projectCutSurface` em `tooth-builder.ts`), sem degraus da grade.

A altura do palco usa `vh` (viewport grande no iOS/Android): a barra de endereço aparecendo ou
sumindo não refaz a trilha. O conteúdo do fundo respeita a faixa coberta pelas barras do
navegador (`--cine-ui-bottom` = `100vh − 100svh`) e a barra fixa de WhatsApp. Girar o aparelho
ou cruzar 900 px troca a composição e recalcula a trilha sem recarregar a página.

### Carregamento e falhas
- Página e textos primeiro; o 3D começa após o `load` (ou no primeiro toque/rolagem).
- O palco **só desenha depois de compilar os shaders** (`stage.warmup()`); até lá os SVGs do
  design ficam no lugar. Desenhar antes travava a rolagem por ~0,8 s logo que o dente aparecia.
- Sem WebGL (teste de capacidade) → fallback estático direto.
- Falha tardia (contexto recusado, erro na geometria, 25 s sem a cena pronta) → a sequência é
  desmontada na própria página (`teardown` em `cinema.ts`): ids das âncoras voltam aos painéis,
  o layout estático aparece, o motivo vai para o console (`console.error`) e para
  `html[data-webgl-error]`. Nada é gravado na sessão: a próxima visita tenta o 3D de novo.
- Contexto WebGL perdido → o navegador pode devolvê-lo; o palco volta a desenhar sozinho.

## 2. Modo empilhado (movimento reduzido)
`src/scripts/cinema/stacked.ts`. Usado só com `prefers-reduced-motion`: vistas 3D paradas nos
`<canvas data-view>` — hero, tratamentos (abas por camada `LAYERS`: esmalte, dentina e polpa,
raiz) e especialidades (clique troca o destaque). O 3D começa na primeira interação (ou após 5 s).

## 3. Motion UI (conteúdo)
`src/scripts/motion/reveal.ts` — ver tabela na skill `motion-ui` (`.claude/skills/motion-ui/SKILL.md`):
títulos em linhas mascaradas, filetes riscados, fotos em arco reveladas de baixo, equipe em
sequência, convênios em diagonal, citação com foco, contato em sequência, paralaxe sutil.

## 4. Trocar a geometria por GLB
`cena3d: { modeloGlb: '/assets/models/dente.glb' }` na configuração do cliente.
Convenção: Y para cima, altura ≈ 1,07 (topo da coroa y ≈ 0,53, ápice y ≈ −0,54), linha cervical
y ≈ 0,04, frente em +Z, largura da coroa ≈ 0,65. Nós (malhas) reconhecidos:
`shell` (inteiro, grupos coroa/raiz), `enamel`, `core`, `enamel_cut`, `core_cut`, `pulp_cut`
(corte = quadrante x>0, z>0 removido), `enamel_quarter`, `core_quarter`, `pulp_quarter`,
`crown_premolar`, `crown_canine`, `crown_incisor` (largura ≈ 1, base em y = 0).
Nós ausentes usam a geometria procedural; atributo de cor por vértice é opcional.

## 5. Ajustar com segurança
1. Edite os valores em `cinema.ts` (cada bloco é uma cena).
2. `node scripts/qa/scroll-states.mjs http://127.0.0.1:4400/ tests/.artifacts/cena` para ver os quadros.
3. `npx playwright test tests/e2e/scene.spec.ts` (verifica valores e reversão).
