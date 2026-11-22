import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createPrescriptionCart, savePrescriptionItem, completePrescriptionCartAge,
  assessPrescriptionCart, prescriptionCartText } from './prescription-cart.js';

// Run the actual input handler and cart entry points. This tests commit timing;
// the real age/rounding/clinical evaluator has its own catalogue-based tests.
const app = await readFile(new URL('app.js', import.meta.url), 'utf8');
const functions = ['completeCartAge', 'cartDialog', 'copyCart'].map(name => {
  const code = app.match(new RegExp(`^function ${name}\\([^]*?^\\}`, 'm'))?.[0];
  assert.ok(code, name);
  return code;
}).join('\n');
const inputStart = app.indexOf("$('#app').addEventListener('input',");
const inputEnd = app.indexOf("$('#app').addEventListener('change',", inputStart);
assert.ok(inputStart >= 0 && inputEnd > inputStart);

function fixture({ accept = true } = {}) {
  const patient = { specialty: 'dental', patientType: 'adult', weight: '70',
    age: '', humanAgeUnit: 'years', renalCalculationReviewed: false };
  const saved = savePrescriptionItem(createPrescriptionCart(), {
    snapshot: { ...patient, drugId: 'first', formId: 'first-form' },
    label: 'Pierwszy preparat', summary: 'Zapisane dawkowanie',
    texts: { full: 'Rp. Pierwszy preparat\nZapisana dawka', ds: 'Zapisana dawka' },
    valid: true, confirmed: true,
  });
  assert.equal(saved.ok, true);
  const state = { ...patient, drugId: 'second', formId: 'second-form', regimenId: '',
    dose: '500', frequency: '1', days: '3', confirmed: true };
  let onInput, shown, copied;
  const checkedAges = [];
  const env = { state, prescriptionCart: saved.cart, cartMode: 'full', editingCartId: null,
    completePrescriptionCartAge, assessPrescriptionCart, prescriptionCartText,
    revalidatePrescriptionAge: snapshot => {
      checkedAges.push(snapshot.age);
      return { valid: accept, unchanged: accept };
    },
    $: selector => selector === '#app'
      ? { addEventListener: (event, callback) => { assert.equal(event, 'input'); onInput = callback; } }
      : { open: true },
    dirty: () => { state.confirmed = false; }, updateResult: () => {},
    clearSourceConfirmations: () => {}, cartPatientLabel: () => `${state.age} lat`,
    prescriptionCartMarkup: options => { shown = options; return ''; },
    openDialog: () => {}, copyPreparedText: options => { copied = options.text; },
  };
  runInNewContext(functions + '\n' + app.slice(inputStart, inputEnd), env);
  return { env, state, saved, checkedAges,
    input: value => onInput({ target: { id: 'age', tagName: 'INPUT', dataset: { field: 'age' }, value } }),
    get shown() { return shown; }, get copied() { return copied; } };
}

test('typing 3 then 35 does not commit the first digit to an earlier cart item', () => {
  const f = fixture();
  f.input('3');
  f.input('35');
  assert.deepEqual(f.checkedAges, []);
  assert.strictEqual(f.env.prescriptionCart, f.saved.cart);
  const current = structuredClone(f.state);
  f.env.cartDialog();
  assert.deepEqual(f.checkedAges, ['35']);
  assert.equal(f.env.prescriptionCart.items[0].snapshot.age, '35');
  assert.equal(f.shown.canCopy, true);
  assert.deepEqual(f.shown.staleIds, []);
  assert.deepEqual(f.state, current, 'Opening the cart cannot edit the active medication');
  assert.equal(f.saved.cart.items[0].snapshot.age, '');
});

test('the picker final input is sufficient before copying without a separate change event', () => {
  const f = fixture();
  f.input('35');
  assert.deepEqual(f.checkedAges, []);
  f.env.copyCart({ closest: () => ({ isConnected: true }) });
  assert.deepEqual(f.checkedAges, ['35']);
  assert.equal(f.copied, f.saved.item.texts.full);
  assert.equal(f.env.prescriptionCart.items[0].snapshot.age, '35');
});

test('a failed automatic check retains the stale marker and blocks the actual copy entry point', () => {
  const f = fixture({ accept: false });
  f.input('35');
  f.env.copyCart();
  assert.equal(f.copied, undefined);
  assert.strictEqual(f.env.prescriptionCart, f.saved.cart);
  assert.equal(f.shown.canCopy, false);
  assert.deepEqual(f.shown.staleIds, [f.saved.item.id]);
});
