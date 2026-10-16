import { variant, FAKE_WA } from '../_base';
/** Dez tratamentos na home (lista em duas colunas). */
export default variant((c) => {
  c.tratamentos = c.tratamentos.map((t) => ({ ...t, exibirNaHome: true }));
  c.contato.whatsapp = FAKE_WA[0];
});
