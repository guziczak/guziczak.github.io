import test from 'node:test';
import assert from 'node:assert/strict';
import { copyText, selectCopyText } from './clipboard.js';
import { createPrescriptionCart, savePrescriptionItem, prescriptionCartText } from './prescription-cart.js';

const patient = { specialty:'dental', patientType:'adult', age:'35', humanAgeUnit:'years',
  weight:'70', renalStatus:'unknown', humanCrCl:'', humanSerumCreatinine:'' };
const entries = [
  { label:'Augmentin · 500 + 125 mg · tabletki powlekane',
    full:'Rp. Amoxicillinum + Acidum clavulanicum\nAugmentin · 500 + 125 mg · tabletki powlekane\n1 op. po 21 tabl.\nD.S. 1 tabl. doustnie, 3 razy na dobę przez 5 dni.\nUwagi: „tekst kontrolny” & <znaki>.',
    ds:'Wskazanie: Zakażenie zębopochodne.\n\nD.S. 1 tabl. doustnie, 3 razy na dobę przez 5 dni.\nUwagi: „tekst kontrolny” & <znaki>.' },
  { label:'Baikadent · 5,77 mg/g, żel',
    full:'Rp. Baikadent · 5,77 mg/g, żel\n2 op. po 15 g\nD.S. Stosować miejscowo 3 razy na dobę przez 14 dni.',
    ds:'Wskazanie: Przewlekły stan zapalny błony śluzowej.\n\nD.S. Stosować miejscowo 3 razy na dobę przez 14 dni.' },
];
let cart = createPrescriptionCart();
for (const [index, item] of entries.entries()) {
  const saved = savePrescriptionItem(cart, { valid:true, confirmed:true,
    snapshot:{ ...patient, drugId:`drug-${index}`, formId:`form-${index}` },
    label:item.label, texts:{ full:item.full, ds:item.ds } });
  assert.equal(saved.ok, true);
  cart = saved.cart;
}
const output = mode => {
  const result = prescriptionCartText(cart, patient, { mode });
  assert.equal(result.ok, true);
  assert.equal(result.text, entries.map(item => mode === 'ds' ? `${item.label}\n${item.ds}` : item.full).join('\n\n'));
  return result.text;
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

// Browser-only surfaces: the test observes the actual selected text and parent
// at execCommand time, and the previous focus/selection after cleanup.
function selectionFixture({ commandResult = true, commandThrows = false, openDialog = true } = {}) {
  const events = [], fields = [], copies = [];
  const originalRange = { id:'original', cloneRange() { return this; } };
  const selection = { ranges:[originalRange], get rangeCount() { return this.ranges.length; },
    getRangeAt(index) { return this.ranges[index]; },
    removeAllRanges() { this.ranges = []; }, addRange(range) { this.ranges.push(range); } };
  let active;
  const previous = { isConnected:true, selectionStart:2, selectionEnd:6, selectionDirection:'backward',
    focus() { active = this; events.push('restore-focus'); },
    setSelectionRange(start, end, direction) { Object.assign(this, { selectionStart:start, selectionEnd:end, selectionDirection:direction }); } };
  active = previous;
  const parent = name => ({ name, isConnected:true, children:[], appendChild(field) {
    this.children.push(field); field.parentElement = this; field.isConnected = true;
  } });
  const body = parent('body'), dialog = parent('dialog'), container = parent('explicit-container');
  const document = {
    body, get activeElement() { return active; }, getSelection:() => selection,
    querySelector:selector => selector === 'dialog[open]' && openDialog ? dialog : null,
    createElement(tag) {
      assert.equal(tag, 'textarea');
      const field = { value:'', readOnly:false, style:{}, isConnected:false, attributes:{}, ranges:[],
        setAttribute(key, value) { this.attributes[key] = value; },
        focus() { active = this; events.push('focus'); },
        select() { selection.ranges = [{ id:'temporary-field' }]; events.push('select'); },
        setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; this.ranges.push([start, end]); events.push('range'); },
        remove() {
          if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(item => item !== this);
          this.parentElement = null; this.isConnected = false; events.push('remove');
        },
      };
      fields.push(field);
      return field;
    },
    execCommand(command) {
      events.push('exec');
      assert.equal(command, 'copy');
      assert.equal(active, fields.at(-1));
      assert.equal(active.readOnly, true);
      assert.deepEqual(active.ranges.at(-1), [0, active.value.length]);
      copies.push({ text:active.value, parent:active.parentElement });
      if (commandThrows) throw new Error('Copy denied');
      return commandResult;
    },
  };
  return { document, body, dialog, container, previous, selection, originalRange, events, fields, copies };
}

