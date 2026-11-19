import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATIENT_CONTEXT_FIELDS, pickPatientContext, patientContextKey, prescriptionProductKey,
  createPrescriptionCart, savePrescriptionItem, removePrescriptionItem,
  assessPrescriptionCart, prescriptionCartText, preparePrescriptionEdit,
} from './prescription-cart.js';

const patient = (patch = {}) => ({ specialty: 'dental', patientType: 'child', age: '5',
  humanAgeUnit: 'years', weight: '20', renalStatus: 'unknown', humanCrCl: '', humanSerumCreatinine: '',
  species: '', vetAgeUnit: 'years', foodChainStatus: 'unknown', ...patch });
const draft = (patch = {}, snapshotPatch = {}) => ({
  valid: true, confirmed: true, demo: false,
  snapshot: { ...patient(), drugId: 'amoxicillin-clavulanate', formId: 'augmentin-400-57',
    packageId: '35ml', dose: '45', doseMode: 'perKgDay', frequency: '2', days: '7',
    roundingStep: '', confirmed: true, ...snapshotPatch },
  label: 'Augmentin · 400 + 57 mg/5 ml', summary: '5,625 ml · 2 × na dobę · 7 dni',
  texts: { full: 'Rp. Augmentin\n3 op. po 35 ml\nD.S. 5,625 ml, 2 razy na dobę przez 7 dni.',
    ds: 'D.S. 5,625 ml, 2 razy na dobę przez 7 dni.' }, ...patch,
});
const added = (...args) => {
  const outcome = savePrescriptionItem(...args);
  assert.equal(outcome.ok, true, outcome.message);
  return outcome.cart;
};

test('basket starts empty and cannot export an empty prescription', () => {
  const cart = createPrescriptionCart();
  assert.equal(assessPrescriptionCart(cart, patient()).canCopy, false);
  assert.deepEqual(prescriptionCartText(cart, patient()).staleIds, []);
  assert.equal(prescriptionCartText(cart, patient()).text, '');
});

test('invalid, unconfirmed and demo calculations never enter the basket', () => {
  const cart = createPrescriptionCart();
  for (const patch of [{ valid: false }, { confirmed: false }, { valid: 'true' }, { demo: true }]) {
    const outcome = savePrescriptionItem(cart, draft(patch));
    assert.equal(outcome.ok, false);
    assert.equal(outcome.cart, cart);
  }
  assert.equal(savePrescriptionItem(cart, draft({}, { demo: true })).ok, false);
  assert.equal(cart.items.length, 0);
});

test('saved input, rounding and text are independent immutable snapshots', () => {
  const input = draft({}, { decimalRoundingEnabled: true, decimalRoundingPlaces: 1,
    extraData: { nested: ['initial'] } });
  const original = createPrescriptionCart();
  const cart = added(original, input);
  input.snapshot.dose = '999';
  input.snapshot.extraData.nested[0] = 'changed';
  input.texts.full = 'overwritten';
  assert.equal(original.items.length, 0);
  assert.equal(cart.items[0].snapshot.dose, '45');
  assert.deepEqual(cart.items[0].snapshot.extraData, { nested: ['initial'] });
  assert.equal(cart.items[0].snapshot.decimalRoundingPlaces, 1);
  assert.match(cart.items[0].texts.full, /^Rp\. Augmentin/);
  assert.throws(() => { cart.items[0].snapshot.dose = '1'; }, TypeError);
  assert.throws(() => { cart.items.push(cart.items[0]); }, TypeError);
});

test('package changes do not duplicate or sum an existing product/form', () => {
  const cart = added(createPrescriptionCart(), draft());
  const duplicate = savePrescriptionItem(cart, draft({}, { packageId: '70ml', dose: '35' }));
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, 'duplicate');
  assert.equal(duplicate.existingId, 'rx-1');
  assert.equal(duplicate.cart, cart);
  assert.equal(cart.items[0].snapshot.dose, '45');
});

test('a different form is separate and both full texts keep their quantities', () => {
  const first = draft();
  const second = draft({ label: 'Ospamox 500 mg', texts: {
    full: 'Rp. Ospamox 500 mg\n1 op. po 16 tabl.\nD.S. Odrębny zapis.', ds: 'D.S. Odrębny zapis.'
  } }, { drugId: 'amoxicillin', formId: 'ospamox-500' });
  const cart = added(added(createPrescriptionCart(), first), second);
  assert.equal(cart.items.length, 2);
  assert.equal(prescriptionCartText(cart, patient()).text, first.texts.full + '\n\n' + second.texts.full);
  assert.equal(prescriptionCartText(cart, patient(), { mode: 'ds' }).text,
    first.label + '\n' + first.texts.ds + '\n\n' + second.label + '\n' + second.texts.ds);
});

