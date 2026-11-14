/** Ephemeral wheel feedback only; never reads or changes a patient value. */
export function createWheelFeedback(win = window) {
  const doc = win.document;
  const voices = new Set();
  let context = null, active = false, destroyed = false, lastTick = -Infinity, vibrating = false;
  const visible = () => !doc?.hidden && doc?.visibilityState !== 'hidden';
  const now = () => win.performance?.now() ?? Date.now();

  function vibrate(duration) {
    if (typeof win.navigator?.vibrate !== 'function') return;
    try {
      const accepted = win.navigator.vibrate(duration);
      vibrating = duration > 0 && accepted !== false;
    } catch { vibrating = false; }
  }

  function unlock() {
    if (destroyed || !visible()) return;
    if (!active) lastTick = -Infinity;
    active = true;
    // Creation/resume must begin inside the real opening or input gesture.
    // A failed unlock never queues sounds for playback later.
    try {
      if (!context || context.state === 'closed') {
        const AudioContext = win.AudioContext || win.webkitAudioContext;
        if (!AudioContext) return;
        context = new AudioContext({ latencyHint:'interactive' });
      }
      if (context.state !== 'running') context.resume()?.catch(() => {});
    } catch { /* Audio can be unavailable or blocked; the wheel still works. */ }
  }

  function playTick() {
    if (!context || context.state !== 'running') return;
    // At most two short tails, even if a browser delays its ended callbacks.
    while (voices.size >= 2) voices.values().next().value.dispose();
    const nodes = [], oscillators = [];
    let disposed = false;
    const voice = { dispose() {
      if (disposed) return;
      disposed = true;
      voices.delete(voice);
      for (const oscillator of oscillators) {
        oscillator.onended = null;
        try { oscillator.stop(); } catch { /* Already ended. */ }
      }
      for (const node of nodes) try { node.disconnect(); } catch { /* Already disconnected. */ }
    } };
    voices.add(voice);
    try {
      const start = context.currentTime;
      // A soft, brief mechanical tick with a small metallic overtone. The
      // envelopes end locally; there is no audio file, network or sound queue.
      for (const [frequency, endFrequency, volume, duration, type] of [
        [1800, 1250, 0.035, 0.035, 'triangle'],
        [3500, 2900, 0.012, 0.018, 'sine'],
      ]) {
        const oscillator = context.createOscillator(), gain = context.createGain();
        nodes.push(oscillator, gain); oscillators.push(oscillator);
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume, start + 0.0015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        gain.gain.setValueAtTime(0, start + duration + 0.002);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(start); oscillator.stop(start + duration + 0.003);
      }
      // The first tone is longest, so its end also releases the overtone.
      oscillators[0].onended = () => voice.dispose();
    } catch { voice.dispose(); }
  }

  function tick({ sound = true } = {}) {
    if (destroyed || !active || !visible()) return;
    const time = now();
    if (time - lastTick < 40) return;
    lastTick = time;
    vibrate(6);
    if (sound) playTick();
  }

  function stop() {
    active = false;
    lastTick = -Infinity;
    for (const voice of [...voices]) voice.dispose();
    if (vibrating) vibrate(0);
  }

  const onVisibility = () => { if (!visible()) stop(); };
  const onPageHide = () => stop();
  doc?.addEventListener('visibilitychange', onVisibility);
  win.addEventListener?.('pagehide', onPageHide);

  function destroy() {
    if (destroyed) return;
    stop(); destroyed = true;
    doc?.removeEventListener('visibilitychange', onVisibility);
    win.removeEventListener?.('pagehide', onPageHide);
    try { context?.close()?.catch(() => {}); } catch { /* Already closed. */ }
    context = null;
  }

  return { unlock, tick, stop, destroy };
}
