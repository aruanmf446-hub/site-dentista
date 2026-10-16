/**
 * Abas acessíveis (padrão WAI-ARIA: setas, Home/End, ativação automática).
 * Markup: [data-tabs] > [role=tablist] > [role=tab][aria-controls] e
 * [role=tabpanel]. Sem JS, todos os painéis ficam visíveis (fallback estático).
 */
export function initTabs(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-tabs]').forEach((wrap) => {
    if (wrap.dataset.tabsReady) return;
    wrap.dataset.tabsReady = '1';
    const tabs = Array.from(wrap.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls') || ''));
    wrap.classList.add('tabs-ready');

    const select = (i: number, focus = false) => {
      tabs.forEach((t, j) => {
        const on = i === j;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const p = panels[j];
        if (p) {
          p.hidden = !on;
          if (on) p.classList.remove('is-entering'), void p.offsetWidth, p.classList.add('is-entering');
        }
      });
      if (focus) tabs[i]?.focus();
      wrap.dispatchEvent(new CustomEvent('tabchange', { detail: { index: i, id: tabs[i]?.dataset.tab } }));
    };

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', (e) => {
        const n = tabs.length;
        let next = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % n;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + n) % n;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = n - 1;
        if (next >= 0) {
          e.preventDefault();
          select(next, true);
        }
      });
    });
    const initial = Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'));
    select(initial);
  });
}
