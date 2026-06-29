/* "światło w ciemności" — live Web Audio synth for Łukasz Guziczak's own
   composition. No samples, no MP3, no MIDI playback: the browser renders the
   score from note data, in real time. Opt-in only — never autoplays.
   Ported from the CV cover so the two stay true twins. */

export interface SwiatloPlayer {
  toggle(): void;
  isPlaying(): boolean;
  /** Live piece-time in seconds while playing, or -1 when stopped. Drives the staff. */
  position(): number;
}

// Tuned bell — HARMONIC partials only (the octave + integer overtones), so it never
// fights the music. A real bell's charm is its INHARMONIC partials (minor-third
// tierce, superquint), but under a melody those beat against the harmony and read as
// "out of tune" — so they're gone. What's left: a struck attack, a long blooming
// fundamental, consonant overtones, and a sub-octave hum for weight. Glassy, deep,
// and always in key.
// [ratio (octave / harmonic of the played note), gain, decay seconds]
const BELL_PARTIALS: [number, number, number][] = [
  [0.5, 0.30, 6.5],   // sub-octave hum — weight, one octave down (same pitch class)
  [1.0, 1.0, 5.5],    // fundamental — the note, rings longest
  [2.0, 0.45, 3.2],   // 2nd harmonic — the octave
  [3.0, 0.20, 2.0],   // 3rd harmonic — octave + fifth, consonant shimmer
  [4.0, 0.11, 1.1],   // 4th harmonic — two octaves
  [6.0, 0.05, 0.5],   // 6th harmonic — a breath of sparkle, gone fast
];

