/**
 * Renderizador mínimo dos artboards do Claude Design (.dc.html) para gerar
 * imagens de referência nos testes visuais. Suporta o subconjunto usado
 * pelos arquivos em design/claude-design/: {{lacunas}}, <sc-for>, <sc-if>,
 * <helmet> e a classe Component (DCLogic) com renderVals().
 * As fontes são embutidas a partir do @fontsource (sem rede).
 */
import fs from 'node:fs';
import path from 'node:path';

type Vals = Record<string, unknown>;

function get(scope: Vals, expr: string): unknown {
  const e = expr.trim();
  if (e === 'true') return true;
  if (e === 'false') return false;
  return e.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Vals)[k]), scope);
}

function interpolate(s: string, scope: Vals): string {
  return s.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr: string) => {
    const v = get(scope, expr);
    return v == null || typeof v === 'function' ? '' : String(v);
  });
}

/** Encontra a tag de fechamento correspondente considerando aninhamento. */
function matchClose(src: string, tag: string, from: number): number {
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  re.lastIndex = from;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return m.index;
  }
  throw new Error(`</${tag}> não encontrado`);
}

function render(src: string, scope: Vals): string {
  let out = '';
  let i = 0;
  const open = /<(sc-for|sc-if)\b([^>]*)>/g;
  open.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = open.exec(src))) {
    out += interpolate(src.slice(i, m.index), scope);
    const tag = m[1]!;
    const attrs = m[2]!;
    const bodyStart = m.index + m[0].length;
    const end = matchClose(src, tag, bodyStart);
    const body = src.slice(bodyStart, end);
    const attr = (n: string) => attrs.match(new RegExp(`${n}="([^"]*)"`))?.[1] ?? '';
    if (tag === 'sc-for') {
      const list = get(scope, attr('list').replace(/[{}]/g, '')) as unknown[];
      const as = attr('as');
      (list || []).forEach((item) => (out += render(body, { ...scope, [as]: item })));
    } else {
      const v = get(scope, attr('value').replace(/[{}]/g, ''));
      if (v) out += render(body, scope);
    }
    i = end + `</${tag}>`.length;
    open.lastIndex = i;
  }
  return out + interpolate(src.slice(i), scope);
}

function fontFaces(root: string): string {
  const f = (p: string) => fs.readFileSync(path.join(root, 'node_modules', p)).toString('base64');
  return `
@font-face{font-family:'Instrument Serif';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${f('@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2')}) format('woff2')}
@font-face{font-family:'Instrument Serif';font-style:italic;font-weight:400;src:url(data:font/woff2;base64,${f('@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2')}) format('woff2')}
@font-face{font-family:'Hanken Grotesk';font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,${f('@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2')}) format('woff2')}`;
}

/** Converte um artboard em HTML estático. */
export function renderArtboard(file: string, root = process.cwd()): { html: string; width: number; height: number } {
  const src = fs.readFileSync(file, 'utf8');
  const xdc = src.match(/<x-dc>([\s\S]*?)<\/x-dc>/)![1]!;
  const helmet = xdc.match(/<helmet>([\s\S]*?)<\/helmet>/)?.[1] ?? '';
  const body = xdc.replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  const scriptTag = src.match(/<script type="text\/x-dc"[^>]*data-props='([^']*)'[^>]*>([\s\S]*?)<\/script>/)!;
  const props = JSON.parse(scriptTag[1]!) as Record<string, { default?: unknown }>;
  const defaults: Vals = {};
  for (const [k, v] of Object.entries(props)) if (k !== '$preview' && v && 'default' in v) defaults[k] = v.default;
  // enum do hero: "3D"
  class DCLogic {
    props: Vals;
    state: Vals = {};
    constructor(p: Vals) {
      this.props = p;
    }
    setState(s: Vals) {
      Object.assign(this.state, s);
    }
  }
  const Component = new Function('DCLogic', `${scriptTag[2]}\nreturn Component;`)(DCLogic) as new (p: Vals) => { renderVals(): Vals };
  const vals = new Component(defaults).renderVals();
  const html = render(body, vals).replace(/\son[A-Z][a-z]+="[^"]*"/g, '');
  const head = helmet.replace(/<link[^>]+fonts\.googleapis[^>]+>/g, '');
  const preview = props.$preview as unknown as { width: number; height: number };
  return {
    width: preview.width,
    height: preview.height,
    html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${fontFaces(root)}</style>${head}</head><body>${html}</body></html>`,
  };
}
