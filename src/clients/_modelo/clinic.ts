/**
 * MODELO PARA UMA NOVA CLÍNICA
 *
 * Não edite este arquivo diretamente. Crie o cliente com:
 *   node scripts/nova-clinica.mjs nome-da-clinica
 * e edite src/clients/nome-da-clinica/clinic.ts.
 *
 * Regras (ver CUSTOMIZATION.md e COMPLIANCE.md):
 * - Tudo entre [colchetes] é placeholder. Substitua por dados REAIS e
 *   verificados. Com `site.modo: 'producao'` o build falha se sobrar algum.
 * - Nunca invente profissionais, CRO, endereços, convênios, preços ou avaliações.
 * - Fotos: coloque os arquivos em ./fotos/ e importe (import fachada from './fotos/fachada.jpg').
 * - Textos de tratamento são conteúdo da clínica: escreva e revise com o
 *   responsável técnico.
 */
import { defineClinic } from '../../config/clinic.schema';
// import fachada from './fotos/fachada.jpg';

export default defineClinic({
  site: {
    modo: 'demonstracao', // troque para 'producao' quando os dados estiverem completos
    url: 'https://www.dominio-da-clinica.exemplo', // troque pelo domínio real
    titulo: '[Nome da Clínica] — Odontologia em [Cidade]',
    descricao: '[Descrição curta da clínica para buscadores, até ~155 caracteres.]',
  },

  marca: {
    nome: '[Nome da Clínica]',
    nomeCurto: '[nome]',
    descritor: 'Odontologia',
    cores: { primaria: '#5B1626' }, // contraste com texto claro ≥ 4,5:1 (o build avisa)
  },

  contato: {
    whatsapp: '[55DDD000000000]', // só dígitos, com DDI 55
    telefone: '[(00) 0000-0000]',
    email: '[contato@clinica.com.br]',
    redes: {},
  },

  hero: {
    local: 'Clínica odontológica · [Bairro, Cidade]',
    titulo: 'O cuidado que\nfica no seu *sorriso.*',
    texto: '[Frase de apresentação da clínica.]',
    visual: '3d',
  },

  tratamentos: [
    {
      slug: 'avaliacao',
      nome: 'Avaliação',
      resumo: '[Uma frase sobre a avaliação.]',
      descricao: ['[Texto próprio sobre a avaliação, revisado pelo responsável técnico.]'],
    },
  ],

  especialidades: [],

  unidades: [
    {
      id: 'principal',
      nome: '[Nome da unidade]',
      endereco: { logradouro: '[Rua]', numero: '[número]', bairro: '[Bairro]', cidade: '[Cidade]', uf: '[UF]' },
      horarios: [{ dias: 'Seg a sex', horas: '[8h–18h]' }],
      fotos: [],
    },
  ],

  agendamento: {
    titulo: 'Vamos cuidar do seu *sorriso?*',
    texto: 'Escolha o melhor período. A equipe confirma o horário com você pelo WhatsApp.',
    motivos: ['Primeira avaliação', 'Outro assunto'],
  },

  legal: {
    responsavelTecnico: { nome: '[Dr(a). Nome]', cro: '[CRO-UF 00000]' },
    razaoSocial: '[Razão social]',
    cnpj: '[00.000.000/0000-00]',
    encarregado: { email: '[privacidade@clinica.com.br]' },
  },
});
