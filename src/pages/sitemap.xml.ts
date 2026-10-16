import type { APIRoute } from 'astro';
import { rotasPublicas } from '@/lib/routes';
import { siteUrl } from '@/lib/site';

/** Sitemap gerado só com as rotas ativas da clínica. */
export const GET: APIRoute = () => {
  const base = siteUrl();
  const urls = rotasPublicas()
    .map((r) => `  <url><loc>${base}${r}</loc></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
