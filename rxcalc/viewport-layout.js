/** Keep viewport measurements current without taking over ordinary page scrolling. */
export function createViewportLayout(win = window) {
  const doc = win.document, viewport = win.visualViewport;
  const listeners = [];
  let header = null, observer = null, frame = 0, destroyed = false;
  let interacted = false, startRequested = false, startUntil = 0, startTimer = 0;
  let keyboardOpen = false, keyboardField = null, repair = null, repairTimer = 0;
  const now = () => win.performance?.now() ?? Date.now();
  const listen = (target, event, callback, options) => {
    target?.addEventListener(event, callback, options);
    listeners.push(() => target?.removeEventListener(event, callback, options));
  };
  const editable = node => !!node && !node.disabled && !node.readOnly && (
    node.tagName === 'TEXTAREA' || node.isContentEditable ||
    node.tagName === 'INPUT' && /^(text|search|email|url|tel|password|number)$/.test(node.type)
  );
  const remember = node => editable(node) ? { node, id:node.id } : null;
  const resolve = field => field?.node?.isConnected ? field.node : field?.id ? doc.getElementById(field.id) : null;

  function canAdjust() {
    if (win.scrollY < 0 || viewport && (viewport.offsetTop < 0 || Math.abs(viewport.scale - 1) > 0.05)) return false;
    try { return !doc.querySelector('dialog:modal'); }
    catch { return !doc.querySelector('dialog[open]'); }
  }

  function cancelStart() {
    startUntil = 0;
    if (startTimer) win.clearTimeout(startTimer);
    startTimer = 0;
  }

  function cancelRepair() {
    repair = null;
    if (repairTimer) win.clearTimeout(repairTimer);
    repairTimer = 0;
  }

  function revealCoveredField() {
    const field = editable(doc.activeElement) ? doc.activeElement : resolve(repair?.field);
    if (!field || !field.isConnected || !header || !canAdjust()) return;
    const bounds = field.getBoundingClientRect(), bar = header.getBoundingClientRect();
    const top = viewport?.offsetTop || 0;
    const bottom = top + (viewport?.height ?? win.innerHeight);
    const visibleTop = Math.max(top, bar.bottom) + 12;
    // Only repair an input that still intersects the visible top edge. An old
    // input far above/below the viewport must never pull the reader back to it.
    if (bounds.height <= 0 || bounds.width <= 0 || bounds.bottom <= top ||
        bounds.top >= visibleTop || bounds.top >= bottom || visibleTop >= bottom) return;
    const position = Math.max(0, win.scrollY + bounds.top - visibleTop);
    if (Math.abs(position - win.scrollY) > 0.5) win.scrollTo({ top:position, behavior:'auto' });
  }

  function measure() {
    frame = 0;
    if (destroyed) return;
    if (header?.isConnected) {
      const height = header.getBoundingClientRect().height;
      if (Number.isFinite(height) && height > 0) {
        const value = `${Math.round(height * 100) / 100}px`;
        if (doc.documentElement.style.getPropertyValue('--pinned-header-offset') !== value) {
          doc.documentElement.style.setProperty('--pinned-header-offset', value);
        }
      }
    }
    if (startUntil && now() < startUntil && canAdjust() && win.scrollY > 0.5) {
      win.scrollTo({ top:0, behavior:'auto' });
    }
    if (repair?.requested) {
      repair.requested = false;
      revealCoveredField();
      if (repair?.final) cancelRepair();
    }
  }

  function schedule() {
    if (!destroyed && !frame) frame = win.requestAnimationFrame(measure);
  }

  function refresh() {
    if (destroyed) return;
    const next = doc.querySelector('.topbar');
    if (next !== header) {
      observer?.disconnect();
      header = next;
      if (header && win.ResizeObserver) {
        observer = new win.ResizeObserver(schedule);
        observer.observe(header);
      }
    }
    schedule();
  }

  function showStart() {
    if (destroyed) return;
    cancelStart(); cancelRepair();
    startRequested = true;
    startUntil = now() + 600;
    if (canAdjust() && win.scrollY > 0.5) win.scrollTo({ top:0, behavior:'auto' });
    startTimer = win.setTimeout(cancelStart, 600);
    refresh();
  }

  function keyboardChanged(open) {
    if (destroyed || open === keyboardOpen) return;
    keyboardOpen = open;
    cancelRepair();
    if (open) {
      cancelStart();
      keyboardField = remember(doc.activeElement);
      return;
    }
    repair = { field:remember(doc.activeElement) || keyboardField, requested:true, final:false };
    keyboardField = null;
    schedule();
    // The header returns with a 180 ms CSS transition. Recheck once it settles.
    repairTimer = win.setTimeout(() => {
      repairTimer = 0;
      if (!repair) return;
      repair.requested = true; repair.final = true; schedule();
    }, 200);
  }

  const onInteraction = () => { interacted = true; cancelStart(); cancelRepair(); };
  for (const type of ['pointerdown', 'touchstart', 'wheel', 'keydown']) {
    listen(win, type, onInteraction, { capture:true, passive:true });
  }
  listen(win, 'resize', schedule, { passive:true });
  listen(viewport, 'resize', schedule, { passive:true });
  listen(viewport, 'scroll', schedule, { passive:true });
  // Browser restoration can happen after the initial render. Only an explicit
  // start request gets this brief correction window; normal scrolling is free.
  listen(win, 'scroll', () => { if (startUntil) schedule(); }, { passive:true });
  listen(win, 'pageshow', event => {
    if (event.persisted) { cancelStart(); cancelRepair(); }
    else if (startRequested && !interacted) showStart();
    refresh();
  });

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelStart(); cancelRepair();
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    observer?.disconnect();
    for (const remove of listeners) remove();
  }

  return { refresh, showStart, keyboardChanged, destroy };
}
