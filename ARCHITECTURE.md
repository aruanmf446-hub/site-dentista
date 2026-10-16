# Arquitetura

## Princípios
1. **Dados separados da apresentação.** Tudo que é da clínica está em `src/clients/<cliente>/clinic.ts`.
   Componentes recebem o objeto validado; não há texto comercial de cliente nos componentes.
2. **Um modelo derivado decide o que existe.** `src/lib/site.ts` calcula seções ativas (ligadas **e**
   com dados), capítulos 00–0N, menu, destinos de WhatsApp e singular/plural de unidades. Menu,
   índice de progresso, sequência 3D, páginas e sitemap leem daqui — por isso nunca discordam.
3. **Aprimoramento progressivo.** HTML estático completo e acessível → CSS decide o layout (cinema ou
   empilhado) antes da pintura → JS adiciona interações → GSAP e Three.js chegam por `import()`
   dinâmico, depois do carregamento.
4. **Sem posições absolutas da página inteira.** A sequência 3D usa segmentos relativos às cenas
   ativas e enquadra o objeto em âncoras do DOM medidas em tempo real.

## Fluxo de dados
```
src/clients/<CLINIC>/clinic.ts
        │  (import.meta.glob, só o cliente ativo)
        ▼
src/config/clinic.config.ts ── Zod (clinic.schema.ts) ── validateClinic (lib/validate.ts)
        │                                   └─ produção: sem placeholders, CRO, WhatsApp,
        ▼                                      consentimentos, revisão de preços…
src/lib/site.ts  (modelo derivado: seções, capítulos, menu, WhatsApp)
        ▼
componentes .astro  ──►  HTML estático  ──►  scripts do navegador (dados mínimos em #site-data)
```

## Modos de experiência (home)
| Modo | Quando | Como |
|---|---|---|
| **cinema** | qualquer largura, WebGL, sem "reduzir movimento" | `.cinema__viewport` fica `sticky`; uma timeline GSAP dirige palco 3D, arco vinho e textos. Abaixo de 900 px, `html.cine-compact`: composição de celular/tablet, rolagem mais curta e 3D mais leve (ver MOTION.md). |
| **empilhado** | movimento reduzido | Painéis viram seções comuns; um renderizador fora da tela desenha vistas 3D paradas em `<canvas data-view>` (hero, tratamentos com abas por camada, especialidades). |
| **estático** | sem WebGL, ou falha do 3D | Painéis empilhados com os SVGs do design (`html.no-webgl`, motivo em `data-webgl-error`). |
| **estático** | sem WebGL ou sem JS | SVGs/CSS dos artboards (`components/cinema/svg/`): dente, corte, camadas, arcada em CSS 3D. |

A classe `is-cinema` é decidida por um script inline no `<head>` (sem CLS). Se o WebGL falhar
depois, a página recarrega no modo estático (`sessionStorage alva:no-webgl`).

## Pastas
| Pasta | Conteúdo |
|---|---|
| `src/config/` | `clinic.schema.ts` (Zod), `clinic.config.ts` (cliente ativo via `CLINIC`) |
| `src/lib/` | `site.ts` (modelo), `theme.ts` (paleta derivada + contraste), `validate.ts`, `seo.ts` (JSON-LD), `whatsapp.ts`, `routes.ts`, `arcade.ts` (geometria/presets da arcada), `placeholders.ts` |
| `src/components/cinema/` | `Cinema.astro` (trilha + palco), painéis Hero/Tratamentos/Especialidades, `svg/` (fallbacks do design) |
| `src/components/sections/` | Sobre, Equipe, Unidades, ConveniosValores, Depoimentos, Galeria, Faq, Agendamento, CtaBand |
| `src/components/navigation/` | Header (completo ↔ pílula + menu), ProgressNav, ContactBars (WhatsApp/barra mobile), Dialogs |
| `src/components/ui/` | Icon, Wordmark, Title (`*destaque*`), Eyebrow, Button, WaLink, ArchPhoto |
| `src/scripts/cinema/` | `boot.ts` (decide modo, adia WebGL), `cinema.ts` (timeline), `stacked.ts`, `shared.ts` |
| `src/scripts/three/` | `stage.ts` (palco), `state.ts`, `materials.ts`, `model-source.ts` (procedural/GLB), `tooth.worker.ts`, `geometry/` |
| `src/scripts/motion/` | `reveal.ts` (revelações por tipo de conteúdo) |
| `src/scripts/ui/` | header/scrollspy, diálogos/WhatsApp, formulários, abas, carrossel, especialidades, barra mobile |
| `src/pages/` | `/`, `/tratamentos/`, `/tratamentos/[slug]/`, `/equipe/[...slug]`, `/unidades/[...slug]`, `/a-clinica/`, `/contato/`, `/privacidade/`, `404`, `sitemap.xml`, `robots.txt`, `favicon.svg` |

## Geometria 3D procedural
`src/scripts/three/geometry/` (roda no Web Worker, sem Three.js):
1. `svg-paths.ts` — perfis P (dente), E (coroa), D (dentina), Q (polpa) copiados do artboard.
2. `field2d.ts` — campo de distância com sinal 2D por perfil (suavizado).
3. `tooth-builder.ts` — "infla" cada perfil em profundidade com espessura variável por altura,
   combina por CSG (`esmalte = P∩coroa−D`, `núcleo = (D∩coroa)∪(P∩raiz)−Q`), remove o quadrante
   frontal-direito para o corte, poligoniza com Surface Nets e calcula normais/cores pelo termo
   CSG ativo. A face de corte reproduz exatamente os perfis do storyboard.
4. Duas resoluções: rápida (aparece primeiro) e refinada (substitui depois).
Saída: casca única (sem costura), camadas inteiras, camadas cortadas, quadrante removido e coroas
da arcada. `model-source.ts` permite substituir por GLB com a mesma convenção de nós.

## Enquadramento responsivo do 3D
Cada quadro usa um retângulo-alvo medido de `[data-anchor]`. `Stage3D.apply()` calcula a distância
da câmera para o objeto caber na altura do retângulo e aplica `camera.setViewOffset` para pôr o alvo
no centro dele (deslocamento de lente). Mudar a composição = mudar CSS.

## Rotas condicionais
`getStaticPaths` retorna vazio quando o módulo está desligado (`/equipe/`, `/unidades/`), e
`lib/routes.ts` alimenta o sitemap e os testes com as mesmas regras.

## Testes
`tests/fixtures/clients/` contém clientes de teste (uma/três unidades, dois/dez tratamentos,
mínimo, completo, cor e foto, produção). `scripts/build-variants.mjs` gera `dist-<variante>/`,
servidos em portas fixas (`scripts/variants.mjs`) pelo `playwright.config.ts`.