test('editing replaces the same id and preserves item order and next id', () => {
  let cart = added(createPrescriptionCart(), draft());
  cart = added(cart, draft({ label: 'Inny preparat' }, { drugId: 'other', formId: 'other-10' }));
  const updated = savePrescriptionItem(cart, draft({ summary: 'Nowa dawka' }, { dose: '35' }), { replaceId: 'rx-1' });
  assert.equal(updated.ok, true);
  assert.equal(updated.updated, true);
  assert.deepEqual(updated.cart.items.map(item => item.id), ['rx-1', 'rx-2']);
  assert.equal(updated.cart.nextId, 3);
  assert.equal(updated.cart.items[0].snapshot.dose, '35');
  assert.equal(cart.items[0].snapshot.dose, '45');
  assert.equal(savePrescriptionItem(cart, draft(), { replaceId: 'gone' }).code, 'missing-item');
});

test('editing cannot turn one row into a duplicate of another row', () => {
  let cart = added(createPrescriptionCart(), draft());
  cart = added(cart, draft({ label: 'Inny preparat' }, { drugId: 'other', formId: 'other-10' }));
  const outcome = savePrescriptionItem(cart, draft(), { replaceId: 'rx-2' });
  assert.equal(outcome.code, 'duplicate');
  assert.equal(outcome.existingId, 'rx-1');
});

test('removal is reversible by adding again and does not reuse another item id', () => {
  const cart = added(createPrescriptionCart(), draft());
  const removed = removePrescriptionItem(cart, 'rx-1');
  assert.equal(removed.items.length, 0);
  assert.equal(cart.items.length, 1);
  assert.equal(removePrescriptionItem(cart, 'missing'), cart);
  assert.equal(added(removed, draft()).items[0].id, 'rx-2');
});

test('changing patient parameters makes reviewed rows stale and blocks batch output', () => {
  const cart = added(createPrescriptionCart(), draft());
  for (const patch of [
    { weight: '21' }, { age: '6' }, { humanAgeUnit: 'months' }, { patientType: 'adult' },
    { renalStatus: 'impaired' }, { humanCrCl: '30' },
  ]) {
    const assessment = assessPrescriptionCart(cart, patient(patch));
    assert.equal(assessment.canCopy, false, JSON.stringify(patch));
    assert.deepEqual(assessment.staleIds, ['rx-1']);
    assert.equal(prescriptionCartText(cart, patient(patch)).text, '');
  }
  assert.equal(assessPrescriptionCart(cart, patient()).canCopy, true);
});

test('dose changes in the active calculator do not alter or stale a saved row', () => {
  const cart = added(createPrescriptionCart(), draft());
  assert.equal(assessPrescriptionCart(cart, patient({ drugId: 'other', dose: '100', days: '3' })).canCopy, true);
  assert.equal(cart.items[0].snapshot.days, '7');
});

test('the same human patient can collect prescriptions from dental and cardio specialties', () => {
  const dentalPatient = patient({ patientType: 'adult', age: '45', weight: '70' });
  const cardioPatient = { ...dentalPatient, specialty: 'cardio' };
  let cart = added(createPrescriptionCart(), draft({}, dentalPatient));
  cart = added(cart, draft({ label: 'Preparat kardiologiczny', texts: {
    full: 'Rp. Preparat kardiologiczny\nD.S. Odrębny zapis.', ds: 'D.S. Odrębny zapis.'
  } }, { ...cardioPatient, drugId: 'cardio-drug', formId: 'cardio-form' }));
  for (const context of [dentalPatient, cardioPatient]) {
    assert.equal(assessPrescriptionCart(cart, context).canCopy, true);
    const output = prescriptionCartText(cart, context);
    assert.equal(output.ok, true);
    assert.match(output.text, /Rp\. Augmentin/);
    assert.match(output.text, /Rp\. Preparat kardiologiczny/);
  }
  assert.equal(patientContextKey(dentalPatient), patientContextKey(cardioPatient));
  assert.equal(pickPatientContext(cardioPatient).specialty, 'cardio');
  assert.equal(cart.items[0].snapshot.specialty, 'dental');
  assert.equal(cart.items[1].snapshot.specialty, 'cardio');
  assert.deepEqual(assessPrescriptionCart(cart, { ...cardioPatient, weight: '71' }).staleIds, ['rx-1', 'rx-2']);
  assert.equal(prescriptionCartText(cart, { ...cardioPatient, weight: '71' }).text, '');
});

