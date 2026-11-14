import test from 'node:test';
import assert from 'node:assert/strict';
import { createViewportLayout } from './viewport-layout.js';

function fixture() {
  let clock = 0, serial = 0, height = 86, modal = false, reducedMotion = false;
  const frames = new Map(), timers = new Map(), values = new Map(), fields = new Map();
  const moves = [], behaviors = [], observers = [];
  const win = new EventTarget(), viewport = new EventTarget();
  Object.assign(viewport, { offsetTop:0, height:800, scale:1 });
  const bar = () => ({ isConnected:true, getBoundingClientRect:() => ({ height, bottom:height }) });
  let header = bar();
  const doc = { activeElement:null, documentElement:{ style:{
    getPropertyValue:key => values.get(key) || '', setProperty:(key,value) => values.set(key,value),
  } }, getElementById:id => fields.get(id), querySelector:selector => selector === '.topbar' ? header : modal ? {} : null };
  Object.assign(win, { document:doc, visualViewport:viewport, innerHeight:800, scrollY:120,
    performance:{ now:() => clock },
    requestAnimationFrame:fn => { frames.set(++serial,fn); return serial; },
    cancelAnimationFrame:id => frames.delete(id),
    setTimeout:(fn,delay) => { timers.set(++serial,{ fn,at:clock + delay }); return serial; },
    clearTimeout:id => timers.delete(id),
    matchMedia:() => ({ matches:reducedMotion }),
    scrollTo({ top, behavior }) { moves.push(top); behaviors.push(behavior); this.scrollY = top; this.dispatchEvent(new Event('scroll')); },
    ResizeObserver:class {
      constructor(fn) { this.fn = fn; this.disconnected = false; observers.push(this); }
      observe(node) { this.node = node; }
      disconnect() { this.disconnected = true; }
    },
  });
  const layout = createViewportLayout(win);
  const frame = () => { clock += 16; const jobs = [...frames.values()]; frames.clear(); jobs.forEach(fn => fn(clock)); };
  const advance = ms => { clock += ms; for (const [id,job] of [...timers]) if (job.at <= clock) { timers.delete(id); job.fn(); } };
  const fire = (target, name, properties = {}) => { const event = new Event(name); Object.assign(event,properties); target.dispatchEvent(event); };
  const input = (id, documentTop, fieldHeight = 44) => {
    const node = { id, tagName:'INPUT', type:'text', isConnected:true,
      getBoundingClientRect:() => ({ top:documentTop - win.scrollY, bottom:documentTop - win.scrollY + fieldHeight, height:fieldHeight, width:180 }) };
    fields.set(id,node); return node;
  };
  return { win, viewport, doc, layout, frame, advance, fire, moves, behaviors, values, observers, input,
    resizeBar:value => { height = value; observers.at(-1)?.fn(); },
    replaceBar() { header.isConnected = false; header = bar(); return header; },
    setModal:value => { modal = value; },
    setReducedMotion:value => { reducedMotion = value; } };
}

test('actual header height follows resize and a new header after render', () => {
  const f = fixture(); f.layout.refresh(); f.frame();
  assert.equal(f.values.get('--pinned-header-offset'),'86px');
  f.resizeBar(112.5); f.frame(); assert.equal(f.values.get('--pinned-header-offset'),'112.5px');
  const old = f.observers[0], next = f.replaceBar(); f.layout.refresh(); f.frame();
  assert.equal(old.disconnected,true); assert.equal(f.observers.at(-1).node,next);
  assert.deepEqual(f.moves,[]); f.layout.destroy();
});

test('ordinary resize and scrolling never take over the page position', () => {
  const f = fixture(); f.layout.refresh(); f.frame();
  for (const [target,name] of [[f.win,'resize'],[f.win,'scroll'],[f.viewport,'resize'],[f.viewport,'scroll']]) {
    f.fire(target,name); f.frame();
  }
  assert.equal(f.win.scrollY,120); assert.deepEqual(f.moves,[]); f.layout.destroy();
});

test('product selection reveals the collapsed card below the current header once', () => {
  const f = fixture(), card = f.input('product',470,240);
  f.win.scrollY = 2400;
  f.layout.showSection(card);
  assert.deepEqual(f.moves,[]); // Wait for the render to settle before measuring.
  f.resizeBar(104); f.frame();
  assert.equal(f.win.scrollY,354);
  assert.equal(card.getBoundingClientRect().top,116);
  assert.deepEqual(f.behaviors,['smooth']);
  f.win.scrollY = 600; f.fire(f.viewport,'resize'); f.frame();
  assert.equal(f.win.scrollY,600); // The later viewport changes do not pin the reader.
  f.layout.destroy();
});

