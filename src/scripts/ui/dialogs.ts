/**
 * Diálogos (<dialog> nativo: foco preso, Esc fecha, fundo inerte) e o
 * comportamento dos links de WhatsApp sem número direto.
 */
import { siteData } from './data';
import { waUrl } from '@/lib/whatsapp';

let lastTrigger: HTMLElement | null = null;

export function openDialog(name: string, trigger?: HTMLElement | null): HTMLDialogElement | null {
  const dlg = document.querySelector<HTMLDialogElement>(`dialog[data-dialog="${name}"]`);
  if (!dlg) return null;
  lastTrigger = trigger ?? (document.activeElement as HTMLElement | null);
  if (!dlg.open) dlg.showModal();
  return dlg;
}

export function showDemoNotice(mensagem: string, destino: string, trigger?: HTMLElement | null): void {
  const dlg = document.querySelector<HTMLDialogElement>('dialog[data-dialog="demo"]');
  if (!dlg) return;
  const msg = dlg.querySelector<HTMLElement>('[data-demo-msg]');
  const dest = dlg.querySelector<HTMLElement>('[data-demo-dest]');
  if (msg) msg.textContent = mensagem;
  if (dest) dest.textContent = destino ? `Destino configurado: WhatsApp — ${destino}.` : '';
  openDialog('demo', trigger);
}

/** Abre o WhatsApp de uma unidade (ou central) com a mensagem, respeitando o modo demonstração. */
export function openWhatsApp(unidadeId: string | null, mensagem: string, trigger?: HTMLElement | null): 'opened' | 'demo' | 'choose' {
  const data = siteData();
  const unidade = unidadeId ? data.unidades.find((u) => u.id === unidadeId) : null;
  const numero = unidade ? unidade.numero : data.central ?? (data.unidades.length === 1 ? data.unidades[0]!.numero : null);
  if (!numero) {
    if (!unidade && data.unidades.length > 1 && !data.central) {
      openDialog('unidade', trigger);
      return 'choose';
    }
    showDemoNotice(mensagem, unidade?.nome ?? data.marca, trigger);
    return 'demo';
  }
  const url = waUrl(numero, mensagem);
  const win = window.open(url, '_blank', 'noopener');
  if (!win) window.location.href = url;
  return 'opened';
}

export function initDialogs(): void {
  document.querySelectorAll<HTMLDialogElement>('dialog.dlg').forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      // clique no backdrop fecha
      if (e.target === dlg) dlg.close();
    });
    dlg.addEventListener('close', () => {
      lastTrigger?.focus?.();
      lastTrigger = null;
    });
  });
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const close = target.closest('[data-dialog-close]');
    if (close) {
      close.closest('dialog')?.close();
      return;
    }
    const link = target.closest<HTMLAnchorElement>('a[data-wa]');
    if (!link) return;
    const mode = link.dataset.wa;
    if (mode === 'direct') {
      // escolha dentro do seletor: fecha o diálogo depois de abrir a conversa
      link.closest('dialog')?.close();
      return;
    }
    e.preventDefault();
    const texto = link.dataset.waText || siteData().mensagemPadrao;
    if (mode === 'choose') openDialog('unidade', link);
    else if (mode === 'demo') {
      link.closest('dialog')?.close();
      showDemoNotice(texto, link.dataset.waUnidade || '', link);
    }
  });
}
