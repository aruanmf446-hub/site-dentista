/**
 * Textos anatômicos neutros usados na cena de tratamentos (legendas do
 * quadro B e abas do mobile). Eles apenas NOMEIAM estruturas — não indicam
 * tratamentos nem sugerem diagnóstico. Fazem parte do template, não do cliente.
 */
export const CAMADAS = [
  {
    id: 'esmalte',
    nome: 'Esmalte',
    texto: 'Camada externa, a mais dura do corpo. Protege o dente no contato com alimentos e na mastigação.',
  },
  {
    id: 'dentina-polpa',
    nome: 'Dentina e polpa',
    texto: 'A dentina sustenta o esmalte e protege a polpa, onde ficam os nervos e vasos que nutrem o dente.',
  },
  {
    id: 'raiz',
    nome: 'Raiz',
    texto: 'Fica abaixo da gengiva e fixa o dente ao osso.',
  },
] as const;

/** Legendas do quadro B, de cima para baixo (âncoras 3D em scripts/three/anchors.ts). */
export const LEGENDAS = [
  { id: 'esmalte', nome: 'Esmalte', texto: 'Camada externa, a mais dura do corpo.' },
  { id: 'polpa', nome: 'Polpa', texto: 'Nervos e vasos que nutrem o dente.' },
  { id: 'dentina', nome: 'Dentina', texto: 'Sustenta o esmalte e protege a polpa.' },
  { id: 'raiz', nome: 'Raiz', texto: 'Fixa o dente ao osso.' },
] as const;
