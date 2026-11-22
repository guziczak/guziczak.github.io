import test from 'node:test';
import assert from 'node:assert/strict';
import { RENAL_STATE_DEFAULTS } from './renal-state.js';
import {
  createPrescriptionCart, savePrescriptionItem, completePrescriptionCartAge,
  patientContextKey, assessPrescriptionCart, prescriptionCartText,
} from './prescription-cart.js';

// Stored-output fixtures exercise cart contracts. Medical revalidation is
// supplied by the application and covered by its integration tests.
const patient = (patch = {}) => ({
  specialty: 'dental', patientType: 'adult', age: '', humanAgeUnit: 'years', weight: '70',
  renalStatus: 'unknown', humanCrCl: '', humanSerumCreatinine: '',
  species: '', vetAgeUnit: 'years', foodChainStatus: 'unknown',
  ...RENAL_STATE_DEFAULTS, ...patch,
});
function add(cart, patch = {}, product = 'augmentin') {
  const saved = savePrescriptionItem(cart, {
    valid: true, confirmed: true,
    snapshot: {
      ...patient(), drugId: product, formId: `${product}-form`, packageId: '70ml',
      regimenId: `${product}-source`, dose: '875', doseMode: 'fixed', frequency: '2', days: '5',
      roundingMode: 'auto', roundingPlaces: '1', confirmed: true, demo: false,
      sourceConfirmations: [], roundingPolicy: { id: 'saved-policy', revision: 'v1' },
      calculation: { singleUnits: 11, singleMg: 880, dailyMg: 1760,
        totalUnits: 110, packages: 2, packageSize: 70 },
      ...patch,
    },
    label: `${product} · zapisany preparat`,
    summary: '11 ml na podanie · 2 × na dobę · 5 dni · 2 op. × 70 ml',
    texts: { full: `Rp. ${product}\n2 op. po 70 ml\nD.S. 11 ml, 2 razy na dobę przez 5 dni.`,
      ds: 'D.S. 11 ml, 2 razy na dobę przez 5 dni.' },
  });
  assert.equal(saved.ok, true, saved.message);
  return saved.cart;
}
const withoutAge = ({ age, humanAgeUnit, ...rest }) => rest;
const unchangedTreatment = (candidate, { previousItem }) => {
  assert.notStrictEqual(candidate, previousItem.snapshot);
  assert.equal(Object.isFrozen(candidate), true);
  assert.equal(Object.isFrozen(candidate.calculation), true);
  assert.deepEqual(withoutAge(candidate), withoutAge(previousItem.snapshot));
  return { valid: true, unchanged: true };
};
const complete = (cart, currentState, revalidate = unchangedTreatment) =>
  completePrescriptionCartAge(cart, currentState, { revalidate });

test('a later age completes the earlier row without changing saved treatment or the active medicine', () => {
  const firstCart = add(createPrescriptionCart());
  const cart = add(firstCart, { age: '35', dose: '500', days: '3' }, 'metafen');
  const current = { ...patient({ age: '35' }), drugId: 'metafen', dose: '500', days: '3' };
  const original = structuredClone(cart), currentBefore = structuredClone(current);
  assert.deepEqual(assessPrescriptionCart(cart, current).staleIds, ['rx-1']);
  const calls = [];
  const result = complete(cart, current, (candidate, options) => {
    calls.push(options.previousItem.id);
    assert.equal(candidate.drugId, 'augmentin');
    assert.equal(candidate.age, '35');
    return unchangedTreatment(candidate, options);
  });
  assert.deepEqual(calls, ['rx-1']);
  assert.deepEqual(result.updatedIds, ['rx-1']);
  assert.deepEqual(result.cart.items.map(item => item.id), ['rx-1', 'rx-2']);
  assert.equal(result.cart.nextId, cart.nextId);
  const updated = result.cart.items[0], previous = cart.items[0];
  assert.notStrictEqual(updated, previous);
  assert.strictEqual(result.cart.items[1], cart.items[1]);
  assert.strictEqual(updated.texts, previous.texts);
  assert.equal(updated.summary, previous.summary);
  assert.equal(updated.productKey, previous.productKey);
  assert.deepEqual(updated.snapshot.calculation, previous.snapshot.calculation);
  assert.deepEqual(updated.snapshot.roundingPolicy, previous.snapshot.roundingPolicy);
  assert.equal(updated.patientKey, patientContextKey(current));
  assert.equal(updated.patientContext.age, 35);
  assert.equal(Object.isFrozen(result.cart), true);
  assert.equal(Object.isFrozen(updated), true);
  assert.equal(Object.isFrozen(updated.patientContext), true);
  for (const mode of ['full', 'ds']) assert.equal(prescriptionCartText(result.cart, current, { mode }).ok, true);
  assert.deepEqual(cart, original);
  assert.deepEqual(current, currentBefore);
});

