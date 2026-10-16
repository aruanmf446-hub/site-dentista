import type { APIRoute } from 'astro';
import site, { siteUrl } from '@/lib/site';

/** Demonstração/homologação: bloqueia indexação. Produção: libera e aponta o sitemap. */
export const GET: APIRoute = () => {
  const bloquear = site.demo || site.c.site.noindex;
  const body = bloquear
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl()}/sitemap.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
