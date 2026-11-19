import test from 'node:test';
import assert from 'node:assert/strict';
import { decimalRoundingMarkup, prescriptionCartMarkup } from './prescription-tools-view.js';

const buttons = markup => [...markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(match => match[0]);
const button = (markup, action, value) => buttons(markup).find(element =>
  element.includes(`data-action="${action}"`) && (value === undefined || element.includes(`data-value="${value}"`)));
const opening = (markup, id) => new RegExp(`<[^>]+\\bid="${id}"[^>]*>`).exec(markup)?.[0] || '';
const pre = markup => /<pre\b[^>]*id="cart-preview"[^>]*>([\s\S]*?)<\/pre>/.exec(markup)?.[1];
const draft = (id = 'rx-1', label = 'Preparat A') => ({
  id, label, summary: '10 ml · 2 × na dobę · 7 dni',
  snapshot: { weight: 70 }, texts: { full: 'Rp. A', ds: 'D.S. A' },
});
const cartOptions = { items: [draft()], patientLabel: 'Dorosły · 70 kg', text: 'Rp. A\nD.S. A', canCopy: true };

test('unsupported forms do not expose unusable rounding controls', () => {
  assert.equal(decimalRoundingMarkup(), '');
  assert.equal(decimalRoundingMarkup({ supported: false, enabled: true, places: 2 }), '');
});

test('Auto is selected by default with hidden custom precision and accessible details', () => {
  const markup = decimalRoundingMarkup({ supported: true });
  assert.match(opening(markup, 'roundingMode'), /data-field="roundingMode"/);
  assert.match(markup, /<option value="auto" selected>Auto<\/option>/);
  assert.match(markup, /<label[^>]*for="roundingMode">Zaokrąglanie<\/label>/);
  assert.match(opening(markup, 'rounding-custom-controls'), /\bhidden\b/);
  assert.match(opening(markup, 'roundingPlaces'), /\bdisabled\b/);
  assert.match(markup, /<label[^>]*for="roundingPlaces">Do ilu miejsc po przecinku<\/label>/);
  assert.match(opening(markup, 'rounding-preview'), /aria-live="polite"/);
  assert.match(opening(markup, 'rounding-details'), /^<details.*\bhidden\b/);
  assert.match(markup, /Zaokrąglenie dotyczy ilości na podanie\./);
});

test('only custom mode exposes precision and explicit mode wins over legacy snapshots', () => {
  for (const mode of ['auto', 'custom', 'off']) {
    const markup=decimalRoundingMarkup({supported:true,mode,enabled:true});
    assert.match(markup,new RegExp(`<option value="${mode}" selected>`));
    assert.equal(/\bhidden\b/.test(opening(markup,'rounding-custom-controls')),mode!=='custom');
    assert.equal(/\bdisabled\b/.test(opening(markup,'roundingPlaces')),mode!=='custom');
  }
  for(const [enabled,mode] of [[true,'custom'],[false,'off']])
    assert.match(decimalRoundingMarkup({supported:true,enabled}),new RegExp(`<option value="${mode}" selected>`));
});

test('zero precision remains a real selected choice and all four choices are available', () => {
  for (const places of [0, 1, 2, 3, '0', '3']) {
    const markup = decimalRoundingMarkup({ supported: true, enabled: true, places });
    assert.match(markup, /<option value="custom" selected>/);
    assert.doesNotMatch(opening(markup, 'roundingPlaces'), /\bdisabled\b/);
    const options = [...markup.matchAll(/<option value="(\d)"( selected)?>/g)];
    assert.deepEqual(options.map(option => Number(option[1])), [0, 1, 2, 3]);
    assert.deepEqual(options.filter(option => option[2]).map(option => Number(option[1])), [Number(places)]);
  }
});

test('a known rule with device divisions keeps Auto and Off while custom precision is disabled',()=>{
  const markup=decimalRoundingMarkup({supported:true,customSupported:false,mode:'auto'});
  assert.match(markup,/<option value="auto" selected>Auto/);
  assert.match(markup,/<option value="custom" disabled>Własne/);
  assert.match(markup,/<option value="off">Wyłączone/);
  assert.match(opening(markup,'roundingPlaces'),/\bdisabled\b/);
  assert.match(opening(markup,'rounding-custom-controls'),/\bhidden\b/);
});

test('invalid rounding precision falls back to one decimal place instead of adding options', () => {
  for (const places of [-1, 4, 1.5, NaN, Infinity, '', null, 'bad']) {
    const markup = decimalRoundingMarkup({ supported: true, places });
    assert.match(markup, /<option value="1" selected>/);
    assert.equal((markup.match(/<option value="[0-3]"/g) || []).length, 4);
  }
});

test('rounding unit text cannot insert markup', () => {
  const markup = decimalRoundingMarkup({ supported: true, unit: '<img src=x onerror="alert(1)">' });
  assert.doesNotMatch(markup, /<img/);
  assert.match(markup, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
});

test('empty basket offers a product picker without an actionable export', () => {
  const markup = prescriptionCartMarkup();
  assert.match(markup, /Koszyk jest pusty/);
  assert.match(markup, /Dane i koszyk pozostają w tej karcie\./);
  assert.match(button(markup, 'cart-next'), />Wybierz preparat<\/button>/);
  assert.equal(button(markup, 'cart-copy'), undefined);
  assert.equal(pre(markup), undefined);
});

test('basket exposes each stored item and exact edit/remove identifiers', () => {
  const markup = prescriptionCartMarkup({ ...cartOptions, items: [draft('rx-3'), draft('rx-8', 'Preparat B')] });
  assert.match(markup, /Dorosły · 70 kg/);
  assert.match(markup, /<ol[^>]*aria-label="Preparaty w koszyku"/);
  assert.match(markup, /cart-item-number" aria-hidden="true">1<\/span>/);
  assert.match(markup, /cart-item-number" aria-hidden="true">2<\/span>/);
  for (const id of ['rx-3', 'rx-8']) {
    assert.ok(button(markup, 'cart-edit', id));
    assert.ok(button(markup, 'cart-remove', id));
  }
  assert.match(button(markup, 'cart-remove', 'rx-8'), /aria-label="Usuń z koszyka: Preparat B"/);
  assert.match(markup, /10 ml · 2 × na dobę · 7 dni/);
});

test('stale warning belongs only to the changed item and blocks combined copying', () => {
  const markup = prescriptionCartMarkup({ ...cartOptions, items: [draft('rx-1'), draft('rx-2')], staleIds: ['rx-2'] });
  const first = /<li[^>]*data-cart-item-id="rx-1"[\s\S]*?<\/li>/.exec(markup)[0];
  const second = /<li[^>]*data-cart-item-id="rx-2"[\s\S]*?<\/li>/.exec(markup)[0];
  assert.doesNotMatch(first, /Dane pacjenta zmienione|is-stale/);
  assert.match(second, /Dane pacjenta zmienione/);
  assert.match(button(markup, 'cart-copy'), /\bdisabled\b/);
});

test('editing marker does not rewrite saved instructions or add warnings to other items', () => {
  const markup = prescriptionCartMarkup({ ...cartOptions, items: [draft('rx-1'), draft('rx-2')], editingId: 'rx-2' });
  assert.equal((markup.match(/W trakcie edycji/g) || []).length, 1);
  assert.match(markup, /class="cart-item is-editing" data-cart-item-id="rx-2"/);
  assert.equal(pre(markup), cartOptions.text);
  assert.doesNotMatch(markup, /Dane pacjenta zmienione/);
});

test('format controls preserve one accessible pressed selection', () => {
  for (const [mode, expected] of [['full', 'full'], ['ds', 'ds'], ['unknown', 'full']]) {
    const markup = prescriptionCartMarkup({ ...cartOptions, mode });
    for (const candidate of ['full', 'ds']) {
      assert.match(button(markup, 'cart-mode', candidate), new RegExp(`aria-pressed="${candidate === expected}"`));
    }
  }
});

test('copying is available only for ready non-demo text and the next action remains available', () => {
  const ready = prescriptionCartMarkup(cartOptions);
  assert.doesNotMatch(button(ready, 'cart-copy'), /\bdisabled\b/);
  for (const changes of [{ canCopy: false }, { canCopy: 'true' }, { demo: true }, { text: '' }, { text: '  \n ' }]) {
    const markup = prescriptionCartMarkup({ ...cartOptions, ...changes });
    assert.match(button(markup, 'cart-copy'), /\bdisabled\b/);
    assert.doesNotMatch(button(markup, 'cart-next'), /\bdisabled\b/);
  }
});

test('all patient, medicine, notice and output strings remain inert text', () => {
  const payload = '<img src=x onerror="alert(1)">&\'tail';
  const markup = prescriptionCartMarkup({
    ...cartOptions,
    patientLabel: payload,
    items: [{ ...draft(payload, payload), summary: payload }],
    notice: payload,
    text: `${payload}\n</pre><script>alert(1)</script>`,
  });
  assert.doesNotMatch(markup, /<img|<script|onerror="alert/);
  assert.match(markup, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;&amp;&#39;tail/);
  assert.match(pre(markup), /&lt;\/pre&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.equal((markup.match(/<pre\b/g) || []).length, 1);
  assert.equal((markup.match(/<\/pre>/g) || []).length, 1);
});

test('view construction leaves immutable basket inputs untouched', () => {
  const item = Object.freeze(draft());
  const items = Object.freeze([item]);
  const staleIds = Object.freeze(['rx-1']);
  const before = JSON.stringify({ items, staleIds });
  prescriptionCartMarkup({ ...cartOptions, items, staleIds });
  assert.equal(JSON.stringify({ items, staleIds }), before);
});
