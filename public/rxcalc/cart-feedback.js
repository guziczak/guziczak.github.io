// Visual confirmation only. The cart has already been saved before this runs.
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PACKAGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m4 7 8-4 8 4v10l-8 4-8-4V7Zm0 0 8 4 8-4M12 11v10M8 5l8 4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

let activeCleanup = null;

function visibleBox(element, view) {
  if (!element?.isConnected) return null;
  const box = element.getBoundingClientRect();
  if (!box.width || !box.height) return null;
  const style = view.getComputedStyle(element);
  if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') return null;
  const viewport = view.visualViewport;
  const left = Math.max(box.left, viewport?.offsetLeft || 0);
  const top = Math.max(box.top, viewport?.offsetTop || 0);
  const right = Math.min(box.right, (viewport?.offsetLeft || 0) + (viewport?.width || view.innerWidth));
  const bottom = Math.min(box.bottom, (viewport?.offsetTop || 0) + (viewport?.height || view.innerHeight));
  return right - left > 2 && bottom - top > 2
    ? { x: (left + right) / 2, y: (top + bottom) / 2 }
    : null;
}

function findTarget(doc, view) {
  // Prefer the persistent header on mobile; the sidebar stays visible on desktop.
  for (const selector of ['.topbar [data-action="cart-open"]', '.sidebar [data-action="cart-open"]', '[data-action="cart-open"]']) {
    for (const element of doc.querySelectorAll(selector)) {
      if (visibleBox(element, view)) return element;
    }
  }
  return null;
}

export function cancelCartFeedback() {
  activeCleanup?.();
}

export function playCartFeedback({ source, updated = false } = {}) {
  cancelCartFeedback();
  if (!source?.isConnected) return;
  const doc = source.ownerDocument, view = doc.defaultView;
  if (!view) return;
  const reducedMotion = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const motion = !reducedMotion?.matches;
  const target = findTarget(doc, view);
  const badge = target?.querySelector('[data-cart-count]');
  const start = visibleBox(source.querySelector('svg'), view) || visibleBox(source, view);
  const end = visibleBox(badge, view) || visibleBox(target?.querySelector('svg'), view) || visibleBox(target, view);
  const confirmation = doc.createElement('span');
  confirmation.className = 'cart-button-confirmation';
  confirmation.setAttribute('aria-hidden', 'true');
  confirmation.innerHTML = CHECK + `<span>${updated ? 'Zapisano' : 'Dodano'}</span>`;
  source.classList.add('cart-feedback-active');
  source.append(confirmation);

  let stopped = false, ghost = null, observer = null, timeout = null;
  const animations = [];
  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    view.clearTimeout(timeout);
    observer?.disconnect();
    view.removeEventListener('scroll', cleanup, true);
    view.removeEventListener('resize', cleanup);
    view.removeEventListener('pagehide', cleanup);
    view.visualViewport?.removeEventListener('resize', cleanup);
    reducedMotion?.removeEventListener?.('change', cleanup);
    for (const animation of animations) animation.cancel();
    ghost?.remove();
    confirmation.remove();
    source.classList.remove('cart-feedback-active');
    target?.classList.remove('cart-feedback-arrived');
    if (activeCleanup === cleanup) activeCleanup = null;
  };
  activeCleanup = cleanup;
  const animate = (element, frames, options) => {
    if (!motion || !element?.animate) return null;
    try {
      const animation = element.animate(frames, options);
      // Cancellation is expected when the user continues editing or scrolling.
      animation.finished.catch(() => {});
      animations.push(animation);
      return animation;
    } catch { return null; }
  };
  const arrive = () => {
    if (stopped || !target?.isConnected) return;
    ghost?.remove();
    ghost = null;
    target.classList.add('cart-feedback-arrived');
    if (!updated) {
      animate(visibleBox(badge, view) ? badge : target.querySelector('svg'), [
        { transform: 'scale(1)' },
        { transform: 'scale(1.3)', offset: .35 },
        { transform: 'scale(.94)', offset: .7 },
        { transform: 'scale(1)' },
      ], { duration: 380, easing: 'cubic-bezier(.2,.8,.3,1)' });
    }
  };

  // A new render owns the button again; never restore or overwrite its content.
  if (view.MutationObserver) {
    observer = new view.MutationObserver(() => {
      if (!source.isConnected || !source.contains(confirmation) || source.disabled || (target && !target.isConnected)) cleanup();
    });
    observer.observe(doc.getElementById('app') || doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  }
  view.addEventListener('scroll', cleanup, { capture: true, passive: true });
  view.addEventListener('resize', cleanup, { passive: true });
  view.addEventListener('pagehide', cleanup, { once: true });
  view.visualViewport?.addEventListener('resize', cleanup, { passive: true });
  reducedMotion?.addEventListener?.('change', cleanup, { once: true });
  timeout = view.setTimeout(cleanup, 1600);

  if (!motion || updated || !start || !end) { arrive(); return; }
  ghost = doc.createElement('span');
  ghost.className = 'cart-flight';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.innerHTML = PACKAGE + '<span>+1</span>';
  ghost.style.left = `${start.x - 28}px`;
  ghost.style.top = `${start.y - 18}px`;
  doc.body.append(ghost);

  const dx = end.x - start.x, dy = end.y - start.y;
  const direction = dx < 0 ? -1 : 1;
  const viewport = view.visualViewport;
  const left = (viewport?.offsetLeft || 0) + 30;
  const right = left + (viewport?.width || view.innerWidth) - 60;
  const controlX = Math.max(left, Math.min(right, start.x + dx * .25 + direction * Math.min(100, Math.abs(dy) * .2 + 24)));
  const controlY = start.y + dy * .35 - 35;
  const frames = [0, .16, .5, .82, 1].map(t => ({
    offset: t,
    transform: `translate(${2 * (1 - t) * t * (controlX - start.x) + t * t * dx}px, ${2 * (1 - t) * t * (controlY - start.y) + t * t * dy}px) scale(${1 - .72 * t}) rotate(${-8 * (1 - t)}deg)`,
    opacity: t === 0 || t === 1 ? 0 : 1,
  }));
  const flight = animate(ghost, frames, { duration: 620, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
  if (flight) flight.finished.then(arrive, () => {});
  else arrive();
}
