/**
 * Schema e validação de clientes (sem navegador).
 */
import { test, expect } from '@playwright/test';
import { clinicSchema } from '../../src/config/clinic.schema';
import { validateClinic } from '../../src/lib/validate';
import { findPlaceholders } from '../../src/lib/placeholders';
import { buildTheme, contrast } from '../../src/lib/theme';
import { buildMensagem, normalizeNumber } from '../../src/lib/whatsapp';
import demo from '../../src/clients/alva-demo/clinic';
import producao from '../fixtures/clients/teste-producao/clinic';
import modelo from '../../src/clients/_modelo/clinic';

const parse = (x: unknown) => clinicSchema.parse(x);

test.describe('configuração de clientes', () => {
  test('demonstração é válida e marca os placeholders', () => {
    const c = parse(demo);
    const r = validateClinic(c);
    expect(r.errors).toEqual([]);
    expect(findPlaceholders(c).length).toBeGreaterThan(20);
    expect(c.secoes.valores).toBe(true); // ligado explicitamente na demonstração
  });

  test('modelo de nova clínica é válido em demonstração e bloqueado em produção', () => {
    expect(validateClinic(parse(modelo)).errors).toEqual([]);
    const prod = validateClinic(parse({ ...structuredClone(modelo), site: { ...modelo.site, modo: 'producao' } }));
    expect(prod.errors.join('\n')).toMatch(/placeholders/);
    expect(prod.errors.join('\n')).toMatch(/provisória/);
  });

  test('módulo Valores vem desligado por padrão', () => {
    const c = structuredClone(demo) as any;
    delete c.secoes;
    expect(parse(c).secoes.valores).toBe(false);
  });

  test('produção sem placeholders passa', () => {
    const r = validateClinic(parse(producao));
    expect(r.errors).toEqual([]);
  });

  test('produção com placeholders é bloqueada', () => {
    const c = parse({ ...structuredClone(demo), site: { ...demo.site, modo: 'producao' } });
    const r = validateClinic(c);
    expect(r.errors.join('\n')).toMatch(/placeholders/);
    expect(r.errors.join('\n')).toMatch(/WhatsApp/);
  });

  test('produção exige consentimento dos depoimentos e revisão de preços', () => {
    const base = structuredClone(producao) as any;
    base.depoimentos = [{ texto: 'Ótimo atendimento.', autor: 'M. S.', fonte: 'Avaliação no Google', consentimento: false }];
    base.secoes = { ...base.secoes, depoimentos: true, valores: true };
    base.valores = { titulo: 'Valores', revisadoPeloResponsavel: false, itens: [{ item: 'Consulta', valor: 'R$ 100' }] };
    const r = validateClinic(parse(base));
    expect(r.errors.some((e) => e.includes('consentimento'))).toBe(true);
    expect(r.errors.some((e) => e.includes('Código de Ética'))).toBe(true);
  });

  test('referências inválidas e slugs repetidos são apontados', () => {
    const c = structuredClone(demo) as any;
    c.equipe[0].unidades = ['nao-existe'];
    c.tratamentos.push({ ...c.tratamentos[0] });
    const r = validateClinic(parse(c));
    expect(r.errors.some((e) => e.includes('nao-existe'))).toBe(true);
    expect(r.errors.some((e) => e.includes('repetidos'))).toBe(true);
  });

  test('schema rejeita cor inválida, slug inválido e tratamento sem conteúdo', () => {
    const c1 = structuredClone(demo) as any;
    c1.marca.cores.primaria = 'vinho';
    expect(clinicSchema.safeParse(c1).success).toBe(false);
    const c2 = structuredClone(demo) as any;
    c2.tratamentos[0].slug = 'Limpeza Dental';
    expect(clinicSchema.safeParse(c2).success).toBe(false);
    const c3 = structuredClone(demo) as any;
    c3.tratamentos[0].descricao = [];
    expect(clinicSchema.safeParse(c3).success).toBe(false);
    const c4 = structuredClone(demo) as any;
    c4.tratamentos = [];
    expect(clinicSchema.safeParse(c4).success).toBe(false);
  });

  test('aceita um único tratamento', () => {
    const c = structuredClone(demo) as any;
    c.tratamentos = [{ ...c.tratamentos[1], especialidade: undefined }];
    expect(validateClinic(parse(c)).errors).toEqual([]);
  });

  test('tema derivado mantém contraste AA nas cores do design', () => {
    for (const cor of ['#5B1626', '#7A2438', '#2F3B52', '#3F5A4C']) {
      const t = buildTheme(cor);
      expect(t.warnings).toEqual([]);
      expect(contrast(t.vars['--c-on-primary-muted']!, cor)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.vars['--c-on-primary-soft']!, cor)).toBeGreaterThanOrEqual(4.5);
    }
    expect(buildTheme('#E8B4BC').warnings.length).toBeGreaterThan(0);
  });

  test('mensagem de WhatsApp é organizada e não confirma horário', () => {
    const m = buildMensagem({ nome: 'Ana', unidade: 'Centro', motivo: 'Limpeza', periodo: 'Manhã' });
    expect(m).toContain('Meu nome é Ana');
    expect(m).toContain('• Unidade: Centro');
    expect(m).toContain('• Período de preferência: Manhã');
    expect(m.toLowerCase()).not.toContain('confirmad');
    expect(normalizeNumber('[WhatsApp]')).toBeNull();
    expect(normalizeNumber('+55 (11) 99999-0000')).toBe('5511999990000');
  });
});