test('native clipboard receives the exact multi-item full or advice text without HTML conversion', async () => {
  for (const mode of ['full', 'ds']) {
    const text = output(mode), writes = [], fixture = selectionFixture();
    const clipboard = { writeText(value) { assert.equal(this, clipboard); writes.push(value); return Promise.resolve(); } };
    assert.equal(await copyText(text, { navigator:{ clipboard }, document:fixture.document }), true);
    assert.deepEqual(writes, [text]);
    assert.equal(fixture.fields.length, 0);
    assert.equal(fixture.copies.length, 0);
  }
});

test('native write starts in the initiating call and succeeds only after its promise resolves', async () => {
  const pending = deferred(), writes = [], fixture = selectionFixture();
  const result = copyText(output('full'), { document:fixture.document,
    navigator:{ clipboard:{ writeText(text) { writes.push(text); return pending.promise; } } } });
  assert.deepEqual(writes, [output('full')]);
  let settled = false;
  result.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(fixture.copies.length, 0);
  pending.resolve();
  assert.equal(await result, true);
  assert.equal(fixture.copies.length, 0);
});

test('missing, rejected and synchronously denied clipboard access retain the complete selected cart text', async () => {
  for (const mode of ['full', 'ds']) for (const navigator of [
    {}, { clipboard:{ writeText:() => Promise.reject(new Error('Denied')) } },
    { clipboard:{ writeText() { throw new Error('Denied'); } } },
  ]) {
    const text = output(mode), fixture = selectionFixture();
    assert.equal(await copyText(text, { navigator, document:fixture.document, container:fixture.dialog }), true);
    assert.deepEqual(fixture.copies, [{ text, parent:fixture.dialog }]);
    assert.equal(fixture.fields[0].isConnected, false);
    assert.deepEqual(fixture.dialog.children, []);
  }
});

test('selection fallback uses an explicit container or the open modal before body and restores user focus', async () => {
  for (const target of ['container', 'dialog', 'body']) {
    const fixture = selectionFixture({ openDialog:target !== 'body' });
    assert.equal(await copyText(output('full'), { navigator:{}, document:fixture.document,
      ...(target === 'container' ? { container:fixture.container } : {}) }), true);
    assert.equal(fixture.copies[0].parent, fixture[target]);
    assert.equal(fixture.document.activeElement, fixture.previous);
    assert.deepEqual([fixture.previous.selectionStart, fixture.previous.selectionEnd, fixture.previous.selectionDirection], [2, 6, 'backward']);
    assert.deepEqual(fixture.selection.ranges, [fixture.originalRange]);
    assert.deepEqual(fixture[target].children, []);
  }
});

test('a selection, false result or thrown copy command never becomes reported success', async () => {
  for (const options of [{ commandResult:false }, { commandResult:1 }, { commandThrows:true }]) {
    const fixture = selectionFixture(options);
    assert.equal(await copyText(output('ds'), { navigator:{}, document:fixture.document }), false);
    assert.equal(fixture.copies.length, 1);
    assert.equal(fixture.fields[0].isConnected, false);
    assert.equal(fixture.document.activeElement, fixture.previous);
    assert.deepEqual(fixture.selection.ranges, [fixture.originalRange]);
  }
  const unavailable = selectionFixture();
  delete unavailable.document.execCommand;
  assert.equal(await copyText(output('full'), { navigator:{}, document:unavailable.document }), false);
  assert.equal(unavailable.fields.length, 0);
});

