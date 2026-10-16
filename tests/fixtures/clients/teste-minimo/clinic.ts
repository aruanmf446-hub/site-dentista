import { variant, FAKE_WA } from '../_base';
/** Todas as seções opcionais desligadas. */
export default variant((c) => {
  c.contato.whatsapp = FAKE_WA[0];
  c.secoes = {
    tratamentos: true,
    especialidades: false,
    sobre: false,
    equipe: false,
    unidades: false,
    convenios: false,
    valores: false,
    depoimentos: false,
    galeria: false,
    faq: false,
  };
});
