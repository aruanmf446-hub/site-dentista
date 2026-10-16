/**
 * Formulários e WhatsApp: validação, roteamento por unidade, mensagem,
 * estados de sucesso/erro e modo demonstração.
 */
import { test, expect, type Page } from '@playwright/test';
import { url, trackErrors } from '../helpers';

/** Intercepta window.open e devolve as URLs abertas. */
async function captureOpen(page: Page) {
  await page.addInitScript(() => {
    (window as any).__opened = [];
    window.open = ((u: string) => {
      (window as any).__opened.push(String(u));
      return { closed: false } as Window;
    }) as typeof window.open;
  });
}
const opened = (page: Page) => page.evaluate(() => (window as any).__opened as string[]);

test('agendamento: valida, monta a mensagem e abre o WhatsApp da unidade escolhida', async ({ page }) => {
  await captureOpen(page);
  const errors = trackErrors(page);
  await page.goto(url('teste-tres-unidades', '/contato/'));
  const form = page.locator('form[data-wa-form="full"]');
  await form.locator('button[type="submit"]').click();
  await expect(form.locator('[data-error-for="nome"]')).toHaveText('Informe seu nome.');
  await expect(form.locator('[data-error-for="consentimento"]')).toBeVisible();
  await expect(form.locator('input[name="nome"]')).toHaveAttribute('aria-invalid', 'true');
  await expect(form.locator('[data-form-status]')).toContainText('Revise os 2 campos');
  await expect(form.locator('input[name="nome"]')).toBeFocused();

  await form.locator('input[name="nome"]').fill('Paciente Teste');
  await form.locator('label.bf__unit', { hasText: 'Jardins' }).click();
  await form.locator('select[name="motivo"]').selectOption('Limpeza');
  await form.locator('label.bf__pill', { hasText: 'Tarde' }).click();
  await form.locator('input[name="consentimento"]').check();
  await form.locator('button[type="submit"]').click();

  const urls = await opened(page);
  expect(urls).toHaveLength(1);
  const u = new URL(urls[0]!);
  expect(u.host).toBe('wa.me');
  expect(u.pathname).toBe('/5500000000002'); // WhatsApp da unidade Jardins
  const msg = u.searchParams.get('text')!;
  expect(msg).toContain('Meu nome é Paciente Teste');
  expect(msg).toContain('• Unidade: Jardins');
  expect(msg).toContain('• Interesse: Limpeza');
  expect(msg).toContain('• Período de preferência: Tarde');
  const ok = page.locator('[data-form-success]').first();
  await expect(ok).toBeVisible();
  await expect(ok).toContainText('não está confirmado');
  await expect(ok.locator('[data-success-link]')).toHaveAttribute('href', urls[0]!);
  await ok.locator('[data-form-reset]').click();
  await expect(form).toBeVisible();
  expect(errors).toEqual([]);
});

test('clínica com uma unidade: sem seletor de unidade, WhatsApp central direto', async ({ page }) => {
  await captureOpen(page);
  await page.goto(url('teste-unidade-unica', '/'));
  await expect(page.locator('select[name="unidade"]')).toHaveCount(0);
  await expect(page.locator('input[name="unidade"]')).toHaveCount(0);
  await expect(page.locator('#unid-title')).toContainText('Onde estamos');
  const wa = page.locator('a[data-wa-float]');
  await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/5500000000001\?text=/);
  await expect(wa).toHaveAttribute('target', '_blank');
  // agendamento rápido do hero não pede unidade e não mostra horários
  const quick = page.locator('form[data-wa-form="quick"]');
  await expect(quick.locator('button[type="submit"]')).toHaveText('Solicitar horário');
  await quick.locator('select[name="periodo"]').selectOption('Noite');
  await quick.locator('button[type="submit"]').click();
  const u = new URL((await opened(page))[0]!);
  expect(u.pathname).toBe('/5500000000001');
  expect(u.searchParams.get('text')).toContain('Período de preferência: Noite');
  expect(u.searchParams.get('text')).not.toContain('Unidade');
});

test('várias unidades sem número central: escolha a unidade antes do WhatsApp', async ({ page }) => {
  await captureOpen(page);
  await page.goto(url('teste-tres-unidades', '/'));
  await page.locator('a[data-wa-float]').click();
  const dlg = page.locator('dialog[data-dialog="unidade"]');
  await expect(dlg).toBeVisible();
  const choices = dlg.locator('a[data-unit-choice]');
  await expect(choices).toHaveCount(3);
  await expect(choices.nth(2)).toHaveAttribute('href', /wa\.me\/5500000000003/);
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  await expect(page.locator('a[data-wa-float]')).toBeFocused();
  // cada linha da seção de unidades usa o WhatsApp da própria unidade
  const rowsWa = page.locator('#unidades a[data-wa="direct"]');
  await expect(rowsWa).toHaveCount(3);
  await expect(rowsWa.nth(1)).toHaveAttribute('href', /5500000000002/);
  await expect(page.locator('#unidades a', { hasText: 'Como chegar' })).toHaveCount(3);
});

test('demonstração: número placeholder abre aviso com a mensagem, nunca um número inventado', async ({ page }) => {
  await captureOpen(page);
  await page.goto(url('alva-demo', '/contato/'));
  const form = page.locator('form[data-wa-form="full"]');
  await form.locator('input[name="nome"]').fill('Visitante');
  await form.locator('input[name="consentimento"]').check();
  await form.locator('button[type="submit"]').click();
  const dlg = page.locator('dialog[data-dialog="demo"]');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('[data-demo-msg]')).toContainText('Meu nome é Visitante');
  expect(await opened(page)).toEqual([]);
  await dlg.getByRole('button', { name: 'Entendi' }).click();
  await expect(dlg).toBeHidden();
  const hrefs = await page.$$eval('a[href*="wa.me"]', (as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs).toEqual([]);
});

test('página de tratamento pré-seleciona o interesse e cita o tratamento', async ({ page }) => {
  await captureOpen(page);
  await page.goto(url('teste-unidade-unica', '/tratamentos/clareamento/'));
  const form = page.locator('form[data-wa-form="full"]');
  await expect(form.locator('select[name="motivo"]')).toHaveValue('Clareamento');
  await form.locator('input[name="nome"]').fill('Ana');
  await form.locator('input[name="consentimento"]').check();
  await form.locator('button[type="submit"]').click();
  const text = new URL((await opened(page))[0]!).searchParams.get('text')!;
  expect(text).toContain('solicitar um horário para Clareamento');
});