test('search selection waits for keyboard closure and does not return to the old field', () => {
  const f = fixture(), card = f.input('product',470,240);
  f.layout.refresh(); f.frame();
  f.doc.activeElement = f.input('search',140);
  f.layout.keyboardChanged(true);
  f.layout.showSection(card); f.frame();
  assert.deepEqual(f.moves,[]);
  f.doc.activeElement.isConnected = false; f.doc.activeElement = null;
  f.resizeBar(100); f.layout.keyboardChanged(false); f.frame();
  assert.equal(f.win.scrollY,358);
  f.advance(250); f.frame();
  assert.deepEqual(f.moves,[358]);
  f.layout.destroy();
});

test('section navigation respects reduced motion and yields to a new touch', () => {
  const f = fixture(), card = f.input('product',470,240);
  f.setReducedMotion(true); f.layout.showSection(card); f.frame();
  assert.deepEqual(f.behaviors,['instant']);
  f.layout.keyboardChanged(true); f.layout.showSection(card);
  f.fire(f.win,'touchstart'); f.win.scrollY = 900;
  f.layout.keyboardChanged(false); f.frame();
  assert.equal(f.win.scrollY,900); assert.equal(f.moves.length,1);
  f.layout.destroy();
});

test('explicit start corrects late restoration briefly but yields immediately to user input', () => {
  const f = fixture(); f.layout.showStart(); assert.equal(f.win.scrollY,0);
  f.win.scrollY = 70; f.fire(f.win,'scroll'); f.frame(); assert.equal(f.win.scrollY,0);
  f.fire(f.win,'pointerdown'); f.win.scrollY = 90; f.fire(f.viewport,'resize'); f.frame();
  assert.equal(f.win.scrollY,90);
  f.layout.showStart(); assert.equal(f.win.scrollY,0); // A later reset is a new explicit intent.
  f.advance(601); f.win.scrollY = 60; f.fire(f.win,'scroll'); f.frame(); assert.equal(f.win.scrollY,60);
  f.layout.destroy();
});

test('late fresh pageshow may finish initial start; persisted restoration and interaction are preserved', () => {
  const f = fixture(); f.layout.showStart(); f.advance(700); f.win.scrollY = 170;
  f.fire(f.win,'pageshow',{ persisted:false }); f.frame(); assert.equal(f.win.scrollY,0);
  f.win.scrollY = 200; f.fire(f.win,'pageshow',{ persisted:true }); f.frame(); assert.equal(f.win.scrollY,200);
  f.fire(f.win,'wheel'); f.fire(f.win,'pageshow',{ persisted:false }); f.frame(); assert.equal(f.win.scrollY,200);
  f.layout.destroy();
});

test('keyboard close reveals only the covered field, with one settled-header recheck', () => {
  const f = fixture(); f.layout.refresh(); f.frame();
  f.doc.activeElement = f.input('search',140); // Top 20 at scrollY 120: beneath the returning header.
  f.layout.keyboardChanged(true); f.doc.activeElement = null; f.layout.keyboardChanged(false); f.frame();
  assert.equal(f.win.scrollY,42); // Field top becomes header bottom + 12, not page top.
  f.resizeBar(100); f.advance(200); f.frame(); assert.equal(f.win.scrollY,28);
  const count = f.moves.length; f.advance(500); f.frame(); assert.equal(f.moves.length,count);
  f.layout.destroy();
});

test('keyboard repair ignores far-away fields and is cancelled by renewed interaction', () => {
  const f = fixture(); f.layout.refresh(); f.frame();
  f.doc.activeElement = f.input('old',-200); f.layout.keyboardChanged(true); f.layout.keyboardChanged(false); f.frame();
  assert.deepEqual(f.moves,[]);
  f.doc.activeElement = f.input('search',140); f.layout.keyboardChanged(true); f.layout.keyboardChanged(false);
  f.fire(f.win,'touchstart'); f.frame(); f.advance(220); f.frame(); assert.deepEqual(f.moves,[]);
  f.layout.destroy();
});

test('pinch zoom, negative bounce and modal dialogs block automatic movement; destroy cancels jobs', () => {
  for (const block of [f => { f.viewport.scale = 1.4; }, f => { f.win.scrollY = -20; },
    f => { f.viewport.offsetTop = -20; }, f => f.setModal(true)]) {
    const f = fixture(); f.layout.refresh(); f.frame(); block(f);
    f.layout.showStart(); f.doc.activeElement = f.input('search',140);
    f.layout.keyboardChanged(true); f.layout.keyboardChanged(false); f.frame(); f.advance(220); f.frame();
    f.layout.showSection(f.input('product',470,240)); f.frame();
    assert.deepEqual(f.moves,[]);
    f.layout.destroy(); f.fire(f.win,'pageshow',{ persisted:false }); f.frame(); assert.deepEqual(f.moves,[]);
  }
});
