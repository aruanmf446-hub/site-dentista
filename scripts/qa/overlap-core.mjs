// Verificação de sobreposição executada DENTRO da página (page.evaluate(auditFrame)).
// Usada por scripts/qa/overlap-audit.mjs e pelos testes (tests/e2e/visual-refino.spec.ts).
// Cruza o contorno projetado do dente/arcada (por dente, na arcada) com as linhas reais
// de texto visíveis, procura textos sobrepostos e elementos fora da margem lateral.
export function auditFrame() {
  const c = window.__cinema;
  const vp = document.querySelector('[data-viewport]');
  const vr = vp.getBoundingClientRect();
  const W = vr.width;
  const H = vr.height;
  const hdr = document.querySelector('.hdr');
  const opac = (el) => {
    let o = 1;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none') return 0;
      o *= Number(cs.opacity);
    }
    return o;
  };
  const SEL =
    'h1, h2, h3, .hero__text, .trat__b-text, .trat__label-name, .trat__label-text, .trat__list .trat__name, .trat__ctas .btn, .trat__all, .esp__item, .esp__card-title, .esp__card-text, .esp__card-link, .esp__count, .esp__note, [data-eyebrow], .trat__a-title, .hero__ctas .btn, .quick, .hero__note';
  const texts = [];
  for (const el of document.querySelectorAll(`[data-viewport] :is(${SEL})`)) {
    const o = opac(el);
    if (o < 0.5) continue;
    const b = el.getBoundingClientRect();
    if (b.width < 2 || b.height < 2 || b.bottom < 0 || b.top > H) continue;
    // caixas reais das linhas de texto (o elemento costuma ser mais largo que o texto)
    const rg = document.createRange();
    rg.selectNodeContents(el);
    const linhas = Array.from(rg.getClientRects()).filter((q) => q.width > 1 && q.height > 1);
    const caixas = el.matches('.btn, .esp__item, .quick') || !linhas.length ? [b] : linhas;
    const nome = (el.className || el.tagName).toString().split(' ')[0] + ':' + (el.textContent || '').trim().slice(0, 24);
    for (const q of caixas) texts.push({ el, nome, l: q.left, t: q.top, r: q.right, b: q.bottom });
  }
  const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  const achados = [];
  const s = c.stage;
  const alvo = c.state.arch > 0.5 ? 'arcade' : 'tooth';
  const sr = s?.screenRect(alvo);
  const objs = alvo === 'arcade' ? s.archToothRects() : sr ? [sr] : [];
  const vistos = new Set();
  for (const q of objs) {
    if (q.right - q.left < 4) continue;
    const obj = { l: q.left, t: q.top, r: q.right, b: q.bottom };
    for (const x of texts) {
      const a = inter(obj, x);
      // tolera encostar (< 3% da linha): sobreposição real é crítica
      const area = (x.r - x.l) * (x.b - x.t);
      const k = x.nome + Math.round(x.t);
      if (a > area * 0.03 && a > 40 && !vistos.has(k)) {
        vistos.add(k);
        achados.push({ tipo: `3D(${alvo})×texto`, item: x.nome, px: Math.round(a), pct: Math.round((a / area) * 100) });
      }
    }
  }
  for (let i = 0; i < texts.length; i++)
    for (let j = i + 1; j < texts.length; j++) {
      const A = texts[i];
      const B = texts[j];
      if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue;
      const a = inter(A, B);
      if (a > 40) achados.push({ tipo: 'texto×texto', item: `${A.nome} / ${B.nome}`, px: Math.round(a) });
    }
  // fundo coberto pela barra fixa do celular (quando existe)
  const bar = document.querySelector('[data-mobile-bar]');
  const barTop = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().top : H;
  for (const x of texts) {
    if (x.l < 8 || x.r > W - 8) achados.push({ tipo: 'margem', item: x.nome, px: Math.round(Math.min(x.l, W - x.r)) });
    if (x.b > Math.min(H, barTop) - 2 || x.t < 0) achados.push({ tipo: 'cortado', item: x.nome, px: Math.round(x.b - Math.min(H, barTop)) });
    if (hdr) {
      // o cabeçalho visível (barra completa ou pílula) não pode cobrir texto da cena
      const pill = hdr.querySelector('.hdr-pill');
      const usePill = pill && !pill.hasAttribute('inert');
      const r = (usePill ? pill : hdr.querySelector('.hdr-full') || hdr).getBoundingClientRect();
      const a = inter({ l: r.left, t: r.top, r: r.right, b: r.bottom }, x);
      if (a > 60 && !hdr.contains(x.el)) achados.push({ tipo: 'header×texto', item: x.nome, px: Math.round(a) });
    }
  }
  return { tempo: +c.tl.time().toFixed(2), alvo, rect3d: sr && [sr.left, sr.top, sr.right, sr.bottom].map(Math.round), achados };
}
