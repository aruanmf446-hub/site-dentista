# Revisão antes de publicar (compliance)

> Este documento lista pontos de atenção. **Não é parecer jurídico.** Antes de publicar o site de
> uma clínica real, o responsável técnico (cirurgião-dentista) e a assessoria jurídica da clínica
> devem revisar o conteúdo à luz da legislação e das normas do CFO/CRO vigentes.

## O que o template já faz
- Bloqueia o build em produção se houver placeholders, CRO fora de formato, WhatsApp inválido,
  depoimentos sem consentimento ou preços sem revisão marcada.
- Mostra **responsável técnico + CRO** no rodapé e na página "A clínica".
- Não coleta dados no servidor: o formulário apenas monta uma mensagem para o WhatsApp.
- Exige consentimento explícito (caixa de seleção) antes de preparar a mensagem.
- Não usa cookies de rastreamento nem fontes/serviços de terceiros no carregamento.
- Não gera avaliações estruturadas (estrelas/nota) nos dados para buscadores.
- Marca o site de demonstração como não indexável (`noindex` + `robots.txt`).
- Textos de tratamento são informativos, com aviso de que a indicação depende de avaliação clínica.
- Destaques da arcada e das camadas do dente são **ilustrativos** (aviso na seção).

## Checklist do responsável técnico
### Publicidade odontológica
- [ ] Nome do responsável técnico e número do CRO corretos e visíveis.
- [ ] CRO de cada profissional da equipe conferido.
- [ ] Especialidades anunciadas correspondem a títulos registrados no CRO.
- [ ] Textos sem promessa de resultado, sem superlativos ("o melhor", "garantido", "sem dor") e
      sem comparação com outros profissionais.
- [ ] **Preços e promoções**: o Código de Ética Odontológica restringe a divulgação de preços,
      serviços gratuitos e modalidades de pagamento. O módulo "Valores" vem **desligado** e só passa
      no build com `revisadoPeloResponsavel: true`. Confirme o texto vigente antes de ligar.
- [ ] Associação de tratamentos às camadas do dente (`camadas`) revisada.

### Imagens
- [ ] Fotos da clínica e da equipe são reais e autorizadas (direito de imagem dos profissionais).
- [ ] **Imagens clínicas e "antes e depois"**: o template não tem um módulo próprio para isso. Se a
      clínica quiser publicar, verifique as condições da regulamentação do CFO vigente
      (consentimento do paciente, finalidade, identificação do responsável) antes de incluir em
      galeria ou página.
- [ ] Nenhuma foto de paciente identificável sem termo de autorização.

### Depoimentos
- [ ] Cada depoimento tem autorização registrada (`consentimento: true`) e fonte verificável.
- [ ] Identificação do paciente somente na forma autorizada (ex.: "Maria S.").
- [ ] Sem depoimentos sobre resultados clínicos específicos que possam configurar promessa.

### LGPD (Lei 13.709/2018)
- [ ] `legal.encarregado` (DPO) preenchido com canal de contato.
- [ ] Política de Privacidade (`/privacidade/`) revisada pela assessoria jurídica e datada.
- [ ] Se forem adicionadas ferramentas de medição/marketing, atualizar a política e implementar
      consentimento de cookies antes de ativá-las.
- [ ] A equipe que atende o WhatsApp conhece a política de retenção de conversas.

### Dados da clínica
- [ ] Razão social, CNPJ, endereços, horários e telefones conferidos.
- [ ] Convênios listados são os efetivamente aceitos (logos com autorização de uso de marca).
- [ ] Links de rota ("Como chegar") abrem o endereço correto.

## Registro da revisão
| Data | Cliente | Revisado por (nome, CRO) | Observações |
|---|---|---|---|
| | | | |
