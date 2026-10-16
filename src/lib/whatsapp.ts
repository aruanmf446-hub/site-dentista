/**
 * Monta links e mensagens do WhatsApp. Usado no build (links estáticos)
 * e no navegador (formulários). Não envia nada a servidores próprios:
 * o visitante é quem envia a mensagem pelo WhatsApp.
 */
import { PLACEHOLDER_RE } from './placeholders';

export function normalizeNumber(raw: string | undefined | null): string | null {
  if (!raw || PLACEHOLDER_RE.test(raw)) return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 12 ? digits : null;
}

export function waUrl(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export interface PedidoContato {
  nome?: string;
  unidade?: string;
  motivo?: string;
  periodo?: string;
  tratamento?: string;
}

/** Mensagem organizada, sem dados sensíveis (não pede CPF, sintomas detalhados etc.). */
export function buildMensagem(p: PedidoContato): string {
  const linhas: string[] = [];
  linhas.push(p.nome ? `Olá! Meu nome é ${p.nome.trim()}.` : 'Olá!');
  linhas.push(
    p.tratamento
      ? `Gostaria de saber mais e solicitar um horário para ${p.tratamento}.`
      : 'Gostaria de solicitar um horário.',
  );
  if (p.unidade) linhas.push(`• Unidade: ${p.unidade}`);
  if (p.motivo) linhas.push(`• Interesse: ${p.motivo}`);
  if (p.periodo) linhas.push(`• Período de preferência: ${p.periodo}`);
  linhas.push('Fico no aguardo para combinarmos o melhor horário.');
  return linhas.join('\n');
}
