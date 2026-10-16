export interface SiteData {
  demo: boolean;
  marca: string;
  mensagemPadrao: string;
  central: string | null;
  unidades: { id: string; nome: string; numero: string | null }[];
}

let cache: SiteData | null = null;

export function siteData(): SiteData {
  if (cache) return cache;
  const el = document.getElementById('site-data');
  cache = el ? (JSON.parse(el.textContent || '{}') as SiteData) : { demo: false, marca: '', mensagemPadrao: '', central: null, unidades: [] };
  return cache;
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isCinema = () => document.documentElement.classList.contains('is-cinema');
