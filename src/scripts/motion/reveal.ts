/**
 * MOTION UI — revelações dos conteúdos fora da sequência 3D.
 *
 * Cada tipo de conteúdo tem um gesto próprio, ligado à sua hierarquia:
 *   [data-eyebrow]        filete desenha da esquerda; rótulo entra depois
 *   data-reveal="title"   linhas sobem de dentro de uma máscara (SplitText)
 *   data-reveal="text"    parágrafo sobe 16 px com fade (sem máscara: leitura longa)
 *   data-reveal="rows"    cada linha é "riscada" da esquerda (filetes do design)
 *   data-reveal="arch"    foto em arco revelada de baixo para cima; a imagem assenta (escala)
 *   data-reveal="outline" contorno do arco aparece ao redor da foto
 *   data-reveal="team"    retratos em sequência; nome e CRO logo depois
 *   data-reveal="grid"    células (convênios) em diagonal
 *   data-reveal="quote"   citação em linhas, com leve desfoque → nítido
 *   data-reveal="info"    dados de contato em sequência curta
 *   data-parallax="k"     deslocamento sutil ligado à rolagem (fotos sobrepostas)
 * Tudo acontece uma vez (once) e nada é animado com "reduzir movimento".
 * Formulários não são animados campo a campo.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

const START = 'top 86%';

function inCinema(el: Element): boolean {
  return document.documentElement.classList.contains('is-cinema') && !!el.closest('[data-cinema]');
}

function trigger(el: Element, anim: gsap.core.Animation | gsap.core.Timeline): void {
  ScrollTrigger.create({ trigger: el, start: START, once: true, animation: anim });
}

export function initReveals(): void {
  const all = <T extends Element = HTMLElement>(sel: string) =>
    Array.from(document.querySelectorAll<T>(sel)).filter((el) => !inCinema(el));

  /* Rótulos de seção */
  all('[data-eyebrow]').forEach((el) => {
    if (el.closest('.hero') || el.closest('.trat') || el.closest('.esp')) return;
    const rule = el.querySelector('.eyebrow__rule');
    const rest = Array.from(el.children).filter((c) => c !== rule);
    const tl = gsap.timeline({ paused: true });
    if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'power3.inOut' });
    tl.fromTo(rest, { autoAlpha: 0, x: -8 }, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'power2.out', stagger: 0.06 }, rule ? '-=0.35' : 0);
    trigger(el, tl);
  });

  /* Títulos: linhas mascaradas */
  all('[data-reveal="title"]').forEach((el) => {
    gsap.set(el, { autoAlpha: 1 });
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      linesClass: 'split-line',
      onSplit(self) {
        const anim = gsap.from(self.lines, { yPercent: 108, duration: 1.05, ease: 'power4.out', stagger: 0.09, paused: true });
        trigger(el, anim);
        return anim;
      },
    });
  });

  /* Parágrafos */
  all('[data-reveal="text"]').forEach((el) => {
    trigger(el, gsap.fromTo(el, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power2.out', paused: true, delay: 0.15 }));
  });

  /* Listas com filetes: cada linha é riscada da esquerda */
  all('[data-reveal="rows"]').forEach((el) => {
    const rows = Array.from(el.children) as HTMLElement[];
    trigger(
      el,
      gsap.fromTo(
        rows,
        { clipPath: 'inset(0% 100% 0% 0%)', autoAlpha: 1 },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power3.inOut', stagger: 0.09, paused: true, clearProps: 'clipPath' },
      ),
    );
  });

  /* Fotos em arco */
  all('[data-reveal="arch"]').forEach((el) => {
    const inner = el.querySelector('picture, img, .ph__label');
    const tl = gsap.timeline({ paused: true });
    tl.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)', autoAlpha: 1 }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.35, ease: 'power3.inOut', clearProps: 'clipPath' });
    if (inner) tl.fromTo(inner, { scale: 1.14 }, { scale: 1, duration: 1.6, ease: 'power3.out' }, 0);
    trigger(el, tl);
  });

  /* Contorno dos arcos */
  all('[data-reveal="outline"]').forEach((el) => {
    const target = Number(getComputedStyle(el).opacity) || 1;
    trigger(el, gsap.fromTo(el, { autoAlpha: 0, scale: 0.97 }, { autoAlpha: target, scale: 1, duration: 1.4, ease: 'power2.out', delay: 0.35, paused: true }));
  });

  /* Equipe: retrato (arco) já revela; textos entram em sequência por cartão */
  all('[data-reveal="team"]').forEach((grid) => {
    const cards = Array.from(grid.children) as HTMLElement[];
    cards.forEach((card, i) => {
      const texts = card.querySelectorAll(':scope > :not(.arch)');
      trigger(card, gsap.fromTo(texts, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out', stagger: 0.06, delay: 0.25 + i * 0.08, paused: true }));
    });
  });

  /* Grade de convênios: diagonal */
  all('[data-reveal="grid"]').forEach((el) => {
    const cells = Array.from(el.children);
    trigger(
      el,
      gsap.fromTo(
        cells,
        { autoAlpha: 0, scale: 0.94 },
        { autoAlpha: 1, scale: 1, duration: 0.7, ease: 'power2.out', stagger: { each: 0.06, grid: 'auto', from: 'start' }, paused: true },
      ),
    );
  });

  /* Citação */
  all('[data-reveal="quote"]').forEach((el) => {
    const q = el.querySelector('[data-slide]:not([hidden]) blockquote') ?? el.querySelector('blockquote');
    const who = el.querySelector('[data-slide]:not([hidden]) figcaption');
    const tl = gsap.timeline({ paused: true });
    if (q) tl.fromTo(q, { autoAlpha: 0, y: 24, filter: 'blur(6px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out', clearProps: 'filter' });
    if (who) tl.fromTo(who, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.5');
    trigger(el, tl);
  });

  /* Dados de contato */
  all('[data-reveal="info"]').forEach((el) => {
    trigger(el, gsap.fromTo(el.children, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.07, paused: true }));
  });

  /* Paralaxe sutil das fotos sobrepostas */
  all('[data-parallax]').forEach((el) => {
    const k = Number(el.dataset.parallax) || 0;
    gsap.fromTo(el, { yPercent: -k * 50 }, { yPercent: k * 50, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* Agendamento: o arco vinho sobe como uma porta */
  all('.ag__arch').forEach((el) => {
    if (window.innerWidth < 900) return;
    trigger(el, gsap.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'power3.inOut', paused: true, clearProps: 'clipPath' }));
  });

  // Fontes carregadas podem mudar quebras de linha: recalcula gatilhos.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
