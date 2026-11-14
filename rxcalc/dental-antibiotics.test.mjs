import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './engine.js';
import { availableHumanRegimens, resolveHumanRegimen } from './human-regimen-engine.js';
import {
  DENTAL_SYSTEMIC_FORM_ADDITIONS,
  DENTAL_SYSTEMIC_DRUG_ADDITIONS,
  DENTAL_SYSTEMIC_REGIMENS,
} from './dental-systemic.js';

const augmentinForms = DENTAL_SYSTEMIC_FORM_ADDITIONS
  .filter(record => record.drugId === 'amoxicillin-clavulanate').map(record => record.form);
const clindamycin = DENTAL_SYSTEMIC_DRUG_ADDITIONS.find(drug => drug.id === 'clindamycin');
const forms = [...augmentinForms, ...clindamycin.forms];
const formById = id => forms.find(form => form.id === id);
const regimenById = id => {
  const record = DENTAL_SYSTEMIC_REGIMENS.find(regimen => regimen.id === id);
  assert.ok(record, `Missing regimen ${id}`);
  return record;
};
const augmentin = strength => regimenById(`dental-augmentin-tablet-${strength}-125-ge40`);
const dalacin = (strength, frequency) => regimenById(`dental-dalacin-c-${strength}-over14-${frequency === 3 ? 'tid' : 'qid'}`);
const context = (record, overrides = {}) => ({
  formId: record.formIds[0], specialty: 'dental', patientType: 'adult',
  age: 30, ageUnit: 'years', weight: 70, days: 7, ...overrides,
});
const run = (record, overrides = {}, packageSize) => {
  const patient = context(record, overrides);
  const source = resolveHumanRegimen(record, patient);
  const form = formById(patient.formId);
  const arithmetic = calculate({
    patientKind: 'human', form: form.form, unitLabel: form.unitLabel,
    doseMode: source.doseMode, dose: source.dose, frequency: source.frequency,
    weight: patient.weight, days: patient.days,
    strengthMg: form.strengthMg, allowedFractions: form.allowedFractions,
    packageSize: packageSize ?? form.packOptions[0].quantity,
    maxDailyMg: source.maxDailyMg, maxSingleMg: source.maxSingleMg,
  });
  return { source, arithmetic, form };
};

test('new source options stay attached to exact products and require explicit selection', () => {
  assert.equal(augmentinForms.length, 2);
  assert.equal(clindamycin.forms.length, 2);
  for (const form of forms) {
    const options = availableHumanRegimens(DENTAL_SYSTEMIC_REGIMENS, {
      formId: form.id, specialty: 'dental', patientType: 'adult',
    });
    assert.equal(options.length, form.unitLabel === 'kaps.' ? 2 : 1);
    assert.ok(options.every(record => record.sourceUrl === form.sourceUrl));
    assert.deepEqual(availableHumanRegimens(options, { formId: form.id, specialty: 'cardio' }), []);
    assert.equal(form.defaultDose, null);
    assert.equal(form.defaultFrequency, null);
    assert.equal(form.defaultDays, null);
    assert.equal(form.maxDailyMg, null);
    assert.equal(form.sourceCheckedAt, '2026-11-14');
    assert.equal(form.clinicalReviewStatus, 'not-clinically-validated');
    assert.ok(form.packOptions.every(pack => pack.availabilityStatus === 'documented-not-stock-verified'));
    for (const record of options) {
      assert.equal(record.sourceCheckedAt, '2026-11-14');
      assert.equal(record.clinicalReviewStatus, 'not-clinically-validated');
      assert.equal(record.fixedDays, undefined);
      assert.equal(record.defaultDays, undefined);
    }
  }
});

test('Augmentin fixed source doses retain both ingredients and count tablets for the chosen course', () => {
  for (const [strength, frequency, dailyAmoxicillin, dailyClavulanate, packSize, totalTablets] of [
    [500, 3, 1500, 375, 21, 21],
    [875, 2, 1750, 250, 14, 14],
  ]) {
    const record = augmentin(strength);
    const { source, arithmetic, form } = run(record, {}, packSize);
    assert.equal(source.valid, true);
    assert.equal(source.dose, strength);
    assert.equal(source.frequency, frequency);
    assert.equal(arithmetic.valid, true);
    assert.equal(arithmetic.singleUnits, 1);
    assert.equal(arithmetic.dailyMg, dailyAmoxicillin);
    assert.equal(arithmetic.totalUnits, totalTablets);
    assert.equal(arithmetic.packages, 1);
    assert.deepEqual(form.activeIngredients, [
      { substanceLabel: 'Amoksycylina', strengthMg: strength },
      { substanceLabel: 'Kwas klawulanowy', strengthMg: 125 },
    ]);
    assert.equal(arithmetic.singleUnits * frequency * form.activeIngredients[1].strengthMg, dailyClavulanate);
    assert.ok(form.activeIngredients.every(ingredient => !Object.hasOwn(ingredient, 'perMl')));
    assert.equal(resolveHumanRegimen(record, context(record, { dose: strength + 125 })).valid, false);
    assert.equal(resolveHumanRegimen(record, context(record, { frequency: frequency === 3 ? 2 : 3 })).valid, false);
    assert.equal(resolveHumanRegimen(record, context(record, { days: null })).valid, false);
  }
});

