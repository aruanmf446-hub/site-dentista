/**
 * Base dos clientes de TESTE (não publicar). Partem da demonstração e
 * aplicam variações para cobrir os cenários do template. Números de
 * WhatsApp abaixo são fictícios (55 00 …) e servem só para verificar o
 * roteamento das mensagens.
 */
import demo from '../../../src/clients/alva-demo/clinic';
import type { ClinicInput } from '../../../src/config/clinic.schema';

export function variant(patch: (c: ClinicInput) => void): ClinicInput {
  const c = structuredClone(demo) as ClinicInput;
  patch(c);
  return c;
}

export const FAKE_WA = ['5500000000001', '5500000000002', '5500000000003'];
