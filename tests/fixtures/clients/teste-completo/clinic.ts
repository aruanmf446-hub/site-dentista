import { variant, FAKE_WA } from '../_base';
/** Todas as seções opcionais ligadas, com os dados de demonstração. */
export default variant((c) => {
  c.unidades = c.unidades.map((u, i) => ({ ...u, whatsapp: FAKE_WA[i] }));
  c.secoes = {
    tratamentos: true,
    especialidades: true,
    sobre: true,
    equipe: true,
    unidades: true,
    convenios: true,
    valores: true,
    depoimentos: true,
    galeria: true,
    faq: true,
  };
});
