/**
 * Rotas públicas derivadas da configuração. Usadas por getStaticPaths,
 * pelo sitemap e pelos testes — uma seção desligada não gera página nem link.
 */
import site from './site';

export function rotaEquipeAtiva(): boolean {
  return site.ativo('equipe');
}

export function rotaUnidadesAtiva(): boolean {
  return site.ativo('unidades') && site.multiUnidade;
}

export function rotaSobreAtiva(): boolean {
  return site.ativo('sobre');
}

export function rotasPublicas(): string[] {
  const c = site.c;
  const r = ['/', '/tratamentos/', ...c.tratamentos.map((t) => `/tratamentos/${t.slug}/`), '/contato/', '/privacidade/'];
  if (rotaSobreAtiva()) r.push('/a-clinica/');
  if (rotaEquipeAtiva()) r.push('/equipe/', ...site.equipeComPagina.map((p) => `/equipe/${p.slug}/`));
  if (rotaUnidadesAtiva()) r.push('/unidades/', ...c.unidades.map((u) => `/unidades/${u.id}/`));
  return r;
}
