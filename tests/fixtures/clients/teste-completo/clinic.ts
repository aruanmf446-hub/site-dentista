import { variant, FAKE_WA } from '../_base';
import fotoA from './fotos/teste-a.jpg';
import fotoB from './fotos/teste-b.jpg';
/** Todas as seções opcionais ligadas, com os dados de demonstração. */
export default variant((c) => {
  c.unidades = c.unidades.map((u, i) => ({ ...u, whatsapp: FAKE_WA[i] }));
  // imagens geradas (não são fotos reais) para exercitar a otimização de imagens
  c.sobre!.fotos = [
    { src: fotoA, alt: 'Imagem de teste A', legenda: 'Imagem de teste A', posicao: '50% 40%' },
    { src: fotoB, alt: 'Imagem de teste B', legenda: 'Imagem de teste B' },
  ];
  c.equipe![0]!.foto = { src: fotoB, alt: 'Imagem de teste' };
  c.secoes = {
    tratamentos: true,
    especialidades: true,
    sobre: true,
    equipe: true,
    unidades: true,
    convenios: true,
    valores: true,
    depoimentos: true,
    galeria: true,
    faq: true,
  };
});