test('Augmentin source keeps the >=40 kg boundary and supplied renal restrictions', () => {
  for (const strength of [500, 875]) {
    const record = augmentin(strength);
    assert.equal(resolveHumanRegimen(record, context(record, { weight: null })).valid, false);
    assert.equal(resolveHumanRegimen(record, context(record, { weight: 39.99 })).valid, false);
    assert.equal(resolveHumanRegimen(record, context(record, { weight: 40, patientType: 'child' })).valid, true);
    assert.equal(resolveHumanRegimen(record, context(record, { crcl: null, renalStatus: 'unknown' })).valid, true);
    assert.equal(resolveHumanRegimen(record, context(record, { crcl: 30 })).valid, false);
    assert.equal(resolveHumanRegimen(record, context(record, { crcl: 30.01 })).valid, true);
    assert.equal(resolveHumanRegimen(record, context(record, { renalStatus: 'impaired' })).valid, false);
    const longer = resolveHumanRegimen(record, context(record, { days: 15 }));
    assert.equal(longer.valid, true);
    assert.match(longer.warnings.join(' '), /ponownej oceny/);
  }
});

test('a swallowing score does not authorize half-dose Augmentin tablets', () => {
  for (const form of augmentinForms) {
    const result = calculate({
      patientKind: 'human', form: 'tablet', unitLabel: form.unitLabel,
      doseMode: 'fixed', dose: form.strengthMg / 2, strengthMg: form.strengthMg,
      frequency: 2, days: 7, packageSize: 14, allowedFractions: form.allowedFractions,
    });
    assert.equal(result.singleUnits, 0.5);
    assert.equal(result.valid, false);
  }
});

test('Dalacin age is strictly above fourteen and an unchosen range remains incomplete', () => {
  for (const strength of [150, 300]) {
    for (const frequency of [3, 4]) {
      const record = dalacin(strength, frequency);
      assert.equal(resolveHumanRegimen(record, context(record, { dose: null })).valid, false);
      assert.equal(resolveHumanRegimen(record, context(record, { dose: 300, days: null })).valid, false);
      assert.equal(resolveHumanRegimen(record, context(record, { dose: 300, age: 14 })).valid, false);
      assert.equal(resolveHumanRegimen(record, context(record, { dose: 300, age: 168, ageUnit: 'months' })).valid, false);
      assert.equal(resolveHumanRegimen(record, context(record, { dose: 300, age: 169, ageUnit: 'months', patientType: 'child' })).valid, true);
      assert.equal(record.dose, undefined);
    }
  }
});

test('Dalacin daily range is divided once and the per-dose maximum changes with frequency', () => {
  const tid = run(dalacin(300, 3), { dose: 600 });
  const qid = run(dalacin(150, 4), { dose: 450 });
  for (const result of [tid, qid]) {
    assert.equal(result.source.valid, true);
    assert.equal(result.arithmetic.valid, true);
    assert.equal(result.arithmetic.dailyMg, 1800);
  }
  assert.equal(tid.arithmetic.singleUnits, 2);
  assert.equal(qid.arithmetic.singleUnits, 3);
  assert.equal(run(dalacin(150, 4), { dose: 150 }).arithmetic.dailyMg, 600);
  for (const strength of [150, 300]) {
    assert.equal(resolveHumanRegimen(dalacin(strength, 3), context(dalacin(strength, 3), { dose: 150 })).valid, false);
    assert.equal(resolveHumanRegimen(dalacin(strength, 4), context(dalacin(strength, 4), { dose: 600 })).valid, false);
    assert.equal(resolveHumanRegimen(dalacin(strength, 3), context(dalacin(strength, 3), { dose: 1800 })).valid, false);
  }
});

test('valid source quantities cannot bypass whole-capsule arithmetic', () => {
  for (const [strength, frequency, dose, units] of [[300, 4, 450, 1.5], [300, 4, 150, 0.5], [150, 3, 200, 200 / 150]]) {
    const { source, arithmetic, form } = run(dalacin(strength, frequency), { dose });
    assert.equal(source.valid, true);
    assert.equal(arithmetic.valid, false);
    assert.match(arithmetic.errors.join(' '), /część kapsułki/);
    assert.ok(Math.abs(arithmetic.singleUnits - units) < 1e-12);
    assert.equal(form.shortFormLabel, 'kapsułki');
    assert.equal(form.unitLabel, 'kaps.');
  }
  assert.equal(run(dalacin(150, 4), { dose: 450 }).arithmetic.valid, true);
  assert.equal(run(dalacin(300, 4), { dose: 300 }).arithmetic.valid, true);
  assert.match(run(dalacin(300, 4), { dose: 300 }).arithmetic.checks.join(' '), /całkowitej liczbie kapsułek/);
});

test('clindamycin does not inherit a blanket renal block or invent a CrCl threshold', () => {
  for (const strength of [150, 300]) {
    for (const frequency of [3, 4]) {
      const record = dalacin(strength, frequency);
      assert.equal(record.renalPolicy, undefined);
      assert.equal(record.minCrCl, undefined);
      assert.equal(record.requireCrCl, undefined);
      const impaired = resolveHumanRegimen(record, context(record, { dose: 300, renalStatus: 'impaired', crcl: 20 }));
      assert.equal(impaired.valid, true, 'Arithmetic eligibility is not individualized renal dosing');
      assert.match(record.screening, /monitorowania/);
      assert.ok(record.clinicalFlags.some(flag => flag.id === 'advanced-organ-impairment'));
      assert.ok(record.clinicalFlags.some(flag => flag.id === 'clostridioides-difficile'));
      assert.equal(record.minDays, undefined, 'The pathogen-specific ten-day course is not a universal minimum');
    }
  }
});
