---
name: scroll-3d
description: Ajusta e estende a cena Three.js do template (dente procedural, corte longitudinal, arcada) e sua integração com GSAP ScrollTrigger — câmera, geometria, materiais, keyframes, pinning, scrub e desempenho. Use quando a tarefa envolver a sequência cinematográfica Hero → Tratamentos → Especialidades, o modelo 3D (inclusive troca por GLB) ou as vistas 3D do mobile.
---

# scroll-3d — cena 3D e rolagem cinematográfica

## Mapa real do código

| Arquivo | Papel |
|---|---|
| `src/components/cinema/Cinema.astro` | Monta a trilha `.cinema`, o palco fixo (`.stage`) e calcula os **segmentos** (em alturas de tela) só com as cenas ativas: `inicio` (1), `tratamentos` (3), `especialidades` (1 + n×0,55 + 0,35). |
| `src/components/cinema/{Hero,Tratamentos,Especialidades}Panel.astro` | Textos de cada cena + **âncoras de composição** `[data-anchor="hero|trat-a|trat-b|trat-c|arcada"]`, posicionadas por CSS. O 3D é enquadrado nesses retângulos. |
| `src/scripts/cinema/cinema.ts` | **Timeline única** (GSAP + ScrollTrigger `scrub: 0.7`) que anima `state` (3D), `cine` (âncora e arco vinho) e os textos. Keyframes por cena com `T(f)` = fração do storyboard. |
| `src/scripts/cinema/stacked.ts` | Modo empilhado (só movimento reduzido): um renderizador fora da tela desenha cada `<canvas data-view>`; abas por camada (`LAYERS`) e especialidades por clique. O celular usa o cinema compacto (`html.cine-compact`, mesma timeline). |
| `src/scripts/cinema/boot.ts` | Escolhe o modo; adia o WebGL (cinema: após `load`; mobile: 1ª interação ou 5 s). |
| `src/scripts/three/stage.ts` | `Stage3D`: luzes, rig de câmera (distância calculada pelo retângulo + `setViewOffset`), dente em camadas, arcada, `warmup()` (shaders assíncronos), `project()` (legendas). |
| `src/scripts/three/state.ts` | `SceneState`: todos os parâmetros animáveis (orbit, elevation, cut, enamelLift, arch, spec…). |
| `src/scripts/three/geometry/*` | Geometria procedural (Web Worker): perfis SVG do design → campos de distância → inflação → CSG → Surface Nets. |
| `src/scripts/three/model-source.ts` | Fontes do modelo: procedural (padrão) ou GLB (`cena3d.modeloGlb` na configuração), com convenção de nós. |
| `src/scripts/three/materials.ts` | Porcelana física + `uFade` (esmaecer para a cor do fundo) + `uEdge` (volume nas bordas). |

## Procedimentos

### Ajustar um keyframe (ex.: órbita do quadro B)
1. Em `cinema.ts`, bloco `/* ===== 01 · Tratamentos */`, edite a linha
   `S({ orbit: 35, elevation: -5, distance: 0.95 }, T(0.15), D(0.4));`
   — `T(f)` é o início em fração da cena (15% = quadro B), `D(f)` a duração.
2. Mantenha a continuidade: o valor final de uma cena é o inicial da próxima (as tweens usam `.to`, partindo do estado anterior).
3. Valide: `node scripts/qa/scroll-states.mjs http://127.0.0.1:4400/ tests/.artifacts/cena 1440 900 0.2 0.3 0.4` e confira os PNGs + `estados.json`.
   No celular: `node scripts/qa/cinema-frames.mjs http://127.0.0.1:4400/ tests/.artifacts/frames-390 390 844 --mobile` (quadros por tempo da timeline). Medição em várias telas: `node scripts/qa/probe-scroll.mjs <url>` (aceita a URL de produção).

### Mudar a composição (onde o dente aparece)
Edite o CSS das âncoras (ex.: `[data-anchor='trat-c']` em `TratamentosPanel.astro`). Não use coordenadas fixas no JS: o palco mede as âncoras a cada `ScrollTrigger.refresh()`.

### Adicionar uma cena
1. Painel novo em `src/components/cinema/`, registrado em `Cinema.astro` com `add('id', comprimento)`.
2. Bloco de timeline em `cinema.ts` lendo `seg('id')`, só com `.to()` relativos.
3. `activePanel()` e `focusTime()` (acessibilidade por teclado) precisam conhecer a cena.

### Trocar a geometria por GLB
1. Exporte com os nós `shell`, `enamel`, `core`, `enamel_cut`, `core_cut`, `pulp_cut`, `enamel_quarter`, `core_quarter`, `pulp_quarter`, `crown_premolar`, `crown_canine`, `crown_incisor` (Y para cima, altura ≈ 1,07, colo em y ≈ 0,04, frente em +Z). Ausentes caem no procedural.
2. Coloque em `public/assets/models/dente.glb` e configure `cena3d: { modeloGlb: '/assets/models/dente.glb' }` no cliente.
3. A timeline não muda. Valide com o teste da cena.

### Desempenho
- Geometria: `qualityCells()` em `shared.ts` (célula maior = menos triângulos). Desktop forte: 0,0095; mobile: 0,017.
- `dpr(1.75)` no cinema, `dpr(2)` no mobile; o laço só renderiza quando `dirty` ou em movimento ocioso (`state.idle`).
- Nunca crie o contexto WebGL antes do `load`; mantenha `warmup()` antes do 1º quadro.

## Critérios de aceitação
- A câmera e o modelo mudam com a rolagem e **revertem** ao rolar para cima.
- Sem saltos entre cenas (estado final = estado inicial da próxima).
- Desligar `tratamentos` ou `especialidades` não quebra a sequência nem gera erros.
- Movimento reduzido e ausência de WebGL mostram as ilustrações do design.
- 0 erros de console; ≤ ~70 mil triângulos visíveis por quadro.

## Validação (obrigatória)
```bash
node scripts/build-variants.mjs alva-demo teste-minimo teste-dois-tratamentos teste-dez-tratamentos teste-azul-foto
npx playwright test tests/e2e/scene.spec.ts tests/visual
```
Evidências: `tests/.artifacts/scene/*.png` (estados da rolagem) e `tests/.artifacts/visual/*-lado-a-lado.png`.
Use a variável `window.__cinema` (tl, state, cine, stage, segments, st) para inspecionar no navegador.
