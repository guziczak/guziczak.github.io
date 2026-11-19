import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDIO_ANTICOAGULANT_REGIMENS } from './cardio-anticoagulant-regimens.js';
import { CARDIO_MAINTENANCE_REGIMENS } from './cardio-maintenance-regimens.js';
import { availableHumanRegimens, resolveHumanRegimen } from './human-regimen-engine.js';
import { editableHumanSource, sourceInitialValues } from './regimen-edit.js';
import {
  createPrescriptionCart, savePrescriptionItem, assessPrescriptionCart,
  prescriptionCartText, patientContextKey, preparePrescriptionEdit,
} from './prescription-cart.js';

const find = id => {
  const source = [...CARDIO_ANTICOAGULANT_REGIMENS, ...CARDIO_MAINTENANCE_REGIMENS]
    .find(item => item.id === `cardio-${id}`);
  assert.ok(source, id);
  return source;
};
const context = (source, patch = {}) => ({
  formId: source.formIds[0], specialty: 'cardio', patientType: 'adult',
  age: 80, ageUnit: 'years', weight: 70, serumCreatinine: 1.49,
  crcl: 80, renalStatus: 'unknown', dose: source.dose, frequency: source.frequency,
  days: source.fixedDays ?? 30,
  sourceConfirmations: (source.selectionRequirements || []).map(item => item.id),
  ...patch,
});
const state = (source, patch = {}) => ({
  specialty: 'cardio', patientType: 'adult', age: '80', humanAgeUnit: 'years',
  weight: '70', renalStatus: 'unknown', humanCrCl: '80', humanSerumCreatinine: '1,49',
  drugId: 'apixaban', formId: source.formIds[0], sourceRegimenId: source.id,
  doseMode: source.doseMode, dose: String(source.dose), frequency: String(source.frequency),
  days: '30', sourceConfirmations: source.selectionRequirements.map(item => item.id),
  confirmed: true, demo: false, ...patch,
});
const saveReviewed = snapshot => {
  const outcome = savePrescriptionItem(createPrescriptionCart(), {
    valid: true, confirmed: true, snapshot, label: 'Eliquis 5 mg',
    texts: { full: 'Rp. Apixabanum\nEliquis 5 mg\nD.S. Zapis potwierdzonego schematu.',
      ds: 'D.S. Zapis potwierdzonego schematu.' },
  });
  assert.equal(outcome.ok, true, outcome.message);
  return outcome;
};

test('CrCl 60 belongs to the normal ramipril band, while malformed CrCl never passes either band', () => {
  const reduced = find('ramipril-hypertension-5-crcl10to60');
  const normal = find('ramipril-hypertension-5-crcl-ge60');
  for (const [crcl, reducedValid, normalValid] of [
    [9.999, false, false], [10, true, false], [59.999, true, false],
    [60, false, true], [60.001, false, true],
  ]) {
    assert.equal(resolveHumanRegimen(reduced, context(reduced, { crcl })).valid, reducedValid, `reduced ${crcl}`);
    assert.equal(resolveHumanRegimen(normal, context(normal, { crcl })).valid, normalValid, `normal ${crcl}`);
  }
  for (const source of [reduced, normal]) {
    for (const crcl of [undefined, null, '', NaN, Infinity, -Infinity, '60', false, [], {}, 0, -1]) {
      const result = resolveHumanRegimen(source, context(source, { crcl, renalStatus: 'normal', egfr: 90 }));
      assert.equal(result.valid, false, `${source.id}: ${String(crcl)}`);
      assert.ok(result.requirements.includes('crcl'));
    }
  }
});

test('new clinical metadata fails closed on invalid bounds, fields, flags and sparse requirements', () => {
  const source = find('ramipril-hypertension-5-crcl10to60');
  const patches = [
    { maxCrCl: NaN }, { maxCrCl: Infinity }, { maxCrCl: '60' },
    { minCrCl: 61, maxCrCl: 60 }, { minCrCl: 60, maxCrCl: 60 },
    { maxCrCl: undefined, maxCrClExclusive: true },
    { requireCrCl: 'true' }, { lockSourceValues: 'true' },
    { patientFields: ['eGFR'] },
    { selectionRequirements: [null] },
    { selectionRequirements: [{ id: 'same', label: 'A' }, { id: 'same', label: 'B' }] },
    // An array hole must not silently remove a clinical condition from validation.
    { selectionRequirements: Array(1) },
  ];
  for (const patch of patches) {
    const malformed = { ...source, ...patch };
    const input = context(source, { crcl: 40, sourceConfirmations: [] });
    assert.deepEqual(availableHumanRegimens([malformed], input), [], Object.keys(patch).join(','));
    assert.equal(resolveHumanRegimen(malformed, input).valid, false, Object.keys(patch).join(','));
  }
});

