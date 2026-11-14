/** A dry, non-periodic click; no oscillator, pitch sweep or recorded audio. */
export function buildClickSamples(sampleRate) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new TypeError('A positive sample rate is required');
  const duration = 0.014, length = Math.ceil(sampleRate * duration);
  const samples = new Float32Array(length), correction = new Float32Array(length);
  const lowPass = 1 - Math.exp(-2 * Math.PI * Math.min(8000, sampleRate * 0.4) / sampleRate);
  const highPass = Math.exp(-2 * Math.PI * 500 / sampleRate);
  let seed = 0x52c1a7, low = 0, previousLow = 0, high = 0, sum = 0, correctionSum = 0;
  for (let index = 1; index < length - 1; index++) {
    const time = index / sampleRate;
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const noise = (seed >>> 0) / 2147483648 - 1;
    const attack = Math.min(1, time / 0.00015);
    const fade = Math.min(1, (length - 1 - index) / (sampleRate * 0.001));
    const envelope = attack * Math.exp(-time / 0.00145) * fade;
    const pulsePosition = (time - 0.00028) / 0.000085;
    const impulse = pulsePosition * Math.exp(-0.5 * pulsePosition ** 2);
    const raw = 0.95 * impulse * attack + 0.55 * noise * envelope;
    low += lowPass * (raw - low);
    high = highPass * (high + low - previousLow);
    previousLow = low;
    samples[index] = high * fade;
    correction[index] = envelope;
    sum += samples[index]; correctionSum += correction[index];
  }
  // Remove the tiny finite-buffer DC remainder within the short attack/body,
  // rather than adding a flat offset or a second transient at the end.
  const offset = correctionSum ? sum / correctionSum : 0;
  let peak = 0;
  for (let index = 1; index < length - 1; index++) {
    samples[index] -= offset * correction[index];
    peak = Math.max(peak, Math.abs(samples[index]));
  }
  if (peak) for (let index = 1; index < length - 1; index++) samples[index] *= 0.85 / peak;
  return samples;
}

/** Ephemeral wheel feedback only; never reads or changes a patient value. */
export function createWheelFeedback(win = window) {
  const doc = win.document;
  const voices = new Set();
  let context = null, clickBuffer = null, active = false, destroyed = false, lastTick = -Infinity, vibrating = false;
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
        clickBuffer = null;
      }
      if (!clickBuffer) {
        const samples = buildClickSamples(context.sampleRate);
        const buffer = context.createBuffer(1, samples.length, context.sampleRate);
        buffer.copyToChannel(samples, 0);
        clickBuffer = buffer;
      }
      if (context.state !== 'running') context.resume()?.catch(() => {});
    } catch { /* Audio can be unavailable or blocked; the wheel still works. */ }
  }

  function playTick() {
    if (!context || !clickBuffer || context.state !== 'running') return;
    // At most two short tails, even if a browser delays its ended callbacks.
    while (voices.size >= 2) voices.values().next().value.dispose();
    const nodes = [], sources = [];
    let disposed = false;
    const voice = { dispose() {
      if (disposed) return;
      disposed = true;
      voices.delete(voice);
      for (const source of sources) {
        source.onended = null;
        try { source.stop(); } catch { /* Already ended. */ }
      }
      for (const node of nodes) try { node.disconnect(); } catch { /* Already disconnected. */ }
    } };
    voices.add(voice);
    try {
      const start = context.currentTime;
      const source = context.createBufferSource(), gain = context.createGain();
      nodes.push(source, gain); sources.push(source);
      source.buffer = clickBuffer;
      gain.gain.setValueAtTime(0.09, start);
      source.connect(gain); gain.connect(context.destination);
      source.onended = () => voice.dispose();
      source.start(start);
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
    context = null; clickBuffer = null;
  }

  return { unlock, tick, stop, destroy };
}