test('all stale rows must be recalculated before the batch becomes copyable', () => {
  let cart = added(createPrescriptionCart(), draft());
  cart = added(cart, draft({ label: 'Inny preparat' }, { drugId: 'other', formId: 'other-10' }));
  const changedPatient = patient({ weight: '22' });
  cart = added(cart, draft({}, { weight: '22', dose: '35' }), { replaceId: 'rx-1' });
  assert.deepEqual(assessPrescriptionCart(cart, changedPatient).staleIds, ['rx-2']);
  cart = added(cart, draft({ label: 'Inny preparat' }, {
    drugId: 'other', formId: 'other-10', weight: '22'
  }), { replaceId: 'rx-2' });
  assert.equal(assessPrescriptionCart(cart, changedPatient).canCopy, true);
});

test('switching adult/child allows explicit replacement while retaining stale peers', () => {
  let cart = added(createPrescriptionCart(), draft());
  cart = added(cart, draft({ label: 'Inny preparat' }, { drugId: 'other', formId: 'other-10' }));
  cart = added(cart, draft({}, { patientType: 'adult', age: '35', weight: '70' }), { replaceId: 'rx-1' });
  assert.deepEqual(assessPrescriptionCart(cart, patient({ patientType: 'adult', age: '35', weight: '70' })).staleIds, ['rx-2']);
});

test('human and veterinary calculations or different animal species cannot mix', () => {
  const humanCart = added(createPrescriptionCart(), draft());
  const animalDraft = draft({ label: 'Preparat weterynaryjny' }, {
    specialty: 'veterinary', species: 'dog', drugId: 'vet-drug', formId: 'vet-form'
  });
  assert.equal(savePrescriptionItem(humanCart, animalDraft).code, 'patient-group-mismatch');
  const animalCart = added(createPrescriptionCart(), animalDraft);
  assert.equal(savePrescriptionItem(animalCart, draft()).code, 'patient-group-mismatch');
  assert.equal(savePrescriptionItem(animalCart, draft({ label: 'Dla kota' }, {
    specialty: 'veterinary', species: 'cat', drugId: 'cat-drug', formId: 'cat-form'
  })).code, 'patient-group-mismatch');
});

test('veterinary age units and food-chain status participate in staleness', () => {
  const context = patient({ specialty: 'veterinary', species: 'horse', weight: '500', age: '7', foodChainStatus: 'excluded' });
  const cart = added(createPrescriptionCart(), draft({}, context));
  assert.equal(assessPrescriptionCart(cart, { ...context, vetAgeUnit: 'months' }).canCopy, false);
  assert.equal(assessPrescriptionCart(cart, { ...context, foodChainStatus: 'unknown' }).canCopy, false);
  assert.equal(assessPrescriptionCart(cart, { ...context, renalStatus: 'impaired' }).canCopy, true);
});

test('normalization prevents false stale warnings for equivalent numeric entry', () => {
  const baseline = patientContextKey(patient());
  assert.equal(patientContextKey(patient({ age: 5, weight: '20,000' })), baseline);
  assert.notEqual(patientContextKey(patient({ age: '', weight: '20' })), baseline);
  assert.notEqual(patientContextKey(patient({ age: '0', weight: '20' })), baseline);
  assert.notEqual(patientContextKey(patient({ weight: 'invalid' })), baseline);
});

test('patient context can be carried over without overwriting the selected drug/dose', () => {
  const current = { ...patient(), dose: '45', drugId: 'a', formId: 'a-form' };
  const carried = pickPatientContext(current);
  assert.deepEqual(Object.keys(carried).sort(), [...PATIENT_CONTEXT_FIELDS].sort());
  assert.equal(carried.weight, '20');
  assert.equal(Object.hasOwn(carried, 'dose'), false);
  assert.equal(Object.hasOwn(carried, 'drugId'), false);
});

test('custom products distinguish strength but ignore pack size', () => {
  const custom = { custom: true, customName: '  Lek   własny ', customForm: 'solution',
    customConcentration: '400', customVolume: '5', customPack: '35' };
  assert.equal(prescriptionProductKey(custom), prescriptionProductKey({
    ...custom, customName: 'lek własny', customPack: '70', customConcentration: '400,0'
  }));
  assert.notEqual(prescriptionProductKey(custom), prescriptionProductKey({ ...custom, customConcentration: '200' }));
});

test('invalid snapshots and incomplete text return actionable failure instead of throwing', () => {
  const cart = createPrescriptionCart();
  const cyclic = draft();
  cyclic.snapshot.circular = cyclic.snapshot;
  for (const input of [cyclic, draft({}, { nonFinite: Infinity }), draft({ snapshot: null }),
    draft({ texts: { full: 'Rp.', ds: '' } }), draft({ label: '' })]) {
    const result = savePrescriptionItem(cart, input);
    assert.equal(result.ok, false);
    assert.ok(result.message);
    assert.equal(result.cart, cart);
  }
});

