# Personalização por clínica

Cada cliente é uma pasta em `src/clients/<slug>/` com um `clinic.ts` e as fotos. O template-base
(componentes, scripts, cena 3D) **não** deve ser alterado para um cliente específico.

## 1. Criar
```bash
node scripts/nova-clinica.mjs sorriso-pleno     # copia src/clients/_modelo/
CLINIC=sorriso-pleno npm run dev
```
O arquivo usa `defineClinic({...})`, com autocompletar e validação pelo schema
`src/config/clinic.schema.ts`. Erros aparecem no terminal com o caminho do campo.

## 2. Modo e placeholders
- `site.modo: 'demonstracao'` aceita textos entre `[colchetes]` (placeholders), marca o site como
  `noindex` e faz os botões de WhatsApp com número placeholder abrirem um aviso de demonstração.
- `site.modo: 'producao'` exige dados completos: o build falha com placeholders, WhatsApp fora do
  padrão `55DDDNÚMERO`, CRO fora do formato `CRO-UF 12345`, depoimento sem consentimento ou preços
  sem `revisadoPeloResponsavel: true`. Use `site.noindex: true` para homologação.

## 3. Campos

### Identidade
| Campo | Observação |
|---|---|
| `marca.nome` | Nome completo (títulos, SEO, rodapé). |
| `marca.nomeCurto`, `marca.descritor` | Marca tipográfica do design ("alva" + "Odontologia"). |
| `marca.logo` | `{ src, alt, altura }` — substitui a marca tipográfica (SVG/PNG importado). |
| `marca.cores.primaria` | Cor principal (#RRGGBB). Variações (escura, tons claros, gengiva) são derivadas. O build avisa se o contraste com texto claro < 4,5:1. Opções do design: `#5B1626`, `#7A2438`, `#2F3B52`, `#3F5A4C`. |
| `marca.cores.secundaria` | Opcional: cor das superfícies alternativas (fundo dos depoimentos). |
| `hero.titulo` | `*trecho*` vira itálico na cor primária; `\n` quebra a linha no desktop. |
| `hero.visual` | `'3d'` (dente) ou `'foto'` (com `hero.foto`). |
| `hero.agendamentoRapido`, `hero.nota` | Formulário rápido e linha de horários do hero. |
| `cena3d.modeloGlb` | Caminho de um GLB opcional (convenção em `MOTION.md`). |

### Contato e unidades
| Campo | Observação |
|---|---|
| `contato.whatsapp` | Número central (só dígitos com 55). Sem ele, cada unidade precisa do seu. |
| `contato.telefone`, `email`, `redes` | Telefone habilita o botão "Ligar" no mobile. |
| `contato.mensagemPadrao` | Texto inicial dos botões de WhatsApp. |
| `unidades[]` | `id`, `nome`, `nomeCurto`, `endereco{logradouro, numero, bairro, cidade, uf, cep}`, `horarios[]` (texto + `estruturado` opcional para SEO), `whatsapp`, `telefone`, `mapa` (link "Como chegar"), `fotos[]`, `geo`. |

**Uma unidade:** sem seletores, textos no singular ("Onde estamos"), WhatsApp direto.
**Várias:** lista de unidades, páginas `/unidades/<id>/`, seletor no formulário e, sem número
central, um diálogo para escolher a unidade antes do WhatsApp.

### Serviços
| Campo | Observação |
|---|---|
| `tratamentos[]` | 1 ou mais. `slug`, `nome`, `resumo`, `descricao[]` (**conteúdo próprio**), `etapas[]`, `indicacoes[]`, `duracao`, `foto`, `faq[]`, `seo{titulo, descricao}`, `especialidade`, `exibirNaHome`. A ordem do array é a ordem de exibição. Cada um gera `/tratamentos/<slug>/`. |
| `tratamentos[].camadas` | Associação opcional às abas do mobile (`esmalte`, `dentina-polpa`, `raiz`). **Valide com o responsável técnico.** |
| `tratamentosSecao` | Títulos dos quadros A, B, C e do mobile. |
| `especialidades[]` | `nome`, `descricao`, `foto`, `profissionais[]` (slugs da equipe), `destaque{dentes, efeito}`. `dentes`: `todos`, `anteriores`, `posteriores`, `molares`, `pre-molares`, `caninos`, `incisivos`, `nenhum` ou índices 0–13. `efeito`: `aparelho`, `gengiva`, `implante`, `nenhum`. O destaque é **ilustrativo**. |

A lista da home se adapta: 1–2 itens em destaque, 3–5 em uma coluna, 6+ em duas, até 12 (o resto
fica em "Ver todos os N tratamentos").

### Pessoas
`equipe[]`: `slug`, `nome`, `cro`, `especialidade`, `unidades[]`, `foto`, `bio[]`, `formacao[]`,
`pagina` (perfil em `/equipe/<slug>/`). Sem `pagina`, a bio aparece em "Sobre" expansível.

### Módulos comerciais
| Campo | Observação |
|---|---|
| `convenios` | `itens[{nome, logo, observacao}]`, `observacao` (ex.: "Também atendemos particular."). |
| `valores` | **Desligado por padrão.** `itens[{item, valor}]`, `observacao`, `revisadoPeloResponsavel`. |
| `depoimentos[]` | `texto`, `autor` (identificação autorizada), `fonte`, `link`, `data`, `consentimento`. Nunca geram estrelas/nota. |
| `galeria`, `faq` | Fotos com legenda; perguntas e respostas. |
| `sobre` | Título, texto, diferenciais (`texto` + `rotulo`), até 2 fotos. |

### Seções e ordem
```ts
secoes: { especialidades: true, equipe: true, unidades: true, convenios: true, valores: false,
          depoimentos: true, galeria: false, faq: true, sobre: true, tratamentos: true },
ordem: ['sobre', 'equipe', 'unidades', 'galeria', 'convenios', 'valores', 'depoimentos', 'faq'],
```
Uma seção aparece se estiver ligada **e** tiver dados. Desligada, some da página, do menu, do
índice de progresso, da sequência 3D, das rotas e do sitemap. Convênios e valores vizinhos dividem
a mesma faixa (como no design).

### Legal
`legal.responsavelTecnico{nome, cro}`, `razaoSocial`, `cnpj`, `encarregado{nome, email}`,
`politicaAtualizadaEm`. Aparecem no rodapé, em "A clínica" e na Política de Privacidade.

## 4. Fotos
Coloque em `src/clients/<slug>/fotos/` e importe:
```ts
import recepcao from './fotos/recepcao.jpg';
sobre: { fotos: [{ src: recepcao, alt: 'Recepção com poltronas e luz natural', posicao: '50% 35%' }] }
```
O Astro gera AVIF/WebP em várias larguras. Use fotos reais (mín. 1600 px no lado maior),
`alt` descritivo e `posicao` para enquadrar no arco. Fotos de pacientes: ver `COMPLIANCE.md`.

## 5. Publicar
1. `site.modo: 'producao'`, `site.url` com o domínio real.
2. `CLINIC=<slug> npm run build` — corrija o que o validador apontar.
3. Vercel: projeto com `CLINIC=<slug>` e `SITE_URL=https://dominio`.
4. Revise `COMPLIANCE.md` com o responsável técnico.

## 6. Exemplos reais no repositório
- `src/clients/alva-demo/` — demonstração completa (placeholders identificados).
- `tests/fixtures/clients/teste-unidade-unica/` — uma unidade, WhatsApp central, telefone.
- `tests/fixtures/clients/teste-tres-unidades/` — WhatsApp por unidade, "Como chegar".
- `tests/fixtures/clients/teste-dois-tratamentos/` — só dois tratamentos e uma especialidade.
- `tests/fixtures/clients/teste-minimo/` — todos os módulos opcionais desligados.
- `tests/fixtures/clients/teste-azul-foto/` — outra cor primária e foto no hero.
- `tests/fixtures/clients/teste-producao/` — modo produção válido (dados fictícios de teste).
