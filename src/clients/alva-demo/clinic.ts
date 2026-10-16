/**
 * CLIENTE DE DEMONSTRAÇÃO — Alva Odontologia (identidade fictícia do Claude Design).
 *
 * Tudo entre [colchetes] é placeholder: dado que a clínica real precisa
 * fornecer. Nada aqui representa profissionais, endereços, convênios,
 * preços ou avaliações reais. Os textos educativos sobre tratamentos são
 * exemplos e precisam ser revisados pelo responsável técnico de cada cliente.
 */
import { defineClinic } from '../../config/clinic.schema';

export default defineClinic({
  site: {
    modo: 'demonstracao',
    url: 'https://alva-odontologia-demo.vercel.app',
    titulo: 'Alva Odontologia — demonstração do template',
    descricao:
      'Clínica odontológica com avaliação completa, plano de tratamento explicado com clareza e acompanhamento do primeiro atendimento à manutenção.',
  },

  marca: {
    nome: 'Alva Odontologia',
    nomeCurto: 'alva',
    descritor: 'Odontologia',
    cores: { primaria: '#5B1626' },
  },

  contato: {
    // Sem número central: com várias unidades, o visitante escolhe a unidade antes do WhatsApp.
    telefone: '[(00) 0000-0000]',
    email: '[contato@clinica.com.br]',
    redes: { instagram: 'https://www.instagram.com/' },
  },

  hero: {
    local: 'Clínica odontológica · [Bairro, Cidade]',
    titulo: 'O cuidado que\nfica no seu *sorriso.*',
    texto:
      'Avaliação completa, plano de tratamento explicado com clareza e uma equipe que acompanha você do primeiro atendimento à manutenção.',
    visual: '3d',
    nota: 'Seg a sex [8h–20h] · Sáb [8h–13h] · [Atendemos convênios e particular]',
  },

  tratamentos: [
    {
      slug: 'avaliacao-e-prevencao',
      nome: 'Avaliação e prevenção',
      resumo: 'Consulta completa para entender sua saúde bucal e planejar os próximos passos.',
      descricao: [
        'A avaliação é o ponto de partida de qualquer tratamento. O dentista examina dentes, gengiva, mordida e tecidos da boca e conversa com você sobre queixas, hábitos e histórico de saúde.',
        'Quando necessário, solicita exames de imagem. Ao final, você recebe um plano explicado em linguagem clara, com prioridades e alternativas.',
      ],
      etapas: [
        { titulo: 'Conversa inicial', texto: 'Histórico de saúde, queixas e expectativas.' },
        { titulo: 'Exame clínico', texto: 'Dentes, gengiva, mordida e tecidos moles.' },
        { titulo: 'Plano de tratamento', texto: 'Prioridades, alternativas e próximos passos.' },
      ],
    },
    {
      slug: 'limpeza',
      nome: 'Limpeza',
      resumo: 'Remoção de placa e tártaro com orientação de higiene para o dia a dia.',
      descricao: [
        'A limpeza profissional (profilaxia) remove a placa bacteriana e o tártaro que a escovação não alcança, sobretudo perto da gengiva e entre os dentes.',
        'Na mesma consulta, a equipe revisa sua técnica de escovação e o uso do fio dental. A frequência das limpezas é definida pelo dentista conforme sua necessidade.',
      ],
      camadas: ['esmalte'],
    },
    {
      slug: 'clareamento',
      nome: 'Clareamento',
      resumo: 'Clareamento dental supervisionado pelo dentista, após avaliação.',
      descricao: [
        'O clareamento usa géis específicos para clarear a cor dos dentes. Antes de começar, o dentista verifica se há cáries, sensibilidade ou restaurações que mudem a indicação.',
        'A técnica (em consultório, caseira supervisionada ou combinada) é escolhida caso a caso. Restaurações e próteses não clareiam e podem precisar de ajuste depois.',
      ],
      camadas: ['esmalte'],
    },
    {
      slug: 'restauracoes',
      nome: 'Restaurações',
      resumo: 'Recuperação da forma e da função de dentes com cárie ou fraturas.',
      descricao: [
        'A restauração remove a parte comprometida do dente e reconstrói a região com materiais da cor do dente, devolvendo forma e função para a mastigação.',
        'Quando o desgaste é maior, o dentista pode indicar restaurações indiretas, produzidas fora da boca e cimentadas em uma segunda consulta.',
      ],
      camadas: ['esmalte', 'dentina-polpa'],
    },
    {
      slug: 'lentes-e-facetas',
      nome: 'Lentes e facetas',
      resumo: 'Lâminas que alteram cor, forma ou alinhamento aparente dos dentes da frente.',
      descricao: [
        'Lentes de contato dental e facetas são lâminas finas, geralmente de cerâmica ou resina, aplicadas na face visível dos dentes para corrigir cor, forma e pequenos espaços.',
        'O planejamento inclui avaliação da mordida e da gengiva e, muitas vezes, um ensaio do resultado antes do tratamento definitivo.',
      ],
      camadas: ['esmalte'],
      especialidade: 'estetica-e-protese',
    },
    {
      slug: 'tratamento-de-canal',
      nome: 'Tratamento de canal',
      resumo: 'Tratamento da polpa para aliviar a dor e preservar o dente natural.',
      descricao: [
        'Quando a polpa — o tecido com nervos e vasos dentro do dente — inflama ou infecciona, o tratamento de canal limpa, desinfeta e veda o interior do dente.',
        'O objetivo é manter o dente natural na boca. Depois do canal, o dente costuma precisar de uma restauração ou coroa para ficar protegido.',
      ],
      camadas: ['dentina-polpa'],
      especialidade: 'endodontia',
    },
    {
      slug: 'implantes',
      nome: 'Implantes',
      resumo: 'Reposição de dentes perdidos com implantes, do planejamento à manutenção.',
      descricao: [
        'O implante é um pino, geralmente de titânio, instalado no osso para substituir a raiz de um dente perdido. Sobre ele é fixada uma coroa ou prótese.',
        'O planejamento avalia a quantidade de osso, a saúde da gengiva e as condições gerais de saúde. Prazos e etapas variam de caso para caso.',
      ],
      camadas: ['raiz'],
      especialidade: 'implantodontia',
      exibirNaHome: false,
    },
    {
      slug: 'proteses',
      nome: 'Próteses',
      resumo: 'Coroas, pontes e próteses para reabilitar dentes desgastados ou ausentes.',
      descricao: [
        'Próteses dentárias repõem dentes ausentes ou reconstroem dentes muito desgastados. Podem ser fixas (coroas e pontes), removíveis ou apoiadas sobre implantes.',
        'A escolha depende da quantidade de dentes envolvidos, da saúde da gengiva e do osso e das preferências de cada paciente.',
      ],
      especialidade: 'estetica-e-protese',
      exibirNaHome: false,
    },
    {
      slug: 'aparelhos-e-alinhadores',
      nome: 'Aparelhos e alinhadores',
      resumo: 'Correção da posição dos dentes e da mordida com aparelhos ou alinhadores.',
      descricao: [
        'A ortodontia corrige a posição dos dentes e a relação entre as arcadas. O tratamento pode usar aparelhos fixos ou alinhadores transparentes removíveis.',
        'Em crianças e adolescentes, o ortodontista também acompanha o crescimento facial para indicar o melhor momento de intervir.',
      ],
      especialidade: 'ortodontia',
      exibirNaHome: false,
    },
    {
      slug: 'tratamento-de-gengiva',
      nome: 'Tratamento de gengiva',
      resumo: 'Prevenção e controle da inflamação e do sangramento gengival.',
      descricao: [
        'Sangramento, inchaço e retração da gengiva podem indicar doença periodontal. O tratamento inclui raspagem para remover o tártaro abaixo da gengiva e acompanhamento.',
        'Manter a gengiva saudável protege o osso que sustenta os dentes e é parte importante do planejamento de outros tratamentos.',
      ],
      camadas: ['raiz'],
      especialidade: 'periodontia',
      exibirNaHome: false,
    },
  ],

  especialidades: [
    {
      slug: 'ortodontia',
      nome: 'Ortodontia',
      descricao: 'Aparelhos fixos, alinhadores transparentes e acompanhamento do crescimento facial.',
      profissionais: ['dentista-ortodontia'],
      destaque: { dentes: 'todos', efeito: 'aparelho' },
    },
    {
      slug: 'implantodontia',
      nome: 'Implantodontia',
      descricao: 'Reposição de dentes perdidos com implantes, do planejamento à manutenção.',
      profissionais: ['dentista-implantodontia'],
      destaque: { dentes: [1, 12], efeito: 'implante' },
    },
    {
      slug: 'endodontia',
      nome: 'Endodontia',
      descricao: 'Tratamento de canal para aliviar a dor e preservar o dente natural.',
      profissionais: ['dentista-endodontia'],
      destaque: { dentes: [3], efeito: 'nenhum' },
    },
    {
      slug: 'periodontia',
      nome: 'Periodontia',
      descricao: 'Saúde da gengiva: prevenção, raspagem e controle de sangramentos.',
      destaque: { dentes: 'todos', efeito: 'gengiva' },
    },
    {
      slug: 'odontopediatria',
      nome: 'Odontopediatria',
      descricao: 'Atendimento acolhedor para bebês, crianças e adolescentes.',
      profissionais: ['dentista-odontopediatria'],
      destaque: { dentes: 'incisivos', efeito: 'nenhum' },
    },
    {
      slug: 'estetica-e-protese',
      nome: 'Estética e prótese',
      descricao: 'Lentes de contato dental, clareamento e reabilitação do sorriso.',
      destaque: { dentes: 'anteriores', efeito: 'nenhum' },
    },
  ],

  sobre: {
    titulo: 'Um espaço pensado para o seu *conforto.*',
    texto: [
      '[Texto curto sobre a história da clínica, o jeito de atender e o que diferencia a experiência do paciente.]',
    ],
    diferenciais: [
      { texto: '[Esterilização com rastreio por paciente]', rotulo: 'Biossegurança' },
      { texto: '[Acesso para cadeirantes]', rotulo: 'Acessibilidade' },
      { texto: '[Estacionamento conveniado]', rotulo: 'Comodidade' },
    ],
    fotos: [
      { src: '[Foto real — recepção]', alt: 'Recepção da clínica', legenda: 'Recepção · Unidade Centro' },
      { src: '[Foto real — consultório]', alt: 'Consultório', legenda: 'Consultório' },
    ],
  },

  equipe: [
    {
      slug: 'dentista-ortodontia',
      nome: 'Dra. [Nome Sobrenome]',
      cro: 'CRO-[UF] 00000',
      especialidade: 'Ortodontia',
      unidades: ['centro'],
      bio: ['[Biografia breve: formação, áreas de atuação e jeito de atender, escrita e aprovada pelo profissional.]'],
      formacao: ['[Graduação — Instituição, ano]', '[Especialização — Instituição, ano]'],
      pagina: true,
    },
    {
      slug: 'dentista-implantodontia',
      nome: 'Dr. [Nome Sobrenome]',
      cro: 'CRO-[UF] 00000',
      especialidade: 'Implantodontia',
      unidades: ['centro', 'jardins'],
      bio: ['[Biografia breve aprovada pelo profissional.]'],
    },
    {
      slug: 'dentista-odontopediatria',
      nome: 'Dra. [Nome Sobrenome]',
      cro: 'CRO-[UF] 00000',
      especialidade: 'Odontopediatria',
      unidades: ['jardins'],
    },
    {
      slug: 'dentista-endodontia',
      nome: 'Dr. [Nome Sobrenome]',
      cro: 'CRO-[UF] 00000',
      especialidade: 'Endodontia',
      unidades: ['unidade-3'],
    },
  ],

  unidades: [
    {
      id: 'centro',
      nome: 'Unidade Centro',
      nomeCurto: 'Centro',
      endereco: { logradouro: '[Rua]', numero: '[número]', bairro: '[Bairro]', cidade: '[Cidade]', uf: '[UF]' },
      horarios: [
        { dias: 'Seg a sex', horas: '[8h–20h]' },
        { dias: 'Sáb', horas: '[8h–13h]' },
      ],
      whatsapp: '[WhatsApp da Unidade Centro]',
      fotos: [{ src: '[Foto real — fachada]', alt: 'Fachada da Unidade Centro' }],
    },
    {
      id: 'jardins',
      nome: 'Unidade Jardins',
      nomeCurto: 'Jardins',
      endereco: { logradouro: '[Rua]', numero: '[número]', bairro: '[Bairro]', cidade: '[Cidade]', uf: '[UF]' },
      horarios: [{ dias: 'Seg a sex', horas: '[8h–19h]' }],
      observacao: '[Estacionamento no local]',
      whatsapp: '[WhatsApp da Unidade Jardins]',
      fotos: [{ src: '[Foto real — fachada]', alt: 'Fachada da Unidade Jardins' }],
    },
    {
      id: 'unidade-3',
      nome: '[Unidade 3]',
      nomeCurto: '[Unidade 3]',
      endereco: { logradouro: '[Rua]', numero: '[número]', bairro: '[Bairro]', cidade: '[Cidade]', uf: '[UF]' },
      horarios: [{ dias: 'Seg a sex', horas: '[9h–18h]' }],
      observacao: '[Observação]',
      whatsapp: '[WhatsApp da Unidade 3]',
      fotos: [{ src: '[Foto real — fachada]', alt: 'Fachada da Unidade 3' }],
    },
  ],

  convenios: {
    titulo: 'Convênios aceitos',
    itens: Array.from({ length: 6 }, (_, i) => ({ nome: `[Logo convênio ${i + 1}]` })),
    observacao: 'Também atendemos particular. [Condições de pagamento.]',
  },

  valores: {
    titulo: 'Valores de referência',
    revisadoPeloResponsavel: false,
    itens: [
      { item: 'Consulta de avaliação', valor: '[R$ 000]' },
      { item: 'Limpeza e profilaxia', valor: '[R$ 000]' },
      { item: 'Clareamento', valor: 'a partir de [R$ 000]' },
      { item: 'Implante unitário', valor: 'sob avaliação' },
    ],
  },

  depoimentos: [1, 2, 3].map((n) => ({
    texto: `[Trecho de uma avaliação real de paciente sobre o atendimento, publicada com autorização — até duas linhas. Exemplo ${n}.]`,
    autor: '[Nome do paciente]',
    fonte: 'Avaliação no Google',
    consentimento: false,
  })),

  galeria: {
    titulo: 'Conheça o *espaço.*',
    fotos: [
      { src: '[Foto real — sala de espera]', alt: 'Sala de espera', legenda: 'Sala de espera' },
      { src: '[Foto real — consultório]', alt: 'Consultório', legenda: 'Consultório' },
      { src: '[Foto real — esterilização]', alt: 'Área de esterilização', legenda: 'Esterilização' },
    ],
  },

  faq: {
    titulo: 'Perguntas *frequentes.*',
    itens: [
      {
        pergunta: 'Como funciona a primeira consulta?',
        resposta: '[Descreva a primeira consulta na clínica: duração, exames e o que o paciente deve levar.]',
      },
      {
        pergunta: 'Vocês atendem convênios?',
        resposta: '[Liste os convênios aceitos e como confirmar a cobertura.]',
      },
      {
        pergunta: 'Atendem urgências?',
        resposta: '[Explique como funciona o atendimento de urgência e os horários.]',
      },
    ],
  },

  agendamento: {
    titulo: 'Vamos cuidar do seu *sorriso?*',
    texto: 'Escolha a unidade e o melhor período. A equipe confirma o horário com você pelo WhatsApp.',
    motivos: ['Primeira avaliação', 'Limpeza', 'Dor ou urgência', 'Implantes', 'Ortodontia', 'Outro assunto'],
    periodos: ['Manhã', 'Tarde', 'Noite'],
  },

  legal: {
    responsavelTecnico: { nome: 'Dr(a). [Nome]', cro: 'CRO-[UF] [00000]' },
    razaoSocial: '[Razão social]',
    cnpj: '[00.000.000/0000-00]',
    encarregado: { email: '[privacidade@clinica.com.br]' },
    politicaAtualizadaEm: '[data]',
  },

  secoes: {
    // Demonstração: todos os módulos visíveis. "valores" vem desligado por padrão
    // no schema; aqui está ligado apenas para exibir o módulo.
    valores: true,
  },
});
