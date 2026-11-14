/** Animate the catalogue presentation only; data and selection stay with the caller. */
export function createCatalogueMotion(doc = document) {
  const win = doc.defaultView;
  let active = null;

  function clean(run) {
    if (run.cleaned) return;
    run.cleaned = true;
    for (const [node, name] of run.names) node.style.viewTransitionName = name;
    if (active === run) {
      doc.documentElement.classList.remove('catalogue-transition');
      active = null;
    }
  }

  function cancel() {
    const run = active;
    if (!run || run.updating) return;
    run.cancelled = true;
    run.transition?.skipTransition();
    run.animation?.cancel();
    clean(run);
  }

  function change(update, trigger) {
    cancel();
    const restoreFocus = () => doc.querySelector('[data-action="browse-catalogue"]')?.focus({ preventScroll:true });
    if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const focused = doc.activeElement === trigger;
      update();
      if (focused) restoreFocus();
      return;
    }

    const run = { names:new Map(), keys:new Map(), updating:false, applied:false, cancelled:false, cleaned:false };
    active = run;
    doc.documentElement.classList.add('catalogue-transition');

    function nameParts() {
      const seen = new Set();
      function name(node, suffix) {
        if (!node || !node.getClientRects().length || seen.has(suffix)) return;
        seen.add(suffix);
        if (!run.names.has(node)) run.names.set(node, node.style.viewTransitionName);
        node.style.viewTransitionName = `rx-catalogue-${suffix}`;
      }
      for (const [suffix, selector] of Object.entries({
        panel:'.product-panel', heading:'.product-panel>.section-heading',
        summary:'.product-summary', search:'.picker-toolbar .search-wrap', filter:'.filter-toggle',
        filters:'.picker-filters', label:'#catalogue-heading', favorites:'#favorites-inline>.catalogue-heading',
        more:'#catalogue-more', custom:'.product-panel>.custom-trigger', variants:'.product-panel>.form-selection',
        notice:'.product-panel>.catalogue-notice', result:'.result-column', footer:'.page-footer',
      })) name(doc.querySelector(selector), suffix);
      doc.querySelectorAll('.left-stack>:not(.product-panel)').forEach((node, index) => name(node, `detail-${index}`));
      doc.querySelectorAll('#drug-list .drug-card, .favorite-shortcuts [data-value]').forEach(node => {
        const key = `${node.dataset.action === 'product' ? 'product' : 'drug'}:${node.dataset.value}`;
        if (!run.keys.has(key)) run.keys.set(key, run.keys.size);
        name(node, `item-${run.keys.get(key)}`);
      });
    }

    function apply() {
      // skipTransition still invokes its callback. A later search/render must win.
      if (run.cancelled || run.applied) return;
      const focused = doc.activeElement === trigger;
      run.applied = true;
      run.updating = true;
      try {
        update();
        if (focused) restoreFocus();
        if (run.transition) nameParts();
      } finally {
        run.updating = false;
      }
    }

    if (typeof doc.startViewTransition === 'function') {
      nameParts();
      try {
        run.transition = doc.startViewTransition(apply);
        run.transition.ready.catch(() => {});
        run.transition.finished.then(() => clean(run), () => clean(run));
        return;
      } catch {
        // A restricted/older browser must still perform the requested update.
        for (const [node, name] of run.names) node.style.viewTransitionName = name;
        run.names.clear();
      }
    }

    apply();
    const panel = doc.querySelector('.product-panel');
    if (panel?.animate) {
      run.animation = panel.animate([{ opacity:.75 }, { opacity:1 }], { duration:160, easing:'ease-out' });
      run.animation.finished.then(() => clean(run), () => clean(run));
    } else clean(run);
  }

  return { change, cancel };
}
