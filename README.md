# Template Alva — sites para clínicas odontológicas

Template comercial reutilizável para clínicas odontológicas brasileiras, construído a partir do
design **Alva Odontologia** (Claude Design). Um único código-base, personalizado por cliente via
configuração tipada: identidade, cores, fotos, tratamentos, especialidades, equipe, unidades,
convênios, preços, depoimentos, WhatsApp e dados legais.

**Destaques**
- Scroll cinematográfico com **3D real** (Three.js): o dente em porcelana sai do arco do hero,
  gira, abre em corte longitudinal (esmalte, dentina, polpa, raiz), apresenta os tratamentos e
  se transforma na arcada das especialidades — tudo dirigido pela rolagem (GSAP ScrollTrigger),
  reversível ao rolar para cima.
- Geometria **gerada a partir das próprias curvas do design** (sem modelo externo), num Web
  Worker; arquitetura pronta para trocar por GLB.
- Mobile próprio (artboards mobile): abas acessíveis por camada do dente, barra fixa de contato,
  menu em diálogo, 3D simplificado e carregado sob demanda.
- Módulos opcionais (equipe, unidades, convênios, valores, depoimentos, galeria, FAQ…) que somem
  do menu, do índice de progresso, da cena 3D e do sitemap quando desligados.
- Uma ou várias unidades, com WhatsApp por unidade e seleção da unidade antes do contato.
- Agendamento sem backend: mensagem organizada para o WhatsApp, sem simular horários.
- Acessibilidade (axe sem violações sérias), `prefers-reduced-motion`, fallback sem WebGL,
  SEO técnico (canonical, OG, sitemap, dados estruturados só com dados reais).
- Proteção contra dados inventados: em modo `producao` o build falha com placeholders.

## Requisitos
- Node.js ≥ 22.22
- npm 10+

## Instalação e execução
```bash
npm install
npm run dev            # http://localhost:4321 (cliente padrão: alva-demo)
npm run build          # gera dist/
npm run preview        # serve dist/
npm run check          # TypeScript estrito + diagnósticos do Astro
```

Escolher o cliente: `CLINIC=<pasta-em-src/clients> npm run dev` (ou `build`).
URL canônica: `SITE_URL=https://www.dominio.com.br npm run build`.

## Testes
```bash
npm test               # build de todas as variantes + suíte Playwright completa
npm run test:build     # só os builds dist-<variante>/
npx playwright test tests/e2e/scene.spec.ts    # um arquivo
node scripts/qa/audit.mjs alva-demo            # Lighthouse + pacotes + peso da cena
```
O Playwright usa o Chromium do sistema quando `CHROME_PATH` está definido (ou o caminho
pré-instalado do ambiente remoto). Detalhes, resultados e evidências: [`QA.md`](QA.md).

## Criar um novo cliente
```bash
node scripts/nova-clinica.mjs sorriso-pleno
CLINIC=sorriso-pleno npm run dev
```
Guia completo: [`CUSTOMIZATION.md`](CUSTOMIZATION.md).

## Publicação (Vercel)
Projeto estático (`output: 'static'`). Configuração em [`vercel.json`](vercel.json).
1. Importe o repositório na Vercel (framework: Astro).
2. Variáveis de ambiente do projeto: `CLINIC=<slug do cliente>` e `SITE_URL=https://dominio`.
3. Um projeto Vercel por cliente (mesmo repositório, `CLINIC` diferente).
Antes de publicar um cliente real, revise [`COMPLIANCE.md`](COMPLIANCE.md).

## Documentação
| Arquivo | Conteúdo |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Estrutura, fluxo de dados, modos de experiência |
| [`CUSTOMIZATION.md`](CUSTOMIZATION.md) | Personalização por clínica, campo a campo |
| [`MOTION.md`](MOTION.md) | Timeline 3D, keyframes, motion UI, troca por GLB |
| [`DESIGN.md`](DESIGN.md) | Identidade visual e regras de preservação |
| [`COMPLIANCE.md`](COMPLIANCE.md) | LGPD, publicidade odontológica, revisão antes de publicar |
| [`QA.md`](QA.md) | Testes executados, evidências e limitações |
| [`SKILLS.md`](SKILLS.md) | Skills do Claude Code em `.claude/skills/` |

## Estrutura
```
src/
  clients/<cliente>/clinic.ts   dados do cliente (+ fotos/)  ← único lugar com dados de clínica
  config/                       schema Zod + carregamento do cliente ativo
  lib/                          modelo derivado (seções ativas, menu, WhatsApp), tema, SEO, validação
  components/                   cinema/ (sequência 3D), sections/, navigation/, layout/, forms/, ui/
  scripts/                      cinema/ (timeline, modos), three/ (palco, geometria, worker), motion/, ui/
  pages/                        home, tratamentos, equipe, unidades, a-clinica, contato, privacidade, 404, sitemap
design/claude-design/           artboards originais (referência dos testes visuais)
tests/                          unit/, e2e/, visual/, fixtures/clients/ (variantes de teste)
scripts/                        build de variantes, servidor estático, nova clínica, QA
.claude/skills/                 6 skills do projeto
```