test('all genuinely empty ages complete in place and a second completion is a no-op', () => {
  let cart = createPrescriptionCart();
  for (const [index, age] of ['', '  ', null, undefined].entries()) {
    cart = add(cart, { age }, `product-${index}`);
  }
  const current = patient({ age: '35,0' });
  const result = complete(cart, current);
  assert.deepEqual(result.updatedIds, ['rx-1', 'rx-2', 'rx-3', 'rx-4']);
  assert.equal(result.cart.nextId, 5);
  assert.ok(result.cart.items.every(item => item.snapshot.age === '35,0'));
  const repeated = complete(result.cart, { ...current, age: 35 }, () => assert.fail('Already completed ages need no callback'));
  assert.strictEqual(repeated.cart, result.cart);
  assert.deepEqual(repeated.updatedIds, []);
  assert.equal(assessPrescriptionCart(repeated.cart, current).canCopy, true);
});

test('an existing age, zero or malformed old value is never treated as missing', () => {
  for (const age of ['34', 35, '35,0', 0, '0', '-1', 'niepoprawny wiek']) {
    const cart = add(createPrescriptionCart(), { age });
    const result = complete(cart, patient({ age: '36' }), () => assert.fail('Existing age must not be overwritten'));
    assert.strictEqual(result.cart, cart);
    assert.deepEqual(result.updatedIds, []);
    assert.deepEqual(assessPrescriptionCart(result.cart, patient({ age: '36' })).staleIds, ['rx-1']);
  }
});

test('invalid or missing current ages and units do not call revalidation', () => {
  const cart = add(createPrescriptionCart());
  for (const patch of [
    ...[undefined, null, '', ' ', -1, NaN, Infinity, 'NaN', '35 lat'].map(age => ({ age })),
    ...[undefined, '', 'weeks', 'invalid'].map(humanAgeUnit => ({ age: '35', humanAgeUnit })),
  ]) {
    const result = complete(cart, patient(patch), () => assert.fail('Invalid age/unit cannot be completed'));
    assert.strictEqual(result.cart, cart);
    assert.deepEqual(result.updatedIds, []);
  }
});

test('age completion carries the supplied unit, including a zero age, to the validator', () => {
  for (const [age, humanAgeUnit] of [[0, 'days'], ['6,5', 'months'], ['35', 'years']]) {
    const cart = add(createPrescriptionCart());
    const current = patient({ age, humanAgeUnit });
    const result = complete(cart, current, (candidate, options) => {
      assert.equal(candidate.age, age);
      assert.equal(candidate.humanAgeUnit, humanAgeUnit);
      return unchangedTreatment(candidate, options);
    });
    assert.deepEqual(result.updatedIds, ['rx-1']);
    assert.equal(result.cart.items[0].patientKey, patientContextKey(current));
  }
});

test('other patient changes stay stale rather than being copied with the new age', () => {
  const cart = add(createPrescriptionCart());
  for (const patch of [
    { weight: '71' }, { patientType: 'child' }, { renalStatus: 'impaired' },
    { humanCrCl: '50' }, { humanSerumCreatinine: '1' }, { ignoreCrCl: false },
    { renalInputMode: 'calculate' },
  ]) {
    const current = patient({ age: '35', ...patch });
    const result = complete(cart, current, () => assert.fail('Other context changes require review'));
    assert.strictEqual(result.cart, cart);
    assert.deepEqual(result.updatedIds, []);
    assert.equal(prescriptionCartText(result.cart, current).ok, false);
  }
});

test('equivalent numeric patient inputs and another human specialty do not replace saved context', () => {
  const cart = add(createPrescriptionCart());
  const current = patient({ age: '35', weight: '70,00', specialty: 'cardio' });
  const result = complete(cart, current);
  assert.deepEqual(result.updatedIds, ['rx-1']);
  assert.equal(result.cart.items[0].snapshot.weight, '70');
  assert.equal(result.cart.items[0].snapshot.specialty, 'dental');
  assert.equal(assessPrescriptionCart(result.cart, current).canCopy, true);
});

