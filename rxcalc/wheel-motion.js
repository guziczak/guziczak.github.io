/** Motion only: these helpers never write a patient value or select a treatment. */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function nearestWheelPosition(position, max, rowHeight = 44) {
  const end = Math.max(0, Math.floor((max + 0.01) / rowHeight) * rowHeight);
  return clamp(Math.round(position / rowHeight) * rowHeight, 0, end);
}

/** Samples use milliseconds and scroll coordinates, so direction matches scrollTop. */
export function wheelReleaseVelocity(samples, releasedAt, { minDistance = 0 } = {}) {
  const last = samples.at(-1);
  if (!last) return 0;
  const idle = Math.max(0, releasedAt - last.time);
  if (idle >= 80) return 0;
  const recent = samples.filter(sample => sample.time >= last.time - 100);
  let first = last, direction = 0;
  // A correction reverses the user's intent. Do not average it with the earlier
  // movement and send the wheel spinning back in the old direction.
  for (let index = recent.length - 2; index >= 0; index--) {
    const sample = recent[index];
    const nextDirection = Math.sign(first.position - sample.position);
    if (direction && nextDirection && nextDirection !== direction) break;
    if (nextDirection) direction = nextDirection;
    first = sample;
  }
  const distance = last.position - first.position, elapsed = last.time - first.time;
  if (elapsed < 8 || Math.abs(distance) < minDistance) return 0;
  return clamp(distance / elapsed, -3.2, 3.2) * (1 - idle / 80);
}

export function planWheelCoast({ position, velocity = 0, max, rowHeight = 44, reducedMotion = false }) {
  const from = clamp(position, 0, max);
  const speed = clamp(velocity, -3.2, 3.2);
  // Fine adjustments settle nearby. Blend into momentum only for a deliberate
  // flick, without a sudden jump to a multi-row minimum coast.
  const ramp = reducedMotion ? 0 : clamp((Math.abs(speed) - 0.45) / 0.55, 0, 1);
  const fling = ramp > 0;
  const travel = fling ? clamp(speed * 380 * ramp * ramp * (3 - 2 * ramp), -26 * rowHeight, 26 * rowHeight) : 0;
  const to = nearestWheelPosition(from + travel, max, rowHeight);
  const distance = Math.abs(to - from);
  const duration = reducedMotion || distance < 0.1 ? 0
    : !fling || distance < rowHeight * 0.6 ? 160
    : clamp(3 * distance / Math.abs(speed), 500, 1400);
  return { from, to, duration };
}

/** Time-based ease-out is identical at 60Hz and 120Hz and lands exactly on a row. */
export function wheelPositionAt(plan, elapsed) {
  if (!plan.duration || elapsed >= plan.duration) return plan.to;
  const progress = clamp(elapsed / plan.duration, 0, 1);
  return plan.from + (plan.to - plan.from) * (1 - (1 - progress) ** 3);
}

