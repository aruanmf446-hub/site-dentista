# Identidade visual e regras de preservação

Fonte: Claude Design "Alva Odontologia — Template" (artboards em `design/claude-design/`).
Mudanças na identidade só com decisão explícita do responsável pelo design.

## Tipografia
| Uso | Fonte | Tamanhos (390 → 1440 px) |
|---|---|---|
| Títulos | **Instrument Serif** 400 (itálico para o destaque) | hero 50 → 94 · seção 36 → 58 · agendar 40 → 78 · blocos 32 → 44 |
| Texto | **Hanken Grotesk** (variável 400–600) | corpo 15 → 17 · apoio 15 → 18 · rótulos 11–12 em versalete, espaçamento 0,22 em |
Fontes servidas pelo próprio site (Fontsource), pré-carregadas, `font-display: swap`.
O destaque em itálico na cor primária é a assinatura: use `*palavra*` nos títulos da configuração.

## Cores
| Token | Valor | Uso |
|---|---|---|
| `--c-bg` | `#FCFAF8` | fundo |
| `--c-ink` | `#1F1719` | texto principal |
| `--c-text` / `--c-muted` | `#5E5154` / `#6E6063` | apoio / rótulos |
| `--c-faint` | `#776A6D` | substitui `#9A8C8F` do design em textos pequenos (contraste ≥ 4,5:1) |
| `--c-line`, `--c-line-strong`, `--c-arch-line` | `#E6DCD9`, `#D8CBC8`, `#E2D4D1` | filetes e contornos |
| `--c-primary` | `#5B1626` (por cliente) | vinho: botões, arco, destaques |
| `--c-primary-dark` | primária × 0,55 | sombras de contato (como no design) |
| `--c-on-primary*` | `#FBF4F2`, `#F7EDEA` + tons derivados com contraste garantido | textos sobre vinho |
| `--c-surface-alt` | derivado (ou `secundaria`) | fundo dos depoimentos |
Paleta do cliente: `src/lib/theme.ts` deriva tudo da cor primária e verifica contraste.

## Elementos recorrentes
- **Arco**: topo em semicírculo (`border-radius: 9999px 9999px 0 0`), muitas vezes com um contorno
  fino deslocado 14–18 px. Usado no hero, fotos, retratos, fachadas, formulário e transições da cena.
- **Rótulo de seção**: filete de 32 px na cor primária + texto em versalete ("— 03 · A clínica").
  Numeração automática pelos capítulos ativos.
- **Listas com filetes finos** (1 px `--c-line`), sem cards.
- **Botões em pílula** (`btn--primary`, `btn--outline`, `btn--light`, `btn--dark`, `btn--float`).
- **Header**: completo no hero (marca + descritor, menu, WhatsApp, "Agendar consulta") e pílula
  branca flutuante nas demais seções.
- **Índice de progresso** 00–0N à direita e **WhatsApp flutuante** (desktop); **barra fixa** (mobile).
- **Placeholders** do design: hachurado diagonal + rótulo em pílula ("[Foto real — recepção]").

## Composição (desktop 1440 × 900)
Margem esquerda 96 px; seções de conteúdo com margem direita 128 px. Hero: texto a 96/196 px,
arco 500 × 744 a partir de x = 830 encostado na base, formulário rápido 660 × 76 em y ≈ 724.
Especialidades: lista 420 px à esquerda, arcada 800 × 640 à direita com o detalhe no centro do arco.
Esses números são verificados automaticamente em `tests/visual/visual.spec.ts`.

## Não fazer
Dashboards, KPIs decorativos, cards repetidos, glassmorphism, neon/hologramas, gradientes chamativos,
emojis, ícones em excesso, fontes Inter/Roboto/Arial, 3D com cara de propaganda de produto,
animações sem propósito.

## Desvios intencionais do design (e por quê)
| Design | Template | Motivo |
|---|---|---|
| Campo "WhatsApp" no formulário | removido | minimização de dados (LGPD): a mensagem já sai do WhatsApp do paciente |
| "Ver horários" no hero | "Solicitar horário" | não há agenda integrada; não simular disponibilidade |
| `#9A8C8F` nos números do índice | `#776A6D` | contraste mínimo para texto de 11 px |
| Legendas anatômicas em posições fixas | presas ao modelo 3D por projeção | o dente é 3D real e se move |
| Dente do quadro B em SVG | dente 3D com corte real e órbita de câmera | requisito de 3D real |
| Abas do mobile sem painéis | `role="tab"` + `tabpanel` com texto anatômico | acessibilidade |