test('prototype fields are never copied into a saved editable state', () => {
  const input = draft();
  input.snapshot = { ...input.snapshot, ...JSON.parse('{"__proto__":{"polluted":true},"constructor":"bad","prototype":"bad"}') };
  const cart = added(createPrescriptionCart(), input);
  assert.equal(Object.hasOwn(cart.items[0].snapshot, '__proto__'), false);
  assert.equal(Object.hasOwn(cart.items[0].snapshot, 'constructor'), false);
  assert.equal({}.polluted, undefined);
});

test('unsupported output mode and demonstration context cannot produce a prescription', () => {
  const cart = added(createPrescriptionCart(), draft());
  assert.equal(prescriptionCartText(cart, patient(), { mode: 'unknown' }).ok, false);
  assert.equal(prescriptionCartText(cart, patient({ demo: true })).text, '');
});

test('editing retains current patient values and restores the saved product specialty', () => {
  const cart = added(createPrescriptionCart(), draft({}, {
    regimenId: 'child-augmentin', decimalRoundingEnabled: true, decimalRoundingPlaces: 2,
    roundingStep: '0.01',
  }));
  const current = { ...patient({ specialty: 'cardio', age: '6', weight: '22',
    humanAgeUnit: 'years', renalStatus: 'impaired', humanCrCl: '50' }),
    drugId: 'another-product', dose: '100', days: '3', confirmed: true, demo: true };
  const before = structuredClone(current);
  const result = preparePrescriptionEdit(cart.items[0], current);
  assert.equal(result.ok, true);
  assert.equal(result.state.specialty, 'dental');
  assert.equal(result.state.drugId, 'amoxicillin-clavulanate');
  assert.equal(result.state.formId, 'augmentin-400-57');
  assert.equal(result.state.packageId, '35ml');
  assert.equal(result.state.regimenId, 'child-augmentin');
  assert.equal(result.state.dose, '45');
  assert.equal(result.state.days, '7');
  assert.equal(result.state.roundingStep, '0.01');
  assert.equal(result.state.decimalRoundingEnabled, true);
  assert.equal(result.state.decimalRoundingPlaces, 2);
  assert.equal(result.state.weight, '22');
  assert.equal(result.state.age, '6');
  assert.equal(result.state.renalStatus, 'impaired');
  assert.equal(result.state.humanCrCl, '50');
  assert.equal(result.state.confirmed, false);
  assert.equal(result.state.demo, false);
  result.state.dose = '35';
  assert.equal(cart.items[0].snapshot.dose, '45');
  assert.equal(cart.items[0].snapshot.weight, '20');
  assert.deepEqual(current, before);
});

test('edit restoration does not restore cleared patient values or reject adult/child transitions', () => {
  const cart = added(createPrescriptionCart(), draft());
  const current = patient({ patientType: 'adult', age: '', weight: '', humanAgeUnit: 'months' });
  const result = preparePrescriptionEdit(cart.items[0], current);
  assert.equal(result.ok, true);
  assert.equal(result.state.patientType, 'adult');
  assert.equal(result.state.age, '');
  assert.equal(result.state.weight, '');
  assert.equal(result.state.humanAgeUnit, 'months');
  assert.equal(result.state.regimenId, cart.items[0].snapshot.regimenId);
  const missing = preparePrescriptionEdit(cart.items[0], { specialty: 'dental', patientType: 'adult' });
  assert.equal(missing.state.age, '');
  assert.equal(missing.state.weight, '');
});

test('editing never moves a saved dose between human and animal or different species', () => {
  const humanItem = added(createPrescriptionCart(), draft()).items[0];
  const dogContext = patient({ specialty: 'veterinary', species: 'dog' });
  const dogItem = added(createPrescriptionCart(), draft({}, dogContext)).items[0];
  for (const [item, context] of [
    [humanItem, dogContext], [dogItem, patient()],
    [dogItem, { ...dogContext, species: 'cat' }],
  ]) {
    const result = preparePrescriptionEdit(item, context);
    assert.equal(result.ok, false);
    assert.ok(result.message);
    assert.equal(Object.hasOwn(result, 'state'), false);
  }
  const sameSpecies = preparePrescriptionEdit(dogItem, { ...dogContext, weight: '24', vetAgeUnit: 'months' });
  assert.equal(sameSpecies.ok, true);
  assert.equal(sameSpecies.state.weight, '24');
  assert.equal(sameSpecies.state.vetAgeUnit, 'months');
  assert.equal(preparePrescriptionEdit(null, patient()).ok, false);
});
