/**
 * Formulários de solicitação de horário (sem backend).
 * Valida, monta uma mensagem organizada e abre o WhatsApp da unidade
 * escolhida. Nada é armazenado ou enviado a servidores do site, e a
 * interface nunca afirma que o agendamento foi confirmado.
 */
import { buildMensagem, waUrl } from '@/lib/whatsapp';
import { siteData } from './data';
import { openDialog, showDemoNotice } from './dialogs';

type Field = HTMLInputElement | HTMLSelectElement;

function value(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  if (!el) return '';
  if (el instanceof RadioNodeList) return el.value;
  return (el as Field).value?.trim() ?? '';
}

function setError(form: HTMLFormElement, name: string, msg: string | null): void {
  const box = form.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
  const fields = Array.from(form.querySelectorAll<Field>(`[name="${name}"]`));
  fields.forEach((f) => {
    if (msg) f.setAttribute('aria-invalid', 'true');
    else f.removeAttribute('aria-invalid');
  });
  if (box) {
    box.textContent = msg ?? '';
    box.hidden = !msg;
  }
  form.querySelector(`[data-field="${name}"]`)?.classList.toggle('has-error', !!msg);
}

function validate(form: HTMLFormElement): string[] {
  const invalid: string[] = [];
  const has = (n: string) => !!form.querySelector(`[name="${n}"]`);
  if (has('nome')) {
    const nome = value(form, 'nome');
    const msg = !nome ? 'Informe seu nome.' : nome.length < 2 || /^\d+$/.test(nome) ? 'Digite um nome válido.' : null;
    setError(form, 'nome', msg);
    if (msg) invalid.push('nome');
  }
  if (has('unidade')) {
    const req = form.querySelector('[name="unidade"][required]');
    const msg = req && !value(form, 'unidade') ? 'Escolha a unidade.' : null;
    setError(form, 'unidade', msg);
    if (msg) invalid.push('unidade');
  }
  if (has('periodo')) {
    const req = form.querySelector('[name="periodo"][required]');
    const msg = req && !value(form, 'periodo') ? 'Escolha um período.' : null;
    setError(form, 'periodo', msg);
    if (msg) invalid.push('periodo');
  }
  const consent = form.querySelector<HTMLInputElement>('[name="consentimento"]');
  if (consent) {
    const msg = consent.checked ? null : 'Para continuar, autorize o contato sobre este agendamento.';
    setError(form, 'consentimento', msg);
    if (msg) invalid.push('consentimento');
  }
  return invalid;
}

function handleSubmit(form: HTMLFormElement, e: SubmitEvent): void {
  e.preventDefault();
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const invalid = validate(form);
  if (invalid.length) {
    if (status) {
      status.dataset.state = 'error';
      status.textContent =
        invalid.length === 1 ? 'Revise o campo destacado.' : `Revise os ${invalid.length} campos destacados.`;
    }
    form.querySelector<HTMLElement>(`[name="${invalid[0]}"]`)?.focus();
    return;
  }
  const data = siteData();
  const unidadeId = value(form, 'unidade') || (data.unidades.length === 1 ? data.unidades[0]!.id : '');
  const unidade = data.unidades.find((u) => u.id === unidadeId) ?? null;
  const mensagem = buildMensagem({
    nome: value(form, 'nome') || undefined,
    unidade: data.unidades.length > 1 ? unidade?.nome : undefined,
    motivo: value(form, 'motivo') || undefined,
    periodo: value(form, 'periodo') || undefined,
    tratamento: form.dataset.tratamento || undefined,
  });
  const numero = unidade?.numero ?? data.central;

  if (!numero && !unidade && data.unidades.length > 1) {
    openDialog('unidade', form.querySelector('button[type="submit"]'));
    return;
  }

  const success = form.closest('[data-form-wrap]')?.querySelector<HTMLElement>('[data-form-success]');
  const destino = unidade ? `Unidade ${unidade.nome}`.replace(/^Unidade Unidade/, 'Unidade') : data.marca;

  if (!numero) {
    // Demonstração: mostra a mensagem que seria enviada.
    if (status) {
      status.dataset.state = 'ok';
      status.textContent = 'Mensagem preparada (demonstração).';
    }
    showDemoNotice(mensagem, destino, form.querySelector('button[type="submit"]'));
    return;
  }

  const url = waUrl(numero, mensagem);
  const win = window.open(url, '_blank', 'noopener');
  if (success) {
    const link = success.querySelector<HTMLAnchorElement>('[data-success-link]');
    const dest = success.querySelector<HTMLElement>('[data-success-dest]');
    const preview = success.querySelector<HTMLElement>('[data-success-msg]');
    if (link) link.href = url;
    if (dest) dest.textContent = destino;
    if (preview) preview.textContent = mensagem;
    form.hidden = true;
    success.hidden = false;
    success.querySelector<HTMLElement>('[data-success-title]')?.focus();
  } else if (status) {
    status.dataset.state = 'ok';
    status.textContent = win ? `Abrimos o WhatsApp (${destino}) em uma nova aba.` : '';
    if (!win) window.location.href = url;
  }
}

export function initForms(): void {
  document.querySelectorAll<HTMLFormElement>('form[data-wa-form]').forEach((form) => {
    form.noValidate = true;
    form.addEventListener('submit', (e) => handleSubmit(form, e as SubmitEvent));
    // limpa o erro ao corrigir
    form.addEventListener('input', (e) => {
      const t = e.target as Field;
      if (t.name && t.getAttribute('aria-invalid')) setError(form, t.name, null);
    });
    form.addEventListener('change', (e) => {
      const t = e.target as Field;
      if (t.name && form.querySelector(`[data-field="${t.name}"].has-error`)) setError(form, t.name, null);
    });
  });
  document.querySelectorAll<HTMLElement>('[data-form-reset]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const wrap = btn.closest('[data-form-wrap]');
      const form = wrap?.querySelector<HTMLFormElement>('form[data-wa-form]');
      const success = wrap?.querySelector<HTMLElement>('[data-form-success]');
      if (form && success) {
        success.hidden = true;
        form.hidden = false;
        form.querySelector<HTMLElement>('input, select')?.focus();
      }
    }),
  );
}
