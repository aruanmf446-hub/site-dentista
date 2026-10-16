/**
 * Ponto único de acesso à configuração da clínica ativa.
 *
 * O cliente ativo é escolhido pela variável de ambiente CLINIC
 * (padrão: "alva-demo"), que corresponde à pasta src/clients/<CLINIC>/.
 *   CLINIC=minha-clinica npm run build
 *
 * As variantes em tests/fixtures/clients/ existem só para testes automatizados.
 */
import { z } from 'zod';
import { clinicSchema, type ClinicConfig, type ClinicInput } from './clinic.schema';
import { validateClinic } from '../lib/validate';

export const DEFAULT_CLINIC = 'alva-demo';

const modules = import.meta.glob<{ default: ClinicInput }>([
  '../clients/*/clinic.ts',
  '../../tests/fixtures/clients/*/clinic.ts',
]);

function resolveKey(name: string): string | undefined {
  return Object.keys(modules).find((k) => k.split('/').at(-2) === name);
}

export const activeClinicName = process.env.CLINIC?.trim() || DEFAULT_CLINIC;

async function load(): Promise<ClinicConfig> {
  const key = resolveKey(activeClinicName);
  if (!key) {
    const available = Object.keys(modules).map((k) => k.split('/').at(-2));
    throw new Error(`Cliente "${activeClinicName}" não encontrado. Disponíveis: ${available.join(', ')}`);
  }
  const mod = await modules[key]!();
  const parsed = clinicSchema.safeParse(mod.default);
  if (!parsed.success) {
    throw new Error(`Configuração inválida em ${key}:\n${z.prettifyError(parsed.error)}`);
  }
  const report = validateClinic(parsed.data);
  for (const w of report.warnings) console.warn(`[clinic:${activeClinicName}] aviso: ${w}`);
  if (report.errors.length) {
    throw new Error(
      `Configuração de "${activeClinicName}" não pode ser publicada:\n- ${report.errors.join('\n- ')}`,
    );
  }
  return parsed.data;
}

const clinic: ClinicConfig = await load();
export default clinic;
