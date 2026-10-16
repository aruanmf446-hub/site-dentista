/**
 * Dados estruturados (schema.org). Regras:
 * - só usa dados reais (sem placeholders);
 * - nunca gera avaliações (aggregateRating/review), prêmios ou credenciais
 *   que não estejam na configuração;
 * - no modo demonstração, não emite LocalBusiness (dados fictícios).
 */
import type { ClinicConfig, Unidade } from '../config/clinic.schema';
import { isReal } from './placeholders';
import { normalizeNumber } from './whatsapp';

type Json = Record<string, unknown>;

function clean<T extends Json>(obj: T): T {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) delete obj[k];
  }
  return obj;
}

function telefone(u: Unidade, c: ClinicConfig): string | undefined {
  const t = u.telefone ?? c.contato.telefone;
  return isReal(t) ? t : undefined;
}

function unidadeLd(u: Unidade, c: ClinicConfig, url: string): Json | null {
  const e = u.endereco;
  if (![e.logradouro, e.bairro, e.cidade, e.uf].every((x) => isReal(x))) return null;
  const horarios = u.horarios
    .map((h) => h.estruturado)
    .filter((h): h is NonNullable<typeof h> => !!h)
    .map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.dias.map(
        (d) =>
          ({ Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday' })[d],
      ),
      opens: h.abre,
      closes: h.fecha,
    }));
  const wa = normalizeNumber(u.whatsapp ?? c.contato.whatsapp);
  return clean({
    '@type': 'Dentist',
    '@id': `${url}/unidades/${u.id}/#clinica`,
    name: c.unidades.length > 1 ? `${c.marca.nome} — ${u.nome}` : c.marca.nome,
    url: `${url}/unidades/${u.id}/`,
    telephone: telefone(u, c) ?? (wa ? `+${wa}` : undefined),
    address: clean({
      '@type': 'PostalAddress',
      streetAddress: [e.logradouro, e.numero, e.complemento].filter((x) => isReal(x)).join(', '),
      addressLocality: e.cidade,
      addressRegion: e.uf,
      postalCode: isReal(e.cep) ? e.cep : undefined,
      addressCountry: 'BR',
    }),
    geo: u.geo ? { '@type': 'GeoCoordinates', latitude: u.geo.lat, longitude: u.geo.lng } : undefined,
    openingHoursSpecification: horarios,
    hasMap: u.mapa,
    parentOrganization: c.unidades.length > 1 ? { '@id': `${url}/#organizacao` } : undefined,
  });
}

export function organizationLd(c: ClinicConfig, url: string): Json[] {
  if (c.site.modo !== 'producao') return [];
  const sameAs = Object.values(c.contato.redes).filter((x): x is string => !!x);
  const unidades = c.unidades.map((u) => unidadeLd(u, c, url)).filter((x): x is Json => !!x);
  const org = clean({
    '@context': 'https://schema.org',
    '@type': c.unidades.length > 1 ? 'MedicalOrganization' : 'Dentist',
    '@id': `${url}/#organizacao`,
    name: c.marca.nome,
    legalName: isReal(c.legal.razaoSocial) ? c.legal.razaoSocial : undefined,
    url: `${url}/`,
    email: isReal(c.contato.email) ? c.contato.email : undefined,
    telephone: isReal(c.contato.telefone) ? c.contato.telefone : undefined,
    sameAs,
  });
  if (c.unidades.length === 1 && unidades[0]) {
    return [{ ...unidades[0], ...org, '@type': 'Dentist' }];
  }
  return [org, ...unidades.map((u) => ({ '@context': 'https://schema.org', ...u }))];
}

export function breadcrumbLd(items: { nome: string; url: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.nome, item: it.url })),
  };
}