export function createWheelMotion(node, { rowHeight = 44 } = {}) {
  const win = node.ownerDocument.defaultView;
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const options = { signal:controller.signal };
  const now = () => win.performance.now();
  const max = () => Math.max(0, node.scrollHeight - node.clientHeight);
  let frame = 0, settling = 0, animation = null, drag = null, destroyed = false, suppressUntil = 0;

  function cancelAnimation() {
    if (frame) win.cancelAnimationFrame(frame);
    if (settling) win.clearTimeout(settling);
    frame = 0; settling = 0; animation = null;
  }
  function releaseDrag() {
    const pointer = drag?.id;
    drag = null;
    if (pointer != null && node.hasPointerCapture?.(pointer)) node.releasePointerCapture(pointer);
  }
  function stop() {
    cancelAnimation();
    releaseDrag();
  }
  function finish() {
    stop();
    if (!destroyed) node.scrollTop = nearestWheelPosition(node.scrollTop, max(), rowHeight);
  }
  function setIndex(index) {
    stop();
    if (!destroyed) node.scrollTop = nearestWheelPosition(index * rowHeight, max(), rowHeight);
  }
  function animate(plan) {
    cancelAnimation();
    if (destroyed) return;
    if (!plan.duration) { node.scrollTop = plan.to; return; }
    const job = { plan, start:now() };
    animation = job;
    const step = time => {
      if (destroyed || animation !== job) return;
      const elapsed = time - job.start;
      node.scrollTop = wheelPositionAt(plan, elapsed);
      if (elapsed < plan.duration) frame = win.requestAnimationFrame(step);
      else { frame = 0; animation = null; }
    };
    frame = win.requestAnimationFrame(step);
  }
  function settle() {
    if (destroyed || drag || animation) return;
    animate(planWheelCoast({ position:node.scrollTop, max:max(), rowHeight, reducedMotion:reduced.matches }));
  }
  function addSample(position, time) {
    if (!drag || drag.samples.at(-1)?.position === position) return;
    drag.samples.push({ position, time });
    drag.samples = drag.samples.filter(sample => sample.time >= time - 120);
  }

  node.addEventListener('pointerdown', event => {
    // A second finger belongs to browser pinch zoom, not another number wheel drag.
    if (!event.isPrimary) { finish(); return; }
    if (event.button !== 0) return;
    const mouse = event.pointerType === 'mouse';
    const stoppedCoast = !mouse && (!!animation || !!settling);
    stop();
    const time = now();
    // A mouse click selects its row even while stopping a coast. A touch tap
    // first stops the moving wheel; an actual drag always suppresses its click.
    suppressUntil = stoppedCoast ? time + 500 : 0;
    drag = { id:event.pointerId, y:event.clientY, start:node.scrollTop, moved:false,
      slop:mouse ? 6 : 4, stoppedCoast, samples:[{ position:node.scrollTop, time }] };
  }, options);
  node.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const distance = drag.y - event.clientY;
    if (!drag.moved && Math.abs(distance) < drag.slop) return;
    if (!drag.moved) {
      drag.moved = true;
      node.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    node.scrollTop = clamp(drag.start + distance, 0, max());
    addSample(node.scrollTop, now());
  }, { ...options, passive:false });
  node.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const gesture = drag, time = now();
    if (gesture.moved) {
      // The release can contain a final movement absent from pointermove.
      node.scrollTop = clamp(gesture.start + gesture.y - event.clientY, 0, max());
      addSample(node.scrollTop, time);
    }
    releaseDrag();
    if (!gesture.moved && !gesture.stoppedCoast) return;
    suppressUntil = time + 500;
    if (gesture.moved) event.preventDefault();
    animate(planWheelCoast({ position:node.scrollTop,
      velocity:gesture.moved ? wheelReleaseVelocity(gesture.samples, time, { minDistance:rowHeight / 2 }) : 0,
      max:max(), rowHeight, reducedMotion:reduced.matches }));
  }, options);
  node.addEventListener('pointercancel', event => {
    if (drag?.id === event.pointerId) { suppressUntil = now() + 500; finish(); }
  }, options);
  node.addEventListener('lostpointercapture', event => {
    // A touched row loses its implicit capture when the wheel takes over.
    // Its bubbling event must not cancel the finger gesture we just started.
    if (event.target === node && drag?.id === event.pointerId) finish();
  }, options);

  // Mouse wheels and trackpads retain native scrolling. Centre only after their
  // scroll events have stopped; any next event cancels/restarts this idle delay.
  node.addEventListener('wheel', () => stop(), { ...options, passive:true });
  node.addEventListener('scroll', () => {
    if (destroyed || animation || drag) return;
    if (settling) win.clearTimeout(settling);
    settling = 0;
    if (Math.abs(node.scrollTop - nearestWheelPosition(node.scrollTop, max(), rowHeight)) < 0.5) return;
    settling = win.setTimeout(() => { settling = 0; settle(); }, 180);
  }, { ...options, passive:true });
  reduced.addEventListener('change', () => { if (reduced.matches) finish(); }, options);

  return {
    stop, finish, setIndex,
    isClickSuppressed:() => now() < suppressUntil,
    destroy:() => { stop(); destroyed = true; controller.abort(); },
  };
}
