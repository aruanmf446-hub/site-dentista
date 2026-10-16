/**
 * Estado da cena 3D. Tudo o que muda com a rolagem (ou com as abas e a
 * lista de especialidades) é um número aqui. A timeline do GSAP (modo
 * cinema) ou os controladores do modo empilhado escrevem nestes campos;
 * o palco (stage.ts) apenas os lê a cada quadro.
 */
export interface SceneState {
  /* câmera (graus e multiplicadores) */
  orbit: number; // azimute em torno do alvo; 0 = de frente
  elevation: number; // elevação; negativo = câmera abaixo do dente
  distance: number; // 1 = enquadramento da âncora; >1 recua
  /* dente */
  toothRotY: number;
  toothRotZ: number;
  toothRise: number; // deslocamento vertical (mundo)
  cut: number; // 0 = inteiro; 1 = quadrante removido (corte longitudinal)
  enamelLift: number; // mundo (0.105 ≈ 55 px do storyboard; 0.25 ≈ 130 px)
  enamelTilt: number; // graus
  enamelFade: number; // 0..1 esmaece o esmalte em direção ao fundo
  coreFade: number;
  pulpGlow: number; // 0..1 brilho interno da polpa
  /* arcada */
  arch: number; // 0 = enquadramento do dente; 1 = enquadramento da arcada
  archTeeth: number; // 0..1 onda de surgimento dos dentes ao redor
  rootClip: number; // 0..1 a raiz "entra" na gengiva
  spec: number; // índice (fracionário) da especialidade ativa
  /* ambiente */
  dark: number; // 0 = fundo claro; 1 = fundo vinho (cor de esmaecimento/sombra)
  shadow: number; // opacidade da sombra de contato
  idle: number; // 0..1 movimento ocioso (respira/gira devagar)
}

export const defaultState = (): SceneState => ({
  orbit: 0,
  elevation: 4,
  distance: 1,
  toothRotY: -22,
  toothRotZ: -9,
  toothRise: 0,
  cut: 0,
  enamelLift: 0,
  enamelTilt: 0,
  enamelFade: 0,
  coreFade: 0,
  pulpGlow: 0,
  arch: 0,
  archTeeth: 0,
  rootClip: 0,
  spec: 0,
  dark: 1,
  shadow: 1,
  idle: 1,
});

/** Retângulo (em px do canvas) onde o objeto deve aparecer. */
export interface FrameRect {
  cx: number;
  cy: number;
  h: number;
  /** largura opcional: quando presente, o enquadramento também respeita a largura */
  w?: number;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
