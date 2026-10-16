/**
 * Schema da configuração de uma clínica.
 *
 * Todo dado de cliente vive em `src/clients/<cliente>/clinic.ts` e é validado
 * por este schema na hora do build. Componentes e lógica visual nunca guardam
 * dados de clínica: eles recebem o objeto validado (`ClinicConfig`).
 *
 * Convenções:
 * - Textos entre colchetes, como "[Bairro, Cidade]", são PLACEHOLDERS.
 *   Eles são aceitos apenas em `site.modo: 'demonstracao'`. No modo
 *   'producao' o build falha se sobrar algum (ver lib/validate.ts).
 * - Títulos aceitam *destaque* entre asteriscos: vira itálico na cor primária,
 *   como no design ("O cuidado que fica no seu *sorriso.*").
 */
import { z } from 'zod';
import type { ImageMetadata } from 'astro';

const hex = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, 'Use cor hexadecimal de 6 dígitos, ex.: #5B1626');

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use apenas letras minúsculas, números e hífens (ex.: limpeza-dental)');

/** Imagem importada (otimizada pelo Astro) ou caminho em /public / URL absoluta. */
export const imagemSchema = z.union([
  z.custom<ImageMetadata>(
    (v) => typeof v === 'object' && v !== null && 'src' in v && 'width' in v && 'height' in v,
    'Imagem inválida: importe o arquivo (import foto from "./fotos/x.jpg")',
  ),
  z.string().min(1),
]);

export const fotoSchema = z.object({
  src: imagemSchema,
  alt: z.string().min(1, 'Toda foto precisa de texto alternativo (alt)'),
  /** object-position CSS para enquadramento, ex.: "50% 30%" */
  posicao: z.string().optional(),
  legenda: z.string().optional(),
});

