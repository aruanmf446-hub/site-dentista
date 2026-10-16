import { variant, FAKE_WA } from '../_base';
/**
 * Modo produção com dados FICTÍCIOS em formato válido — usado apenas para
 * provar que o build de produção passa quando não há placeholders.
 * NÃO representa uma clínica real.
 */
export default variant((c) => {
  c.site.modo = 'producao';
  c.site.url = 'https://clinica-ficticia-de-teste.invalid';
  c.site.noindex = true;
  c.marca.nome = 'Clínica Fictícia de Teste';
  c.hero.local = 'Clínica odontológica · Bairro Fictício, Cidade Fictícia';
  c.hero.nota = 'Seg a sex 8h–18h';
  c.contato = { whatsapp: FAKE_WA[0], redes: {} };
  c.sobre = { titulo: 'Um espaço pensado para o seu *conforto.*', texto: ['Texto institucional de teste.'], diferenciais: [], fotos: [] };
  c.equipe = [];
  c.especialidades = c.especialidades!.map((e) => ({ ...e, profissionais: [] }));
  c.unidades = [
    {
      id: 'unica',
      nome: 'Unidade de Teste',
      endereco: { logradouro: 'Rua Fictícia', numero: '1', bairro: 'Bairro Fictício', cidade: 'Cidade Fictícia', uf: 'SP' },
      horarios: [{ dias: 'Seg a sex', horas: '8h–18h', estruturado: { dias: ['Mo', 'Tu', 'We', 'Th', 'Fr'], abre: '08:00', fecha: '18:00' } }],
      fotos: [],
    },
  ];
  c.convenios = { titulo: 'Convênios aceitos', itens: [] };
  c.valores = { titulo: 'Valores', revisadoPeloResponsavel: false, itens: [] };
  c.depoimentos = [];
  c.galeria = { titulo: 'Galeria', fotos: [] };
  c.faq = { titulo: 'Perguntas', itens: [] };
  c.legal = {
    responsavelTecnico: { nome: 'Dr. Responsável Fictício', cro: 'CRO-SP 00000' },
    razaoSocial: 'Clínica Fictícia de Teste Ltda.',
    cnpj: '00.000.000/0000-00',
    encarregado: { email: 'privacidade@clinica-ficticia-de-teste.invalid' },
  };
  c.secoes = { ...c.secoes, valores: false };
});
