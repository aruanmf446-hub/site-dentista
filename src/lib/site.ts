/**
 * Modelo derivado da configuração: quais seções existem de fato, numeração
 * dos capítulos, itens de menu e destinos de WhatsApp. Tudo que depende de
 * "o que está ligado" passa por aqui, para que menu, índice de progresso,
 * sequência 3D e páginas concordem entre si.
 */
import clinic from '../config/clinic.config';
import type { ClinicConfig, SecaoId, Unidade } from '../config/clinic.schema';
import { isReal } from './placeholders';
import { normalizeNumber, waUrl } from './whatsapp';

export type CapituloId = 'inicio' | 'tratamentos' | 'especialidades' | 'clinica' | 'agendamento';

export interface Capitulo {
  id: CapituloId;
  numero: string;
  rotulo: string;
  /** âncora da seção onde o capítulo começa */
  ancora: string;
}

export interface NavItem {
  id: string;
  rotulo: string;
  href: string;
  /** some do header compacto (pílula) quando houver itens demais */
  secundario?: boolean;
}

export interface WaTarget {
  /** null quando o número ainda é placeholder (demonstração) */
  numero: string | null;
  rotulo: string;
  href: string | null;
}

function temDados(c: ClinicConfig, id: SecaoId): boolean {
  switch (id) {
    case 'sobre':
      return !!c.sobre;
    case 'equipe':
      return c.equipe.length > 0;
    case 'unidades':
      return c.unidades.length > 0;
    case 'convenios':
      return c.convenios.itens.length > 0;
    case 'valores':
      return c.valores.itens.length > 0;
    case 'depoimentos':
      return depoimentosPublicaveis(c).length > 0;
    case 'galeria':
      return c.galeria.fotos.length > 0;
    case 'faq':
      return c.faq.itens.length > 0;
  }
}

export function depoimentosPublicaveis(c: ClinicConfig) {
  return c.site.modo === 'producao' ? c.depoimentos.filter((d) => d.consentimento) : c.depoimentos;
}

export function buildModel(c: ClinicConfig) {
  const demo = c.site.modo === 'demonstracao';
  const multiUnidade = c.unidades.length > 1;
  const cenaTratamentos = c.secoes.tratamentos && c.tratamentos.length > 0;
  const cenaEspecialidades = c.secoes.especialidades && c.especialidades.length > 0;

  const conteudo: SecaoId[] = c.ordem.filter((id) => c.secoes[id] && temDados(c, id));
  // Convênios e valores dividem a mesma faixa no design quando vizinhos.
  const ativo = (id: SecaoId) => conteudo.includes(id);

  const capitulos: Capitulo[] = [];
  const push = (id: CapituloId, rotulo: string, ancora: string) =>
    capitulos.push({ id, rotulo, ancora, numero: String(capitulos.length).padStart(2, '0') });
  push('inicio', 'Início', 'inicio');
  if (cenaTratamentos) push('tratamentos', 'Tratamentos', 'tratamentos');
  if (cenaEspecialidades) push('especialidades', 'Especialidades', 'especialidades');
  if (conteudo.length) push('clinica', ativo('sobre') ? 'A clínica' : 'Clínica', conteudo[0]!);
  push('agendamento', 'Agendamento', 'agendamento');
  const numeroDe = (id: CapituloId) => capitulos.find((x) => x.id === id)?.numero;

  const nav: NavItem[] = [];
  if (cenaTratamentos) nav.push({ id: 'tratamentos', rotulo: 'Tratamentos', href: '/#tratamentos' });
  if (cenaEspecialidades) nav.push({ id: 'especialidades', rotulo: 'Especialidades', href: '/#especialidades' });
  if (ativo('equipe')) nav.push({ id: 'equipe', rotulo: 'Equipe', href: '/#equipe' });
  if (ativo('unidades')) nav.push({ id: 'unidades', rotulo: multiUnidade ? 'Unidades' : 'Onde estamos', href: '/#unidades' });
  if (ativo('convenios')) nav.push({ id: 'convenios', rotulo: 'Convênios', href: '/#convenios', secundario: true });
  nav.push({ id: 'agendamento', rotulo: 'Contato', href: '/#agendamento' });

  const central = normalizeNumber(c.contato.whatsapp);
  const mensagem = c.contato.mensagemPadrao;
  const alvo = (u?: Unidade): WaTarget => {
    const numero = normalizeNumber(u?.whatsapp) ?? central;
    return {
      numero,
      rotulo: u ? u.nomeCurto ?? u.nome : c.marca.nome,
      href: numero ? waUrl(numero, mensagem) : null,
    };
  };
  const whatsappUnidades = Object.fromEntries(c.unidades.map((u) => [u.id, alvo(u)]));
  // CTA genérico: número central; se não houver e só existir uma unidade, o dela.
  const whatsappPrincipal: WaTarget = central
    ? alvo()
    : multiUnidade
      ? { numero: null, rotulo: c.marca.nome, href: null }
      : whatsappUnidades[c.unidades[0]!.id]!;
  // Com várias unidades sem número central, o visitante escolhe a unidade antes.
  const precisaEscolherUnidade = multiUnidade && !central;

  const telefone = isReal(c.contato.telefone) ? c.contato.telefone : null;

  return {
    c,
    demo,
    multiUnidade,
    cenaTratamentos,
    cenaEspecialidades,
    conteudo,
    ativo,
    capitulos,
    numeroDe,
    nav,
    whatsappPrincipal,
    whatsappUnidades,
    precisaEscolherUnidade,
    telefone,
    marcarModulos: demo && c.demo.marcarModulos,
    tratamentosHome: c.tratamentos.filter((t) => t.exibirNaHome),
    equipeComPagina: c.equipe.filter((p) => p.pagina && p.bio.length > 0),
  };
}

export type SiteModel = ReturnType<typeof buildModel>;

export const site: SiteModel = buildModel(clinic);
export default site;

export function unidadeNome(id: string): string {
  const u = clinic.unidades.find((x) => x.id === id);
  return u ? u.nomeCurto ?? u.nome : id;
}

export function enderecoLinha(u: Unidade): string {
  const e = u.endereco;
  const rua = [e.logradouro, e.numero].filter(Boolean).join(', ');
  return `${rua}${e.complemento ? ` (${e.complemento})` : ''} — ${e.bairro}, ${e.cidade}/${e.uf}`;
}

/** Converte "texto *destaque* texto" em partes para renderização. */
export function splitDestaque(titulo: string): { texto: string; destaque: boolean }[] {
  const partes: { texto: string; destaque: boolean }[] = [];
  titulo.split(/(\*[^*]+\*)/g).forEach((p) => {
    if (!p) return;
    if (p.startsWith('*') && p.endsWith('*')) partes.push({ texto: p.slice(1, -1), destaque: true });
    else partes.push({ texto: p, destaque: false });
  });
  return partes;
}

export function semDestaque(titulo: string): string {
  return titulo.replace(/\*/g, '');
}

export function siteUrl(): string {
  return (process.env.SITE_URL || clinic.site.url).replace(/\/$/, '');
}
