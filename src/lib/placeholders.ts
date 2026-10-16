/**
 * Placeholders são textos entre colchetes, ex.: "[Bairro, Cidade]".
 * Servem para a demonstração e para marcar o que o cliente ainda precisa
 * fornecer. Nunca devem ser publicados como informação verdadeira.
 */
export const PLACEHOLDER_RE = /\[[^\]\n]{1,120}\]/;

export function isPlaceholder(value: unknown): boolean {
  return typeof value === 'string' && PLACEHOLDER_RE.test(value);
}

/** Retorna true se o valor existe e não contém placeholder. */
export function isReal(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !PLACEHOLDER_RE.test(value);
}

/** Percorre o objeto e lista os caminhos com placeholders. */
export function findPlaceholders(input: unknown, path = ''): string[] {
  const found: string[] = [];
  const walk = (v: unknown, p: string) => {
    if (typeof v === 'string') {
      if (PLACEHOLDER_RE.test(v)) found.push(`${p}: "${v}"`);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${p}[${i}]`));
      return;
    }
    if (v && typeof v === 'object') {
      // ImageMetadata (imagens importadas) não é texto de conteúdo.
      if ('src' in v && 'width' in v && 'format' in v) return;
      for (const [k, child] of Object.entries(v)) walk(child, p ? `${p}.${k}` : k);
    }
  };
  walk(input, path);
  return found;
}
