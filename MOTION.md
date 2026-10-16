# Motion — timeline 3D e animações

## 1. Sequência cinematográfica (modo cinema)
Uma **única timeline** GSAP, controlada por um ScrollTrigger (`scrub: 0.7`) sobre `.cinema`.
A unidade de tempo é **uma altura de tela (vh)**. As cenas ativas formam segmentos:

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
| 0,15–0,55 (B) | órbita 0° → 35°, desce até −5°, distância 0,95; corte abre (0,17–0,41); esmalte sobe 0 → 0,105 (≈ 55 px); polpa brilha | título A sai; texto B entra (0,25); legendas uma a uma (0,32–0,52), presas ao modelo por projeção |
| 0,55–1 (C) | enquadramento vai ao terço esquerdo; esmalte → 0,25 (≈ 130 px) e −8°; órbita 26°, elevação 3°; giro lento (ocioso) | legendas e texto B saem (0,60); lista entra da direita em sequência (0,68–0,86); CTA (0,88) |

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
- `prefers-reduced-motion` → modo empilhado estático (quadro C parado).

## 2. Modo empilhado (mobile)
`src/scripts/cinema/stacked.ts`. Vistas 3D nos `<canvas data-view>`:
- **hero**: giro ocioso + rotação ligada à rolagem do hero.
- **tratamentos**: abas por camada (`LAYERS`): esmalte (esmalte erguido, núcleo esmaecido),
  dentina e polpa (corte, polpa brilhando), raiz (corte visto de baixo). Transição de 0,9 s.
- **especialidades**: arcada; clique interpola o destaque (0,7 s).
O 3D começa na primeira interação (ou após 5 s); até lá os SVGs do design ocupam o lugar.

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
