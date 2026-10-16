---
name: motion-ui
description: Cria e ajusta as animações de conteúdo do template (títulos, textos, fotos em arco, listas com filetes, equipe, convênios, depoimentos, contato) preservando a identidade do Claude Design e a acessibilidade. Use para qualquer revelação, transição ou microinteração fora da cena 3D.
---

# motion-ui — animações de conteúdo

## Onde está
- `src/scripts/motion/reveal.ts` — revelações por **tipo de conteúdo**, acionadas por `data-reveal` (e `[data-eyebrow]`, `data-parallax`).
- `src/styles/base.css` — estado inicial oculto só enquanto o módulo não iniciou (`html.motion:not(.motion-ready)`), com fallback de 4 s no `<head>`.
- Microinterações em CSS dos componentes: setas que deslizam (`.icon-shift`), sublinhado do menu, entrada de abas/cartões (`is-entering`), menu em diálogo.
- Textos da sequência 3D **não** passam por aqui: são da timeline (`skill scroll-3d`).

## Vocabulário (use o tipo certo, não um fade genérico)
| Atributo | Gesto | Uso |
|---|---|---|
| `[data-eyebrow]` | filete desenha da esquerda, rótulo entra | rótulos "— 03 · A clínica" (automático no componente `Eyebrow`) |
| `data-reveal="title"` | linhas sobem de uma máscara (SplitText) | h2 de seção |
| `data-reveal="text"` | sobe 16 px + fade | parágrafos curtos |
| `data-reveal="rows"` | cada linha é riscada da esquerda (clip) | listas com filetes, tabelas de valores, FAQ |
| `data-reveal="arch"` | foto em arco revela de baixo, imagem assenta | `ArchPhoto` (padrão) |
| `data-reveal="outline"` | contorno do arco surge ao redor | contornos decorativos |
| `data-reveal="team"` | textos dos cartões em sequência | grade da equipe |
| `data-reveal="grid"` | células em diagonal | convênios |
| `data-reveal="quote"` | citação nítida a partir de desfoque leve | depoimentos |
| `data-reveal="info"` | sequência curta | dados de contato |
| `data-parallax="0.06"` | deslocamento sutil com scrub | fotos sobrepostas |

## Regras
1. Nunca anime campos de formulário nem textos longos linha a linha.
2. Não use `opacity: 0` em CSS fora do seletor de pré-inicialização (conteúdo precisa aparecer sem JS).
3. Não anime o `h1` do hero (é o LCP) nem elementos acima da dobra nas páginas internas.
4. `prefers-reduced-motion`: o módulo não carrega; `base.css` zera transições e animações.
5. Durações: 0,6–1,4 s, `power2/3/4.out` para entradas; gatilho `top 86%`, `once: true`.
6. Paleta e formas do design: nada de brilhos, neon, glass, sombras exageradas.

## Procedimento para uma seção nova
1. Marque elementos com o `data-reveal` correspondente (tabela acima).
2. Se precisar de um gesto novo, adicione um bloco em `reveal.ts` com nome semântico e documente aqui e em `MOTION.md`.
3. Teste com e sem movimento reduzido.

## Critérios de aceitação
- Cada tipo de conteúdo tem o seu gesto; nada "pisca" no carregamento.
- Com movimento reduzido, todo `[data-reveal]` está visível (opacidade 1).
- Sem erros de console; axe sem violações sérias.

## Validação
```bash
node scripts/build-variants.mjs alva-demo
npx playwright test tests/e2e/fallback-a11y.spec.ts -g "movimento reduzido|axe"
node scripts/qa/element-shots.mjs http://127.0.0.1:4400/ tests/.artifacts/el 1440 900 "#sobre:sobre" "#equipe:equipe"
```
(Suba o servidor antes: `node scripts/serve-static.mjs dist-alva-demo 4400`.)