// notes: [start_ms, dur_ms, midi, velocity][]
export function createSwiatlo(
  notes: number[][],
  opts: { onState?: (on: boolean) => void; leadInSec?: number },
): SwiatloPlayer {
  const onState = opts.onState || (() => {});
  // Visual count-in: how long the score rolls in from the right before the first note sounds.
  const leadIn = Math.max(0, opts.leadInSec || 0);
  let firstPlay = true; // first start = brisk count-in; loop restarts roll in fully from the edge
  const W = window as any;
  let ctx: any = null;
  let bus: any = null;
  let playing = false;
  let timer: any = null;
  let loopTimer: any = null;
  let idx = 0;
  let startCtxTime = 0;
  let pieceOffset = 0;
  let unlocked = false;

  let durSec = 0;
  for (const n of notes) durSec = Math.max(durSec, (n[0] + n[1]) / 1000);
  const LOOP_GAP = 2.5; // seconds of breath between repeats (the last bell rings into it)

  const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

  function makeImpulse(seconds: number, decay: number) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function build() {
    const AC = W.AudioContext || W.webkitAudioContext;
    ctx = new AC();
    bus = ctx.createGain();
    bus.gain.value = 0.0001;

    // Let the strike shimmer through, but stop short of digital glare.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 6800;
    lp.Q.value = 0.5;

    const dry = ctx.createGain();
    dry.gain.value = 0.72;

    // The nave: a long stone reverb. High-pass the SEND so the low hum blooms in
    // the air instead of turning the tail to mud.
    const send = ctx.createBiquadFilter();
    send.type = 'highpass';
    send.frequency.value = 260;
    send.Q.value = 0.5;
    const conv = ctx.createConvolver();
    conv.buffer = makeImpulse(3.6, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 14;
    comp.ratio.value = 3;
    comp.attack.value = 0.008;
    comp.release.value = 0.25;

    const master = ctx.createGain();
    master.gain.value = 0.8;

    // Brickwall limiter — strikes ringing on top of each other must never clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;

    bus.connect(lp);
    lp.connect(dry);
    dry.connect(comp);
    lp.connect(send);
    send.connect(conv);
    conv.connect(wet);
    wet.connect(comp);
    comp.connect(master);
    master.connect(limiter);
    limiter.connect(ctx.destination);
  }

  function voice(when: number, durS: number, midi: number, vel: number) {
    const f = midiToFreq(midi);
    const velN = Math.pow(vel / 127, 1.3);
    const amp = velN * 0.13;
    const bright = 0.35 + 0.65 * velN; // a harder strike rings brighter (more upper partials)
    const on = when;

    // Per-strike head gain + a touch of stereo placement: width without losing the centre.
    const head = ctx.createGain();
    head.gain.value = amp;
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-0.6, Math.min(0.6,
        ((midi % 12) - 5.5) / 14 + (Math.random() - 0.5) * 0.18));
      head.connect(pan);
      pan.connect(bus);
    } else {
      head.connect(bus);
    }

    // Each partial is its own struck sine: instant attack, then an exponential decay
    // whose length is set per-partial — high strike tones die fast, the hum rings on.
    for (const [ratio, g, decay] of BELL_PARTIALS) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * ratio;
      o.detune.value = (Math.random() - 0.5) * 4; // micro-detune: cast bronze, not a sine bank
      const pg = ctx.createGain();
      const peak = Math.max(g * (ratio >= 2 ? bright : 1), 0.0001);
      const ring = decay * (0.85 + 0.3 * (Math.min(durS, 2) / 2)); // longer notes ring a touch longer
      pg.gain.setValueAtTime(0.0001, on);
      pg.gain.exponentialRampToValueAtTime(peak, on + 0.004);
      pg.gain.exponentialRampToValueAtTime(0.0001, on + 0.004 + ring);
      o.connect(pg);
      pg.connect(head);
      o.start(on);
      o.stop(on + 0.004 + ring + 0.05);
    }
  }

  function tick() {
    if (!playing) return;
    const lookahead = ctx.currentTime + 0.18;
    while (idx < notes.length) {
      const n = notes[idx];
      const when = startCtxTime + n[0] / 1000;
      if (when > lookahead) break;
      voice(Math.max(when, ctx.currentTime), n[1] / 1000, n[2], n[3]);
      idx++;
    }
    if (idx >= notes.length) {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      // Loop: once the last note has rung out (+ a breath), re-lay the timeline from the
      // top. The bell's long reverb tail carries the seam, so the repeat feels continuous.
      const remaining = startCtxTime + durSec - ctx.currentTime;
      // Fire the repeat one lead-in early so the next pass visibly rolls in DURING the gap —
      // the seam stays the same length of silence, but you see the score returning.
      loopTimer = setTimeout(() => {
        if (playing) start(0);
      }, Math.max((remaining + LOOP_GAP - leadIn) * 1000, 250));
    }
  }

  function start(offsetSec: number) {
    if (!ctx) build();
    // iOS/WebKit: prime the output with a 1-sample silent buffer inside the gesture.
    if (!unlocked) {
      try {
        const s = ctx.createBufferSource();
        s.buffer = ctx.createBuffer(1, 1, 22050);
        s.connect(ctx.destination);
        s.start(0);
      } catch {}
      unlocked = true;
    }

    // Lay down the timeline only once the context is actually RUNNING. On iOS a fresh
    // AudioContext is suspended and its currentTime is frozen at 0 — scheduling against
    // it lands every note in the past, so the first play is silent until you tap again
    // (the "two taps" bug). Resume first, THEN begin against a live clock.
    const begin = () => {
      if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
      pieceOffset = offsetSec || 0;
      // From the top, hold a visual count-in so the staff rolls in from the RIGHT EDGE and the
      // first note meets the playhead as it rings. First play gets a brisk lead (responsive on a
      // tap); loop restarts get the full lead so the score visibly rolls in from the edge during
      // the gap. Mid-piece resume: just the audio-scheduling latency.
      const fromTop = (offsetSec || 0) < 0.001;
      const lead = fromTop ? (firstPlay ? Math.min(leadIn, 2.6) : leadIn) : 0.12;
      firstPlay = false;
      const preroll = Math.max(0.12, lead);
      startCtxTime = ctx.currentTime + preroll - pieceOffset;
      idx = 0;
      while (idx < notes.length && (notes[idx][0] + notes[idx][1]) / 1000 <= pieceOffset) idx++;
      playing = true;
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), ctx.currentTime);
      bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.4);
      if (timer) clearInterval(timer);
      timer = setInterval(tick, 35);
      tick();
      onState(true);
    };

    if (ctx.state === 'suspended' && ctx.resume) {
      ctx.resume().then(begin).catch(begin);
    } else {
      begin();
    }
  }

  function pause() {
    if (!playing || !ctx) return;
    pieceOffset = ctx.currentTime - startCtxTime;
    playing = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (loopTimer) {
      clearTimeout(loopTimer);
      loopTimer = null;
    }
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    onState(false);
  }

  return {
    toggle() {
      if (playing) pause();
      else start(pieceOffset >= durSec - 0.5 ? 0 : pieceOffset);
    },
    isPlaying: () => playing,
    position: () => (playing && ctx ? ctx.currentTime - startCtxTime : -1),
  };
}