test('the integrated apixaban resolver changes eligibility at 1.5 mg/dl and rejects malformed measurements', () => {
  const standard = find('eliquis-nvaf-standard');
  const reduced = find('eliquis-nvaf-two-criteria');
  // At age 80 and mass 70 kg, serum creatinine supplies the second criterion.
  for (const [serumCreatinine, standardValid, reducedValid] of [
    [1.499, true, false], [1.5, false, true], [1.501, false, true],
  ]) {
    assert.equal(resolveHumanRegimen(standard, context(standard, { serumCreatinine })).valid, standardValid);
    assert.equal(resolveHumanRegimen(reduced, context(reduced, { serumCreatinine })).valid, reducedValid);
  }
  for (const serumCreatinine of [undefined, null, '', NaN, Infinity, -1, 0, '1.5', '133 µmol/l', false, [], {}]) {
    for (const source of [standard, reduced]) {
      const result = resolveHumanRegimen(source, context(source, { serumCreatinine, egfr: 90 }));
      assert.equal(result.valid, false, `${source.id}: ${String(serumCreatinine)}`);
      assert.ok(result.requirements.includes('serumCreatinine'));
    }
  }
  assert.equal(resolveHumanRegimen(standard, context(standard, { age: 80 * 365, ageUnit: 'days' })).valid, false);
  assert.equal(resolveHumanRegimen(reduced, context(reduced,
    { age: 960, ageUnit: 'months', serumCreatinine: 1.5 })).valid, true);
});

test('explicit conditions and locked doses stay authoritative even when numeric overrides are enabled', () => {
  const source = find('eliquis-nvaf-standard');
  const valid = context(source);
  assert.equal(resolveHumanRegimen(source, valid, { allowNumericOverrides: true }).valid, true);
  for (const sourceConfirmations of [undefined, null, '', valid.sourceConfirmations.join(','),
    new Set(valid.sourceConfirmations), [], valid.sourceConfirmations.slice(1), ['unrelated']]) {
    assert.equal(resolveHumanRegimen(source, { ...valid, sourceConfirmations }, { allowNumericOverrides: true }).valid, false);
  }
  for (const patch of [{ dose: 2.5 }, { frequency: 1 }, { dose: NaN }, { frequency: Infinity }]) {
    assert.equal(resolveHumanRegimen(source, { ...valid, ...patch }, { allowNumericOverrides: true }).valid, false);
  }
  assert.equal(editableHumanSource(source), false);
  assert.equal(sourceInitialValues(source), null);
});

test('crossing the creatinine threshold blocks the saved prescription and resets its conditions on editing', () => {
  const source = find('eliquis-nvaf-standard');
  const snapshot = state(source);
  assert.equal(resolveHumanRegimen(source, context(source)).valid, true);
  const { cart, item } = saveReviewed(snapshot);
  assert.equal(prescriptionCartText(cart, snapshot).ok, true);

  const changed = { ...snapshot, humanSerumCreatinine: '1,50' };
  assert.notEqual(patientContextKey(changed), item.patientKey);
  assert.deepEqual(assessPrescriptionCart(cart, changed).staleIds, [item.id]);
  for (const mode of ['full', 'ds']) {
    const exported = prescriptionCartText(cart, changed, { mode });
    assert.equal(exported.ok, false);
    assert.equal(exported.text, '');
  }
  const editing = preparePrescriptionEdit(item, changed);
  assert.equal(editing.ok, true);
  assert.equal(editing.state.humanSerumCreatinine, '1,50');
  assert.deepEqual(editing.state.sourceConfirmations, []);
  assert.equal(editing.state.confirmed, false);
  assert.equal(resolveHumanRegimen(source, context(source, { serumCreatinine: 1.5,
    sourceConfirmations: editing.state.sourceConfirmations })).valid, false);
  assert.equal(item.snapshot.humanSerumCreatinine, '1,49');
  assert.equal(item.snapshot.confirmed, true);
});

test('format-only patient edits preserve the fingerprint; clinical and malformed edits invalidate it', () => {
  const source = find('eliquis-nvaf-standard');
  const snapshot = state(source);
  const { cart, item } = saveReviewed(snapshot);
  const samePatient = { ...snapshot, humanSerumCreatinine: ' 1.490 ', age: '80.0', weight: '70,0', humanCrCl: '80.00' };
  assert.equal(patientContextKey(samePatient), item.patientKey);
  assert.equal(assessPrescriptionCart(cart, samePatient).canCopy, true);
  const restored = preparePrescriptionEdit(item, samePatient);
  assert.equal(restored.ok, true);
  assert.deepEqual(restored.state.sourceConfirmations, item.snapshot.sourceConfirmations);
  assert.notEqual(restored.state.sourceConfirmations, item.snapshot.sourceConfirmations);
  restored.state.sourceConfirmations.pop();
  assert.equal(item.snapshot.sourceConfirmations.length, source.selectionRequirements.length);

  for (const patch of [
    { age: '81' }, { weight: '60' }, { humanCrCl: '29' }, { renalStatus: 'impaired' },
    { humanSerumCreatinine: '' }, { humanSerumCreatinine: 'NaN' },
    { humanSerumCreatinine: NaN }, { humanSerumCreatinine: Infinity },
    { humanSerumCreatinine: '1,5 mg/dl' },
  ]) {
    const changed = { ...snapshot, ...patch };
    assert.equal(assessPrescriptionCart(cart, changed).canCopy, false, Object.keys(patch).join(','));
    assert.deepEqual(preparePrescriptionEdit(item, changed).state.sourceConfirmations, []);
  }
  const animal = { specialty: 'veterinary', species: 'dog', age: '8', weight: '20', vetAgeUnit: 'years' };
  assert.equal(patientContextKey(animal), patientContextKey({ ...animal, humanSerumCreatinine: '1.5', humanCrCl: '60' }));
});
