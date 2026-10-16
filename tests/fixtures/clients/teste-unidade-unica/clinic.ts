import { variant, FAKE_WA } from '../_base';
/** Clínica com uma única unidade e WhatsApp central. */
export default variant((c) => {
  c.unidades = [{ ...c.unidades[0]!, whatsapp: undefined }];
  c.contato.whatsapp = FAKE_WA[0];
  c.contato.telefone = '(00) 0000-0000'; // fictício, formato válido
  c.equipe = c.equipe!.map((p) => ({ ...p, unidades: ['centro'] }));
});
