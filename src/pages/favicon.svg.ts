import type { APIRoute } from 'astro';
import site from '@/lib/site';

/** Favicon gerado a partir da cor primária do cliente (arco do design). */
export const GET: APIRoute = () => {
  const cor = site.c.marca.cores.primaria;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${cor}"/><path d="M9.5 26V15a6.5 6.5 0 0 1 13 0v11" fill="none" stroke="#FBF4F2" stroke-width="2.2"/></svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
};