test('failed focus or a partial selection cannot copy the previous user selection', async () => {
  for (const failure of ['focus', 'start', 'end']) {
    const fixture = selectionFixture(), createElement = fixture.document.createElement;
    fixture.document.createElement = tag => {
      const field = createElement(tag);
      if (failure === 'focus') field.focus = () => { throw new Error('Webview refused focus'); };
      else field.setSelectionRange = (start, end) => {
        field.selectionStart = failure === 'start' ? 1 : start;
        field.selectionEnd = failure === 'end' ? end - 1 : end;
      };
      return field;
    };
    assert.equal(await copyText(output('full'), { navigator:{}, document:fixture.document }), false, failure);
    assert.equal(fixture.events.includes('exec'), false, failure);
    assert.equal(fixture.copies.length, 0, failure);
    assert.equal(fixture.fields[0].isConnected, false, failure);
    assert.deepEqual(fixture.dialog.children, [], failure);
    assert.equal(fixture.document.activeElement, fixture.previous, failure);
    assert.deepEqual([fixture.previous.selectionStart, fixture.previous.selectionEnd, fixture.previous.selectionDirection], [2, 6, 'backward'], failure);
    assert.deepEqual(fixture.selection.ranges, [fixture.originalRange], failure);
  }
});

test('an explicit retry attempts selection immediately before native writing and never repeats a failed selection', async () => {
  const success = selectionFixture(), text = output('full');
  const copied = copyText(text, { document:success.document, preferSelection:true,
    navigator:{ clipboard:{ writeText() { assert.fail('Native API is unnecessary after successful selection copy'); } } } });
  assert.equal(success.copies.length, 1);
  assert.equal(await copied, true);

  for (const rejected of [false, true]) {
    const fixture = selectionFixture({ commandResult:false }), pending = deferred(), order = [];
    const execCommand = fixture.document.execCommand;
    fixture.document.execCommand = command => { order.push('selection'); return execCommand(command); };
    const result = copyText(text, { document:fixture.document, preferSelection:true,
      navigator:{ clipboard:{ writeText(value) { order.push('native'); assert.equal(value, text); return pending.promise; } } } });
    assert.deepEqual(order, ['selection', 'native']);
    if (rejected) pending.reject(new Error('Native API denied too')); else pending.resolve();
    assert.equal(await result, !rejected);
    assert.deepEqual(order, ['selection', 'native']);
    assert.equal(fixture.copies.length, 1);
  }
});

test('a late native rejection cannot copy a stale snapshot after its dialog is closed or replaced', async () => {
  const fixture = selectionFixture(), pending = deferred();
  let current = true;
  const result = copyText(output('full'), { document:fixture.document, isCurrent:() => current,
    navigator:{ clipboard:{ writeText:() => pending.promise } } });
  current = false;
  pending.reject(new Error('Delayed denial'));
  assert.equal(await result, false);
  assert.equal(fixture.fields.length, 0);
  assert.equal(fixture.copies.length, 0);
  assert.equal(await copyText(output('full'), { document:fixture.document, isCurrent:() => false,
    navigator:{ clipboard:{ writeText() { assert.fail('No write for an already stale request'); } } } }), false);
});

test('manual selection attempts the full range even when a webview rejects focus or select', () => {
  for (const unsupported of [null, 'focus', 'select', 'range']) {
    const calls = [], text = output('ds');
    const field = { value:text,
      focus(options) { calls.push(['focus', options]); if (unsupported === 'focus') throw new Error(); },
      select() { calls.push(['select']); if (unsupported === 'select') throw new Error(); },
      setSelectionRange(start, end) { calls.push(['range', start, end]); if (unsupported === 'range') throw new Error(); },
    };
    assert.doesNotThrow(() => selectCopyText(field));
    assert.deepEqual(calls, [['focus', {preventScroll:true}], ['select'], ['range', 0, text.length]]);
  }
});
