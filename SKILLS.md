# Skills do Claude Code

Seis skills do projeto ficam em `.claude/skills/<nome>/SKILL.md`. São carregadas automaticamente
pelo Claude Code neste repositório e podem ser chamadas pelo nome (ex.: `/nova-clinica`).
Cada uma traz o mapa real dos arquivos, procedimentos, critérios de aceitação e comandos de validação.

| Skill | Responsável por | Validação principal |
|---|---|---|
| [`scroll-3d`](.claude/skills/scroll-3d/SKILL.md) | Cena Three.js + GSAP ScrollTrigger: câmera, geometria, materiais, keyframes, pinning, scrub, GLB, desempenho do 3D | `npx playwright test tests/e2e/scene.spec.ts tests/visual` |
| [`motion-ui`](.claude/skills/motion-ui/SKILL.md) | Animações de conteúdo por tipo (títulos, filetes, arcos, equipe, convênios, citações) com acessibilidade | testes de movimento reduzido + axe |
| [`responsive-refinement`](.claude/skills/responsive-refinement/SKILL.md) | Layout, tipografia fluida, espaçamento, overflow e mobile em 320–1440 px | `tests/e2e/mobile.spec.ts` + métricas visuais |
| [`nova-clinica`](.claude/skills/nova-clinica/SKILL.md) | Onboarding de cliente: configuração, fotos, textos, unidades, legal — sem tocar no motor | build do cliente + `tests/unit` |
| [`visual-qa`](.claude/skills/visual-qa/SKILL.md) | Navegador, capturas, interações, comparação com os artboards, seções opcionais, continuidade do scroll | `tests/visual` + `scripts/qa/*` |
| [`audit-performance`](.claude/skills/audit-performance/SKILL.md) | Acessibilidade, LCP/INP/CLS, console, SEO técnico, peso da cena | `node scripts/qa/audit.mjs` |

## Exemplos de uso neste repositório
- "Use a skill **nova-clinica** para criar o site da Clínica Sorriso Pleno com duas unidades" →
  `node scripts/nova-clinica.mjs sorriso-pleno`, preencher `clinic.ts`, `CLINIC=sorriso-pleno npm run build`.
- "Com **scroll-3d**, faça a câmera orbitar 45° no quadro B" → editar o bloco Tratamentos em
  `src/scripts/cinema/cinema.ts`, rodar `scripts/qa/scroll-states.mjs` e `scene.spec.ts`.
- "Com **visual-qa**, compare o hero com o artboard" → `npx playwright test tests/visual -g Main`
  e abrir `tests/.artifacts/visual/01-main-lado-a-lado.png`.
- "Com **audit-performance**, audite o cliente antes de publicar" →
  `node scripts/build-variants.mjs <cliente>` (ou `CLINIC=… OUT_DIR=…`) e `node scripts/qa/audit.mjs`.
- "Com **responsive-refinement**, corrija o overflow em 320 px na página de unidades" →
  teste de largura aponta o seletor culpado.
- "Com **motion-ui**, anime a nova seção de galeria" → `data-reveal="arch"`/`title` e validação
  com movimento reduzido.

## Ferramentas compartilhadas
`scripts/build-variants.mjs`, `scripts/serve-static.mjs`, `scripts/variants.mjs`,
`scripts/qa/shot.mjs`, `scripts/qa/scroll-states.mjs`, `scripts/qa/element-shots.mjs`,
`scripts/qa/audit.mjs`, `scripts/nova-clinica.mjs`, `tests/visual/dc-render.ts`.