test('veterinary contexts and demo calculations cannot receive automatic age completion', () => {
  const humanCart = add(createPrescriptionCart());
  const animal = patient({ specialty: 'veterinary', species: 'dog' });
  const animalCart = add(createPrescriptionCart(), animal);
  const previousDemo = { ...humanCart.items[0].snapshot, demo: true };
  const demoCart = { ...humanCart, items: [{ ...humanCart.items[0], snapshot: previousDemo,
    patientKey: patientContextKey(previousDemo) }] };
  for (const [cart, current] of [
    [humanCart, { ...animal, age: '5' }],
    [animalCart, { ...animal, age: '5' }],
    [animalCart, patient({ age: '35' })],
    [humanCart, patient({ age: '35', demo: true })],
    [demoCart, patient({ age: '35' })],
  ]) {
    const result = complete(cart, current, () => assert.fail('Unsupported context must not call the validator'));
    assert.strictEqual(result.cart, cart);
    assert.deepEqual(result.updatedIds, []);
  }
});

test('a mismatched saved fingerprint or group cannot be repaired by age completion', () => {
  const original = add(createPrescriptionCart());
  for (const patch of [
    { patientKey: 'fabricated' },
    { snapshot: { ...original.items[0].snapshot, weight: '71' } },
    { groupKey: 'animal:dog' },
  ]) {
    const cart = { ...original, items: [{ ...original.items[0], ...patch }] };
    const result = complete(cart, patient({ age: '35' }), () => assert.fail('Invalid baseline cannot be refreshed'));
    assert.strictEqual(result.cart, cart);
    assert.deepEqual(result.updatedIds, []);
  }
});

test('only an explicit synchronous valid-and-unchanged proof can update a row', () => {
  const cart = add(createPrescriptionCart()), current = patient({ age: '35' });
  const callbacks = [
    undefined, () => undefined, () => null, () => true,
    () => ({ valid: true }), () => ({ unchanged: true }),
    () => ({ valid: false, unchanged: true }), () => ({ valid: true, unchanged: false }),
    () => ({ valid: 'true', unchanged: true }), () => ({ valid: true, unchanged: 'true' }),
    () => ({ valid: true, unchanged: true, requiresReview: true }),
    () => { throw new Error('Revalidation failed'); },
    () => Promise.resolve({ valid: true, unchanged: true }),
    () => Promise.reject(new Error('Async validation is not supported')),
    () => ({ valid: true, unchanged: true, then() { assert.fail('Do not execute a thenable'); } }),
  ];
  for (const revalidate of callbacks) {
    const result = completePrescriptionCartAge(cart, current, { revalidate });
    assert.strictEqual(result.cart, cart);
    assert.deepEqual(result.updatedIds, []);
    assert.equal(prescriptionCartText(result.cart, current).ok, false);
  }
});

test('candidate mutation cannot change a saved dose or its calculated quantities', () => {
  const cart = add(createPrescriptionCart()), before = structuredClone(cart);
  for (const revalidate of [
    candidate => { candidate.dose = '1000'; return { valid: true, unchanged: true }; },
    candidate => { candidate.calculation.singleUnits = 12; return { valid: true, unchanged: true }; },
  ]) {
    const result = complete(cart, patient({ age: '35' }), revalidate);
    assert.strictEqual(result.cart, cart);
    assert.deepEqual(result.updatedIds, []);
    assert.deepEqual(cart, before);
  }
});

test('partial completion retains blocked peers and their export gate', () => {
  let cart = add(createPrescriptionCart());
  cart = add(cart, {}, 'second-product');
  const current = patient({ age: '35' });
  const result = complete(cart, current, (candidate, options) => options.previousItem.id === 'rx-1'
    ? unchangedTreatment(candidate, options) : { valid: true, unchanged: false });
  assert.deepEqual(result.updatedIds, ['rx-1']);
  assert.strictEqual(result.cart.items[1], cart.items[1]);
  assert.deepEqual(assessPrescriptionCart(result.cart, current).staleIds, ['rx-2']);
  assert.equal(prescriptionCartText(result.cart, current).ok, false);
  const changed = complete(result.cart, patient({ age: '36' }), () => ({ valid: false, unchanged: true }));
  assert.strictEqual(changed.cart, result.cart);
  assert.deepEqual(assessPrescriptionCart(changed.cart, patient({ age: '36' })).staleIds, ['rx-1', 'rx-2']);
});
