---
name: nova-clinica
description: Personaliza o template para um novo cliente (clínica odontológica) — configuração, identidade, fotos, textos, tratamentos, especialidades, equipe, unidades, convênios, preços, depoimentos, links e dados legais — sem mexer no motor 3D nem na arquitetura. Use quando o pedido for "criar/ajustar o site da clínica X".
---

# nova-clinica — onboarding de cliente

## Regra de ouro
Dados do cliente vivem **apenas** em `src/clients/<slug>/` (arquivo `clinic.ts` + `fotos/`). Não edite componentes, `src/scripts/` ou `src/lib/` para personalizar um cliente. Se algo não for configurável, proponha um campo novo no schema (`src/config/clinic.schema.ts`) em vez de "hardcode".

## Passo a passo
1. Criar a pasta: `node scripts/nova-clinica.mjs <slug>` (copia `src/clients/_modelo/`).
2. Preencher `src/clients/<slug>/clinic.ts` (o schema dá autocompletar via `defineClinic`):
   - `marca`: nome, `nomeCurto` (marca tipográfica), `cores.primaria` (o build avisa se o contraste com texto claro < 4,5:1), logo opcional.
   - `contato`: WhatsApp central (só dígitos com 55) **ou** WhatsApp por unidade; telefone, e-mail, redes.
   - `unidades`: 1 ou mais. Com 1, o site fica no singular e sem seletores; com várias, gera `/unidades/<id>/` e pede a unidade antes do WhatsApp quando não há número central. `mapa` habilita "Como chegar"; `horarios[].estruturado` alimenta os dados estruturados.
   - `tratamentos`: 1+ itens, cada um com **conteúdo próprio** (`descricao`), opcional `etapas`, `indicacoes`, `faq`, `foto`, `camadas` (abas do mobile — validar com o RT), `exibirNaHome`.
   - `especialidades`: `destaque.dentes` (preset ou índices 0–13) e `efeito` (`aparelho`, `gengiva`, `implante`) — ilustrativo.
   - `equipe`: nome, CRO, especialidade, unidades, foto, `bio` (+ `pagina: true` para perfil próprio).
   - `convenios`, `valores` (desligado por padrão; exige `revisadoPeloResponsavel: true` em produção), `depoimentos` (exigem `consentimento: true`), `galeria`, `faq`.
   - `secoes` liga/desliga módulos; `ordem` define a ordem das seções de conteúdo.
   - `legal`: responsável técnico + CRO, razão social, CNPJ, encarregado LGPD.
3. Fotos reais em `src/clients/<slug>/fotos/` e importadas no `clinic.ts` (otimização automática AVIF/WebP). Sempre com `alt` descritivo. Use `posicao` para enquadrar.
4. Visualizar: `CLINIC=<slug> npm run dev`.
5. Publicar: `site.modo: 'producao'` → `CLINIC=<slug> npm run build`. O build **falha** se houver `[placeholder]`, WhatsApp inválido, CRO fora do formato, depoimento sem consentimento ou preços sem revisão.
6. Vercel: um projeto por cliente, variável `CLINIC=<slug>` (e `SITE_URL` com o domínio).

## Nunca
- Inventar profissionais, CRO, endereços, convênios, preços, números de pacientes, avaliações ou resultados.
- Publicar fotos de pacientes ou "antes e depois" sem autorização e revisão (ver `COMPLIANCE.md`).
- Alterar `src/scripts/three/` ou `src/scripts/cinema/` para um cliente específico.

## Critérios de aceitação
- `CLINIC=<slug> npm run build` sem erros e sem placeholders em produção.
- Menu, índice de progresso e sitemap mostram só seções com dados.
- WhatsApp abre o número certo por unidade (teste manual ou e2e).

## Validação
```bash
CLINIC=<slug> OUT_DIR=dist-<slug> npx astro build
node scripts/serve-static.mjs dist-<slug> 4499 &
node scripts/qa/shot.mjs http://127.0.0.1:4499/ inicio.png 1440 900
npx playwright test tests/unit
```
Exemplo real: as variantes em `tests/fixtures/clients/` (uma unidade, três unidades, dois tratamentos, produção) mostram configurações válidas.
