import { variant, FAKE_WA } from '../_base';
/** Outra cor primária (opção do design) e hero com foto em vez do 3D. */
export default variant((c) => {
  c.marca.cores = { primaria: '#2F3B52' };
  c.hero.visual = 'foto';
  c.contato.whatsapp = FAKE_WA[0];
});
