import { variant, FAKE_WA } from '../_base';
/** Clínica que oferece apenas dois tratamentos e uma especialidade. */
export default variant((c) => {
  c.tratamentos = c.tratamentos.filter((t) => ['limpeza', 'restauracoes'].includes(t.slug)).map((t) => ({ ...t, especialidade: undefined }));
  c.especialidades = c.especialidades!.slice(2, 3);
  c.contato.whatsapp = FAKE_WA[0];
});
