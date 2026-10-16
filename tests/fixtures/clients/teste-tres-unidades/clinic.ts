import { variant, FAKE_WA } from '../_base';
/** Três unidades, cada uma com WhatsApp próprio e sem número central. */
export default variant((c) => {
  c.unidades = c.unidades.map((u, i) => ({ ...u, whatsapp: FAKE_WA[i], mapa: 'https://maps.google.com/?q=exemplo' }));
});
