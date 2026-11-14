import test from 'node:test';
import assert from 'node:assert/strict';
import { createWheelFeedback } from './wheel-feedback.js';

function fixture({ audio = true, haptic = true, state = 'running', rejectResume = false, constructorThrows = false } = {}) {
  let time = 0;
  const vibrations = [], contexts = [], nodes = [];
  const doc = new EventTarget();
  Object.assign(doc, { hidden:false, visibilityState:'visible' });
  const win = new EventTarget();
  Object.assign(win, { document:doc, performance:{ now:() => time }, navigator:{} });
  if (haptic) win.navigator.vibrate = duration => { vibrations.push(duration); return true; };
  const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = oscillator => {
    const result = { disconnected:false, stops:[], connect() {}, disconnect() { this.disconnected = true; },
      frequency:param(), gain:param(), start() {}, stop(at) { this.stops.push(at); } };
    nodes.push(result);
    if (oscillator) result.onended = null;
    return result;
  };
  if (audio) win.AudioContext = class {
    constructor() {
      if (constructorThrows) throw new Error('Audio unavailable');
      Object.assign(this, { state, currentTime:0, destination:{}, resumes:0, closes:0 }); contexts.push(this);
    }
    createOscillator() { return node(true); }
    createGain() { return node(false); }
    resume() {
      this.resumes++;
      if (rejectResume) return Promise.reject(new Error('Autoplay blocked'));
      this.state = 'running'; return Promise.resolve();
    }
    close() { this.closes++; this.state = 'closed'; return Promise.resolve(); }
  };
  return { win, doc, vibrations, contexts, nodes, setTime:value => { time = value; },
    hide() { doc.hidden = true; doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); },
    show() { doc.hidden = false; doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange')); } };
}

test('feedback stays silent until a real unlock and tolerates unsupported devices', () => {
  const f = fixture(), feedback = createWheelFeedback(f.win);
  feedback.tick(); assert.equal(f.contexts.length, 0); assert.deepEqual(f.vibrations, []);
  feedback.unlock(); feedback.unlock(); assert.equal(f.contexts.length, 1);
  feedback.tick(); assert.equal(f.nodes.length, 4); assert.deepEqual(f.vibrations, [6]);
  feedback.destroy();
  const unsupported = fixture({ audio:false, haptic:false });
  const quiet = createWheelFeedback(unsupported.win);
  assert.doesNotThrow(() => { quiet.unlock(); quiet.tick(); quiet.stop(); quiet.destroy(); });
});

test('blocked or unavailable audio never prevents haptics and never queues a later burst', async () => {
  for (const options of [{ state:'suspended', rejectResume:true }, { constructorThrows:true }]) {
    const f = fixture(options), feedback = createWheelFeedback(f.win);
    feedback.unlock(); feedback.tick(); await Promise.resolve();
    assert.deepEqual(f.vibrations, [6]); assert.equal(f.nodes.length, 0);
    if (f.contexts[0]) { f.contexts[0].state = 'running'; await Promise.resolve(); assert.equal(f.nodes.length, 0); }
    feedback.destroy();
  }
});

test('rapid index changes are throttled without delayed work or unbounded tails', () => {
  const f = fixture(), feedback = createWheelFeedback(f.win); feedback.unlock();
  feedback.tick(); f.setTime(10); feedback.tick(); f.setTime(39); feedback.tick();
  assert.deepEqual(f.vibrations, [6]); assert.equal(f.nodes.length, 4);
  f.setTime(40); feedback.tick(); f.setTime(80); feedback.tick();
  assert.deepEqual(f.vibrations, [6,6,6]);
  assert.ok(f.nodes.slice(0,4).every(node => node.disconnected));
  assert.ok(f.nodes.slice(4).every(node => !node.disconnected));
  feedback.destroy(); assert.ok(f.nodes.every(node => node.disconnected));
});

test('muting the tick preserves the same haptic response', () => {
  const f = fixture(), feedback = createWheelFeedback(f.win); feedback.unlock();
  feedback.tick({ sound:false }); assert.deepEqual(f.vibrations, [6]); assert.equal(f.nodes.length, 0);
  f.setTime(50); feedback.tick({ sound:true }); assert.deepEqual(f.vibrations, [6,6]); assert.equal(f.nodes.length, 4);
  feedback.destroy();
});

test('closing stops tails and vibration; reopening reuses audio and resumes an interrupted context', () => {
  const f = fixture(), feedback = createWheelFeedback(f.win); feedback.unlock(); feedback.tick();
  feedback.stop(); assert.deepEqual(f.vibrations, [6,0]); assert.ok(f.nodes.every(node => node.disconnected));
  f.setTime(100); feedback.tick(); assert.equal(f.nodes.length, 4); assert.deepEqual(f.vibrations, [6,0]);
  f.contexts[0].state = 'interrupted'; feedback.unlock(); feedback.tick();
  assert.equal(f.contexts.length, 1); assert.equal(f.contexts[0].resumes, 1); assert.equal(f.nodes.length, 8);
  feedback.destroy();
});

test('hidden pages and page navigation stop feedback until another explicit unlock', () => {
  const f = fixture(), feedback = createWheelFeedback(f.win); feedback.unlock(); feedback.tick();
  f.hide(); f.setTime(100); feedback.unlock(); feedback.tick();
  assert.equal(f.nodes.length, 4); assert.deepEqual(f.vibrations, [6,0]);
  f.show(); feedback.tick(); assert.equal(f.nodes.length, 4);
  feedback.unlock(); feedback.tick(); assert.equal(f.nodes.length, 8);
  f.win.dispatchEvent(new Event('pagehide')); f.setTime(200); feedback.tick();
  assert.equal(f.nodes.length, 8); assert.ok(f.nodes.every(node => node.disconnected));
  feedback.destroy();
});

test('ended sounds release nodes and destroy is final even when called repeatedly', () => {
  const f = fixture(), feedback = createWheelFeedback(f.win); feedback.unlock(); feedback.tick();
  f.nodes[0].onended(); assert.ok(f.nodes.every(node => node.disconnected));
  feedback.destroy(); feedback.destroy(); feedback.unlock(); f.setTime(100); feedback.tick();
  assert.equal(f.contexts.length, 1); assert.equal(f.contexts[0].closes, 1); assert.equal(f.nodes.length, 4);
});
