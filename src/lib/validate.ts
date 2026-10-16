import type { ClinicConfig } from '../config/clinic.schema';
import { findPlaceholders, isPlaceholder } from './placeholders';
import { buildTheme } from './theme';

export interface ValidationReport {
  errors: string[];
  warnings: string[];
}

const WHATSAPP_RE = /^55\d{10,11}$/;
const CRO_RE = /^CRO[-\s]?[A-Z]{2}\s*\d{3,6}$/i;

function dupes(values: string[]): string[] {
  return values.filter((v, i) => values.indexOf(v) !== i);
}

/**
 * Regras que valem em qualquer modo (integridade) e regras de publicação
 * (modo 'producao'): sem placeholders, dados legais, consentimentos etc.
 */
export function validateClinic(c: ClinicConfig): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prod = c.site.modo === 'producao';

  // ---- Integridade (sempre) ----
  for (const [nome, lista] of [
    ['tratamentos', c.tratamentos.map((t) => t.slug)],
    ['especialidades', c.especialidades.map((e) => e.slug)],
    ['equipe', c.equipe.map((p) => p.slug)],
    ['unidades', c.unidades.map((u) => u.id)],
  ] as const) {
    const d = dupes([...lista]);
    if (d.length) errors.push(`Slugs repetidos em ${nome}: ${[...new Set(d)].join(', ')}`);
  }
  const unidadeIds = new Set(c.unidades.map((u) => u.id));
  const profSlugs = new Set(c.equipe.map((p) => p.slug));
  const espSlugs = new Set(c.especialidades.map((e) => e.slug));
  for (const p of c.equipe) {
    for (const u of p.unidades) {
      if (!unidadeIds.has(u)) errors.push(`equipe "${p.slug}" cita a unidade inexistente "${u}"`);
    }
  }
  for (const e of c.especialidades) {
    for (const p of e.profissionais) {
      if (!profSlugs.has(p)) errors.push(`especialidade "${e.slug}" cita o profissional inexistente "${p}"`);
    }
  }
  for (const t of c.tratamentos) {
    if (t.especialidade && !espSlugs.has(t.especialidade)) {
      errors.push(`tratamento "${t.slug}" cita a especialidade inexistente "${t.especialidade}"`);
    }
  }
  const d = dupes(c.ordem);
  if (d.length) errors.push(`"ordem" tem seções repetidas: ${d.join(', ')}`);

  const theme = buildTheme(c.marca.cores.primaria, c.marca.cores.secundaria);
  (prod ? errors : warnings).push(...theme.warnings);

  const numeros = [c.contato.whatsapp, ...c.unidades.map((u) => u.whatsapp)].filter(Boolean) as string[];
  if (numeros.length === 0) {
    errors.push('Informe contato.whatsapp ou o WhatsApp de cada unidade: os CTAs de agendamento dependem dele.');
  }

  // ---- Publicação ----
  if (prod) {
    const ph = findPlaceholders(c);
    if (ph.length) {
      errors.push(
        `Modo produção não aceita placeholders. Substitua ${ph.length} campo(s):\n  - ${ph.slice(0, 40).join('\n  - ')}${ph.length > 40 ? '\n  - …' : ''}`,
      );
    }
    for (const n of numeros) {
      if (!WHATSAPP_RE.test(n)) errors.push(`WhatsApp "${n}" inválido. Use só dígitos com DDI 55, ex.: 5511999990000`);
    }
    if (!c.contato.whatsapp) {
      const semNumero = c.unidades.filter((u) => !u.whatsapp).map((u) => u.id);
      if (semNumero.length) errors.push(`Unidades sem WhatsApp e sem número central: ${semNumero.join(', ')}`);
    }
    if (!CRO_RE.test(c.legal.responsavelTecnico.cro)) {
      errors.push(`CRO do responsável técnico em formato inesperado: "${c.legal.responsavelTecnico.cro}" (ex.: CRO-SP 12345)`);
    }
    for (const p of c.equipe) {
      if (!CRO_RE.test(p.cro)) errors.push(`CRO de "${p.nome}" em formato inesperado: "${p.cro}"`);
      if (p.pagina && p.bio.length === 0) errors.push(`"${p.nome}" tem página própria mas não tem bio.`);
    }
    if (c.secoes.depoimentos) {
      c.depoimentos.forEach((dep, i) => {
        if (!dep.consentimento) errors.push(`Depoimento ${i + 1} (${dep.autor}) sem consentimento registrado.`);
      });
    }
    if (c.secoes.valores && c.valores.itens.length && !c.valores.revisadoPeloResponsavel) {
      errors.push(
        'O módulo Valores está ligado sem revisão. Confirme a conformidade com o Código de Ética Odontológica (CFO/CRO) e marque valores.revisadoPeloResponsavel: true, ou desligue secoes.valores.',
      );
    }
    if (!c.legal.encarregado?.email) {
      warnings.push('LGPD: informe legal.encarregado.email para a Política de Privacidade.');
    }
    if (/localhost|example\.com/.test(c.site.url)) errors.push(`site.url parece provisória: ${c.site.url}`);
  } else {
    const ph = findPlaceholders(c);
    if (ph.length) warnings.push(`Modo demonstração: ${ph.length} placeholder(s) identificados como dados fictícios.`);
    if (isPlaceholder(c.contato.whatsapp)) {
      warnings.push('WhatsApp central é placeholder: os botões abrem o aviso de demonstração.');
    }
  }
  return { errors, warnings };
}