const enderecoSchema = z.object({
  logradouro: z.string(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string(),
  cidade: z.string(),
  uf: z.string(),
  cep: z.string().optional(),
});

const diaSemana = z.enum(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);

const horarioSchema = z.object({
  /** Texto exibido, ex.: "Seg a sex" */
  dias: z.string(),
  /** Texto exibido, ex.: "8h–20h" */
  horas: z.string(),
  /** Opcional e estruturado: alimenta os dados estruturados (schema.org). */
  estruturado: z
    .object({
      dias: z.array(diaSemana).min(1),
      abre: z.string().regex(/^\d{2}:\d{2}$/),
      fecha: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .optional(),
});

export const unidadeSchema = z.object({
  id: slug,
  /** Nome completo, ex.: "Unidade Centro" */
  nome: z.string(),
  /** Nome curto para seletores, ex.: "Centro" */
  nomeCurto: z.string().optional(),
  endereco: enderecoSchema,
  horarios: z.array(horarioSchema).default([]),
  observacao: z.string().optional(),
  /** WhatsApp próprio (DDI+DDD+número, só dígitos: 5511999999999). Sem ele, usa contato.whatsapp. */
  whatsapp: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().optional(),
  /** Link de rota (Google Maps, Waze…). Sem ele, o botão "Como chegar" não aparece. */
  mapa: z.url().optional(),
  fotos: z.array(fotoSchema).default([]),
  /** Coordenadas opcionais para dados estruturados. */
  geo: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

const camadaDente = z.enum(['esmalte', 'dentina-polpa', 'raiz']);

export const tratamentoSchema = z.object({
  slug,
  nome: z.string(),
  /** Uma frase. Aparece em listas e na meta description se seo.descricao faltar. */
  resumo: z.string(),
  /** Conteúdo próprio da página do tratamento (parágrafos). Não é gerado automaticamente. */
  descricao: z.array(z.string()).min(1, 'Cada tratamento precisa de conteúdo próprio'),
  etapas: z.array(z.object({ titulo: z.string(), texto: z.string() })).default([]),
  indicacoes: z.array(z.string()).default([]),
  /** Informação de duração aproximada, apenas se fornecida pela clínica. */
  duracao: z.string().optional(),
  foto: fotoSchema.optional(),
  /**
   * Associação OPCIONAL a camadas do dente, usada nas abas do mobile.
   * Deve ser validada pelo responsável técnico. Sem associação, o
   * tratamento aparece só na lista geral.
   */
  camadas: z.array(camadaDente).default([]),
  especialidade: slug.optional(),
  exibirNaHome: z.boolean().default(true),
  faq: z.array(z.object({ pergunta: z.string(), resposta: z.string() })).default([]),
  seo: z.object({ titulo: z.string().optional(), descricao: z.string().optional() }).default({}),
});

/** Presets de destaque da arcada (14 dentes, índice 0 = molar direito do paciente na vista do design). */
export const presetDentes = z.enum([
  'todos',
  'anteriores',
  'posteriores',
  'molares',
  'pre-molares',
  'caninos',
  'incisivos',
  'nenhum',
]);

export const especialidadeSchema = z.object({
  slug,
  nome: z.string(),
  descricao: z.string(),
  foto: fotoSchema.optional(),
  /** slugs de profissionais da equipe relacionados */
  profissionais: z.array(slug).default([]),
  /**
   * Destaque ILUSTRATIVO na arcada 3D. Não representa diagnóstico.
   * dentes: preset ou índices 0–13.
   */
  destaque: z
    .object({
      dentes: z.union([presetDentes, z.array(z.number().int().min(0).max(13))]).default('todos'),
      efeito: z.enum(['nenhum', 'aparelho', 'gengiva', 'implante']).default('nenhum'),
    })
    .default({ dentes: 'todos', efeito: 'nenhum' }),
});

export const profissionalSchema = z.object({
  slug,
  nome: z.string(),
  foto: fotoSchema.optional(),
  /** Ex.: "CRO-SP 12345". Verificado pelo cliente; nunca invente. */
  cro: z.string(),
  /** Especialidade(s) exibida(s), ex.: "Ortodontia" */
  especialidade: z.string(),
  /** ids das unidades onde atende */
  unidades: z.array(slug).default([]),
  bio: z.array(z.string()).default([]),
  formacao: z.array(z.string()).default([]),
  /** Gera página própria em /equipe/<slug>/ */
  pagina: z.boolean().default(false),
});

export const convenioSchema = z.object({
  nome: z.string(),
  logo: imagemSchema.optional(),
  observacao: z.string().optional(),
});

export const depoimentoSchema = z.object({
  texto: z.string(),
  /** Identificação AUTORIZADA pelo paciente (ex.: "Maria S."). */
  autor: z.string(),
  /** Origem verificável, ex.: "Avaliação no Google" */
  fonte: z.string(),
  link: z.url().optional(),
  data: z.string().optional(),
  /** Obrigatório true para publicar em produção. */
  consentimento: z.boolean(),
});

const tituloSchema = z.string().min(1);

export const secaoId = z.enum([
  'sobre',
  'equipe',
  'unidades',
  'convenios',
  'valores',
  'depoimentos',
  'galeria',
  'faq',
]);
export type SecaoId = z.infer<typeof secaoId>;

export const clinicSchema = z.object({
  site: z.object({
    /** 'demonstracao' aceita placeholders e marca o site como não indexável. */
    modo: z.enum(['demonstracao', 'producao']),
    url: z.url(),
    titulo: z.string(),
    descricao: z.string(),
    imagemCompartilhamento: imagemSchema.optional(),
    /** Força noindex mesmo em produção (ex.: homologação). */
    noindex: z.boolean().default(false),
  }),

  marca: z.object({
    nome: z.string(),
    /** Palavra da marca em serif itálico (ex.: "alva"). */
    nomeCurto: z.string(),
    /** Texto pequeno ao lado da marca (ex.: "Odontologia"). */
    descritor: z.string().optional(),
    /** Logo em imagem/SVG. Sem logo, usa a marca tipográfica do design. */
    logo: z
      .object({ src: imagemSchema, alt: z.string(), altura: z.number().default(32) })
      .optional(),
    cores: z.object({
      primaria: hex.default('#5B1626'),
      /** Cor de apoio para superfícies alternativas. Derivada da primária se ausente. */
      secundaria: hex.optional(),
    }),
  }),

  contato: z.object({
    /** WhatsApp central (DDI+DDD+número, só dígitos). */
    whatsapp: z.string().optional(),
    telefone: z.string().optional(),
    email: z.string().optional(),
    redes: z
      .object({
        instagram: z.url().optional(),
        facebook: z.url().optional(),
        youtube: z.url().optional(),
        tiktok: z.url().optional(),
        linkedin: z.url().optional(),
      })
      .default({}),
    mensagemPadrao: z.string().default('Olá! Gostaria de agendar uma avaliação.'),
  }),

  hero: z.object({
    local: z.string(),
    titulo: tituloSchema,
    texto: z.string(),
    /** '3d' = dente tridimensional; 'foto' = foto real da clínica no arco. */
    visual: z.enum(['3d', 'foto']).default('3d'),
    foto: fotoSchema.optional(),
    ctaPrimario: z.string().default('Agendar avaliação'),
    nota: z.string().optional(),
    agendamentoRapido: z.boolean().default(true),
  }),

  tratamentosSecao: z
    .object({
      tituloAbertura: tituloSchema.default('Cuidado em cada detalhe, *por dentro e por fora.*'),
      tituloAnatomia: tituloSchema.default('Conheça o dente *por dentro.*'),
      textoAnatomia: z
        .string()
        .default(
          'Esmalte, dentina, polpa e raiz trabalham juntos. Por isso, todo tratamento começa por uma avaliação completa.',
        ),
      tituloLista: tituloSchema.default('O que podemos *fazer por você.*'),
      tituloMobile: tituloSchema.default('Cada camada do dente, um *cuidado.*'),
    })
    .default({
      tituloAbertura: 'Cuidado em cada detalhe, *por dentro e por fora.*',
      tituloAnatomia: 'Conheça o dente *por dentro.*',
      textoAnatomia:
        'Esmalte, dentina, polpa e raiz trabalham juntos. Por isso, todo tratamento começa por uma avaliação completa.',
      tituloLista: 'O que podemos *fazer por você.*',
      tituloMobile: 'Cada camada do dente, um *cuidado.*',
    }),
  tratamentos: z.array(tratamentoSchema).min(1, 'Cadastre pelo menos um tratamento'),

  especialidadesSecao: z
    .object({ titulo: tituloSchema.default('Um especialista para cada *etapa* do seu sorriso.') })
    .default({ titulo: 'Um especialista para cada *etapa* do seu sorriso.' }),
  especialidades: z.array(especialidadeSchema).default([]),

  sobre: z
    .object({
      titulo: tituloSchema,
      texto: z.array(z.string()).min(1),
      diferenciais: z.array(z.object({ texto: z.string(), rotulo: z.string() })).default([]),
      fotos: z.array(fotoSchema).max(2).default([]),
      /** Placeholders exibidos no modo demonstração quando não há fotos. */
      rotulosFotos: z.array(z.string()).default(['Recepção', 'Consultório']),
    })
    .optional(),

  equipeSecao: z
    .object({ titulo: tituloSchema.default('Quem cuida de *você.*') })
    .default({ titulo: 'Quem cuida de *você.*' }),
  equipe: z.array(profissionalSchema).default([]),

  unidadesSecao: z
    .object({
      tituloVarias: tituloSchema.default('Sempre uma unidade *perto de você.*'),
      tituloUnica: tituloSchema.default('Onde *estamos.*'),
    })
    .default({ tituloVarias: 'Sempre uma unidade *perto de você.*', tituloUnica: 'Onde *estamos.*' }),
  unidades: z.array(unidadeSchema).min(1, 'Cadastre pelo menos uma unidade'),

  convenios: z
    .object({
      titulo: tituloSchema.default('Convênios aceitos'),
      itens: z.array(convenioSchema).default([]),
      observacao: z.string().optional(),
    })
    .default({ titulo: 'Convênios aceitos', itens: [] }),

  valores: z
    .object({
      titulo: tituloSchema.default('Valores de referência'),
      /**
       * A divulgação de preços é restrita pelo Código de Ética Odontológica.
       * Para publicar em produção, o responsável técnico precisa revisar e
       * marcar `revisadoPeloResponsavel: true`.
       */
      revisadoPeloResponsavel: z.boolean().default(false),
      itens: z.array(z.object({ item: z.string(), valor: z.string() })).default([]),
      observacao: z
        .string()
        .default('O plano de tratamento e o orçamento final são definidos após a avaliação clínica.'),
    })
    .default({
      titulo: 'Valores de referência',
      revisadoPeloResponsavel: false,
      itens: [],
      observacao: 'O plano de tratamento e o orçamento final são definidos após a avaliação clínica.',
    }),

  depoimentos: z.array(depoimentoSchema).default([]),

  galeria: z
    .object({ titulo: tituloSchema.default('Conheça o *espaço.*'), fotos: z.array(fotoSchema).default([]) })
    .default({ titulo: 'Conheça o *espaço.*', fotos: [] }),

  faq: z
    .object({
      titulo: tituloSchema.default('Perguntas *frequentes.*'),
      itens: z.array(z.object({ pergunta: z.string(), resposta: z.string() })).default([]),
    })
    .default({ titulo: 'Perguntas *frequentes.*', itens: [] }),

  agendamento: z.object({
    titulo: tituloSchema.default('Vamos cuidar do seu *sorriso?*'),
    texto: z.string(),
    /** Opções de interesse/motivo. */
    motivos: z.array(z.string()).min(1),
    periodos: z.array(z.string()).min(1).default(['Manhã', 'Tarde', 'Noite']),
  }),

  legal: z.object({
    responsavelTecnico: z.object({ nome: z.string(), cro: z.string() }),
    razaoSocial: z.string(),
    cnpj: z.string(),
    /** Encarregado pelo tratamento de dados (LGPD). */
    encarregado: z.object({ nome: z.string().optional(), email: z.string() }).optional(),
    politicaAtualizadaEm: z.string().optional(),
  }),

  /**
   * Liga/desliga módulos. Uma seção só aparece se estiver ligada E tiver dados.
   * Valores fica desligado por padrão.
   */
  secoes: z
    .object({
      tratamentos: z.boolean().default(true),
      especialidades: z.boolean().default(true),
      sobre: z.boolean().default(true),
      equipe: z.boolean().default(true),
      unidades: z.boolean().default(true),
      convenios: z.boolean().default(true),
      valores: z.boolean().default(false),
      depoimentos: z.boolean().default(true),
      galeria: z.boolean().default(true),
      faq: z.boolean().default(true),
    })
    .default({
      tratamentos: true,
      especialidades: true,
      sobre: true,
      equipe: true,
      unidades: true,
      convenios: true,
      valores: false,
      depoimentos: true,
      galeria: true,
      faq: true,
    }),

  /**
   * Cena 3D. Sem `modeloGlb`, usa a geometria procedural gerada a partir das
   * curvas do design. Com ele (ex.: "/assets/models/dente.glb"), carrega o GLB
   * seguindo a convenção de nós descrita em MOTION.md.
   */
  cena3d: z.object({ modeloGlb: z.string().optional() }).default({}),

  /** Ordem das seções de conteúdo entre a sequência 3D e o agendamento. */
  ordem: z
    .array(secaoId)
    .default(['sobre', 'equipe', 'unidades', 'galeria', 'convenios', 'valores', 'depoimentos', 'faq']),

  demo: z
    .object({
      /** Mostra a etiqueta "Módulo opcional" nas seções (apenas demonstração). */
      marcarModulos: z.boolean().default(true),
    })
    .default({ marcarModulos: true }),
});

/** Formato que o cliente escreve (com defaults opcionais). */
export type ClinicInput = z.input<typeof clinicSchema>;
/** Formato validado, com defaults aplicados. */
export type ClinicConfig = z.output<typeof clinicSchema>;
export type Unidade = ClinicConfig['unidades'][number];
export type Tratamento = ClinicConfig['tratamentos'][number];
export type Especialidade = ClinicConfig['especialidades'][number];
export type Profissional = ClinicConfig['equipe'][number];
export type Foto = z.output<typeof fotoSchema>;
export type Imagem = z.output<typeof imagemSchema>;
export type CamadaDente = z.infer<typeof camadaDente>;

/** Helper para autocompletar no arquivo do cliente. */
export function defineClinic(input: ClinicInput): ClinicInput {
  return input;
}
