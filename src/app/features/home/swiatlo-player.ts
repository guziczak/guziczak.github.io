/* "światło w ciemności" — live Web Audio synth for Łukasz Guziczak's own
   composition. No samples, no MP3, no MIDI playback: the browser renders the
   score from note data, in real time. Opt-in only — never autoplays.
   Ported from the CV cover so the two stay true twins. */

export interface SwiatloPlayer {
  toggle(): void;
  isPlaying(): boolean;
}

// notes: [start_ms, dur_ms, midi, velocity][]
export function createSwiatlo(
  notes: number[][],
  opts: { onState?: (on: boolean) => void },
): SwiatloPlayer {
  const onState = opts.onState || (() => {});
  const W = window as any;
  let ctx: any = null;
  let bus: any = null;
  let playing = false;
  let timer: any = null;
  let idx = 0;
  let startCtxTime = 0;
  let pieceOffset = 0;

  let durSec = 0;
  for (const n of notes) durSec = Math.max(durSec, (n[0] + n[1]) / 1000);

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

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5500;
    lp.Q.value = 0.6;

    const dry = ctx.createGain();
    dry.gain.value = 0.74;
    const conv = ctx.createConvolver();
    conv.buffer = makeImpulse(2.8, 3.0);
    const wet = ctx.createGain();
    wet.gain.value = 0.42;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 14;
    comp.ratio.value = 3;
    comp.attack.value = 0.008;
    comp.release.value = 0.22;

    const master = ctx.createGain();
    master.gain.value = 0.85;

    bus.connect(lp);
    lp.connect(dry);
    dry.connect(comp);
    lp.connect(conv);
    conv.connect(wet);
    wet.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);
  }

  function voice(when: number, durS: number, midi: number, vel: number) {
    const f = midiToFreq(midi);
    const amp = Math.pow(vel / 127, 1.3) * 0.16;
    const a = 0.012,
      d = 0.16,
      s = 0.55,
      r = 0.42;
    const on = when;
    const off = when + Math.max(durS, 0.08);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, on);
    g.gain.exponentialRampToValueAtTime(amp, on + a);
    g.gain.exponentialRampToValueAtTime(Math.max(amp * s, 0.0001), on + a + d);
    g.gain.setValueAtTime(Math.max(amp * s, 0.0001), off);
    g.gain.exponentialRampToValueAtTime(0.0001, off + r);
    g.connect(bus);

    const osc = (type: string, mul: number, detune: number, gain: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * mul;
      o.detune.value = detune;
      const og = ctx.createGain();
      og.gain.value = gain;
      o.connect(og);
      og.connect(g);
      o.start(on);
      o.stop(off + r + 0.05);
    };
    osc('triangle', 1, 0, 0.55);
    osc('sine', 1, 6, 0.5);
    if (midi >= 60) osc('sine', 2, 0, 0.07);
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
      const remaining = startCtxTime + durSec - ctx.currentTime + 0.7;
      setTimeout(() => {
        if (playing) {
          playing = false;
          pieceOffset = 0;
          onState(false);
        }
      }, Math.max(remaining * 1000, 250));
    }
  }

  function start(offsetSec: number) {
    if (!ctx) build();
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    pieceOffset = offsetSec || 0;
    startCtxTime = ctx.currentTime + 0.12 - pieceOffset;
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
  }

  function pause() {
    if (!playing || !ctx) return;
    pieceOffset = ctx.currentTime - startCtxTime;
    playing = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
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
  };
}
