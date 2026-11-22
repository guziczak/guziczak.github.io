import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, formatNumber } from './engine.js';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { LIQUID_STARTER_REGIMENS } from './liquid-starters.js';
import { RENAL_STATE_DEFAULTS } from './renal-state.js';
import { editableHumanSource } from './regimen-edit.js';
import { resolveRoundingRegimen, applyRoundingPresentation } from './rounding-assessment.js';
import { numericStateValue as num, humanAgeYearsFor, humanContextFor,
  roundingStepFor, doseLimitsFor, calculationInputFor } from './calculation-state.js';
import { revalidatePrescriptionAge } from './cart-age-validation.js';
import { createPrescriptionCart, savePrescriptionItem, completePrescriptionCartAge,
  assessPrescriptionCart, prescriptionCartText } from './prescription-cart.js';
import { humanDosingText, instructionDosingText, prescriptionHeader,
  prescriptionText } from './dental-output.js';

const augmentinForm = DRUGS.find(drug => drug.id === 'amoxicillin-clavulanate')
  .forms.find(form => form.id === 'augmentin-400-57');
const augmentinSource = LIQUID_STARTER_REGIMENS.find(source =>
  source.id === 'dental-augmentin-suspension-adult-substitution');
const metafenForm = DRUGS.find(drug => drug.id === 'paracetamol')
  .forms.find(form => form.id === 'metafen-paracetamol-500');
const metafenSource = HUMAN_REGIMENS.find(source =>
  source.id === 'dental-metafen-paracetamol-over12-over50');

function draftFor(form, source, patch = {}) {
  const state = {
    ...RENAL_STATE_DEFAULTS,
    specialty: 'dental', patientType: 'adult', age: '', humanAgeUnit: 'years', weight: '70',
    species: '', vetAgeUnit: 'years', foodChainStatus: 'unknown',
    renalStatus: 'unknown', humanCrCl: '', humanSerumCreatinine: '',
    custom: false, customName: '', drugId: 'fixture-drug', formId: form.id,
    packageId: form.packOptions[0].id, regimenId: source?.id || '',
    doseMode: source?.doseMode || 'fixed', dose: String(source?.dose ?? 500),
    frequency: String(source?.frequency ?? 2), days: '5', instructionPacks: '',
    roundingMode: 'auto', roundingPlaces: '1', roundingStep: '', roundDoses: false,
    manualMax: '', sourceConfirmations: [], extraInstructions: '', confirmed: true, demo: false,
    ...patch,
  };
  const context = humanContextFor(state, form, source);
  const limitContext = { age: humanAgeYearsFor(state), weight: num(state.weight), manualMax: state.manualMax };
  const independent = doseLimitsFor(form, limitContext);
  const step = roundingStepFor(state, form, source, context);
  const instruction = source?.doseMode === 'instruction' || form.calculationMode === 'instruction';
  const sourceCheck = source ? resolveRoundingRegimen({ form, source, limits: independent,
    review: null, context: { ...context, doseMode: state.doseMode, roundingMode: state.roundingMode,
      roundingStep: step, baselineStep: num(state.roundingStep), patientKind: 'human' },
  }, { allowNumericOverrides: !instruction && editableHumanSource(source) }) : null;
  assert.ok(!sourceCheck || sourceCheck.valid, sourceCheck?.errors.join(' '));
  const limits = doseLimitsFor(form, { ...limitContext, sourceCheck });
  const pack = form.packOptions.find(value => value.id === state.packageId);
  assert.ok(pack);
  const result = instruction ? null : applyRoundingPresentation(calculate(
    calculationInputFor(state, form, pack, { roundingStep: step, limits }),
  ), sourceCheck?.rounding);
  assert.ok(!result || result.valid, result?.errors.join(' '));
  const calculation = instruction ? { packageSize: pack.quantity } : {
    singleUnits: result.singleUnits, singleMg: result.singleMg, dailyMg: result.dailyMg,
    totalUnits: result.totalUnits, packages: result.packages, packageSize: pack.quantity,
  };
  const dosing = instruction ? instructionDosingText({ source,
    frequency: num(state.frequency), days: num(state.days), extraInstructions: state.extraInstructions })
    : humanDosingText({ source, amount: `${formatNumber(result.singleUnits, 10)} ${form.unitLabel}`,
      route: form.routeLabel, frequency: num(state.frequency), days: num(state.days),
      effectiveDailyLimit: limits.daily, extraInstructions: state.extraInstructions });
  const header = prescriptionHeader({ form, pack,
    packages: instruction ? num(state.instructionPacks) : result.packages });
  const texts = Object.fromEntries(['full', 'ds'].map(mode => [mode,
    prescriptionText({ mode, header, dosing, source }),
  ]));
  return { valid: true, confirmed: true, label: form.label,
    summary: instruction ? 'Instrukcja stosowania' : `${calculation.singleUnits} ${form.unitLabel} na podanie`,
    texts, snapshot: { ...state, calculation,
      roundingPolicy: sourceCheck?.rounding?.state === 'rule' ? sourceCheck.rounding.policy : null,
      validationModel: { form, source: source || null } },
  };
}

const augmentin = (patch = {}) => draftFor(augmentinForm, augmentinSource,
  { drugId: 'amoxicillin-clavulanate', packageId: '35', ...patch });
const metafen = (patch = {}) => draftFor(metafenForm, metafenSource,
  { drugId: 'paracetamol', packageId: '10', age: '35', dose: '500', frequency: '1', days: '3', ...patch });
function add(cart, draft) {
  const saved = savePrescriptionItem(cart, draft);
  assert.equal(saved.ok, true, saved.message);
  return saved.cart;
}
const complete = (cart, current) => completePrescriptionCartAge(cart, current,
  { revalidate: revalidatePrescriptionAge });
const succeeds = result => result.valid === true && result.unchanged === true;
function candidate(item, patch = {}) {
  return { ...structuredClone(item.snapshot), age: '35', ...patch };
}

test('the real Augmentin to Metafen workflow fills the earlier age and restores both cart output modes', () => {
  const first = augmentin(), second = metafen();
  assert.deepEqual(first.snapshot.calculation, {
    singleUnits: 11, singleMg: 880, dailyMg: 1760, totalUnits: 110, packages: 4, packageSize: 35,
  });
  const activeMetafen = structuredClone(second.snapshot), activeBefore = structuredClone(activeMetafen);
  const cart = add(add(createPrescriptionCart(), first), second), before = structuredClone(cart);
  assert.deepEqual(assessPrescriptionCart(cart, activeMetafen).staleIds, ['rx-1']);
  const updated = complete(cart, activeMetafen);
  assert.deepEqual(updated.updatedIds, ['rx-1']);
  assert.equal(updated.cart.items[0].snapshot.age, '35');
  assert.equal(updated.cart.items[0].snapshot.drugId, 'amoxicillin-clavulanate');
  assert.equal(updated.cart.items[0].snapshot.regimenId, augmentinSource.id);
  assert.deepEqual(updated.cart.items[0].snapshot.calculation, first.snapshot.calculation);
  assert.deepEqual(updated.cart.items[0].snapshot.roundingPolicy, first.snapshot.roundingPolicy);
  assert.deepEqual(updated.cart.items[0].texts, first.texts);
  assert.deepEqual(updated.cart.items.map(item => item.id), ['rx-1', 'rx-2']);
  assert.equal(updated.cart.nextId, cart.nextId);
  assert.strictEqual(updated.cart.items[1], cart.items[1]);
  for (const mode of ['full', 'ds']) {
    const output = prescriptionCartText(updated.cart, activeMetafen, { mode });
    assert.equal(output.ok, true, output.message);
    assert.match(output.text, /11 ml/);
    assert.match(output.text, /1 tabl\./);
    assert.deepEqual(output.staleIds, []);
  }
  assert.deepEqual(cart, before);
  assert.deepEqual(activeMetafen, activeBefore);
  assert.strictEqual(complete(updated.cart, activeMetafen).cart, updated.cart);
});

test('supplying a minor age cannot silently replace the saved adult rounding rule or amount', () => {
  const cart = add(createPrescriptionCart(), augmentin()), item = cart.items[0];
  const next = candidate(item, { age: '17' });
  const context = humanContextFor(next, augmentinForm, augmentinSource);
  assert.equal(roundingStepFor(next, augmentinForm, augmentinSource, context), null);
  const unrounded = calculate(calculationInputFor(next, augmentinForm, augmentinForm.packOptions[0], {
    roundingStep: null, limits: { single: augmentinSource.maxSingleMg, daily: augmentinSource.maxDailyMg },
  }));
  assert.equal(unrounded.singleUnits, 10.9375);
  assert.equal(succeeds(revalidatePrescriptionAge(next, { previousItem: item })), false);
  const updated = complete(cart, next);
  assert.deepEqual(updated.updatedIds, []);
  assert.strictEqual(updated.cart, cart);
  assert.equal(item.snapshot.calculation.singleUnits, 11);
  assert.equal(prescriptionCartText(updated.cart, next).ok, false);
});

test('known ages and out-of-range new ages cannot use the missing-age revalidation path', () => {
  const unknown = add(createPrescriptionCart(), augmentin()).items[0];
  for (const patch of [{ age: '131' }, { age: '-1' }, { age: 'bad' }, { age: '35', humanAgeUnit: 'weeks' }]) {
    assert.equal(succeeds(revalidatePrescriptionAge(candidate(unknown, patch), { previousItem: unknown })), false);
  }
  const known = add(createPrescriptionCart(), augmentin({ age: '35' })).items[0];
  assert.equal(succeeds(revalidatePrescriptionAge(candidate(known, { age: '36' }), { previousItem: known })), false);
});

test('a newly supplied month age uses its own unit without altering the reviewed quantities', () => {
  const cart = add(createPrescriptionCart(), augmentin()), item = cart.items[0];
  const next = candidate(item, { age: '420', humanAgeUnit: 'months' });
  assert.equal(succeeds(revalidatePrescriptionAge(next, { previousItem: item })), true);
  const updated = complete(cart, next);
  assert.deepEqual(updated.updatedIds, ['rx-1']);
  assert.equal(updated.cart.items[0].snapshot.age, '420');
  assert.equal(updated.cart.items[0].snapshot.humanAgeUnit, 'months');
  assert.deepEqual(updated.cart.items[0].snapshot.calculation, item.snapshot.calculation);
});

// These forms and source records exercise validation behavior, not clinical dosing guidance.
const fixtureForm = {
  id: 'age-test-form', label: 'Preparat testowy', form: 'suspension', unitLabel: 'ml',
  routeLabel: 'doustnie', concentrationMg: 100, concentrationMl: 1, maxDailyMg: 2000,
  packOptions: [{ id: '100', quantity: 100, label: '100 ml' }],
};
const fixtureSource = {
  id: 'age-test-source', formIds: [fixtureForm.id], specialties: ['dental'], patientTypes: ['adult'],
  indication: 'Syntetyczny test', sourceUrl: 'https://example.org/source', sourceLabel: 'Test',
  sourceSection: '4.2', sourceCheckedAt: '2026-11-22',
  doseMode: 'fixed', dose: 500, frequency: 2, maxSingleMg: 500, maxDailyMg: 1000,
};

test('newly activated product age limits block only affected rows while compatible rows can complete', () => {
  const ageLimitedForm = { ...fixtureForm,
    conditionalLimits: [{ minAge: 65, maxDailyMg: 500, label: 'Syntetyczny limit wieku' }] };
  const first = draftFor(ageLimitedForm, null), second = augmentin();
  const cart = add(add(createPrescriptionCart(), first), second);
  const current = { ...second.snapshot, age: '70' };
  const updated = complete(cart, current);
  assert.deepEqual(updated.updatedIds, ['rx-2']);
  assert.strictEqual(updated.cart.items[0], cart.items[0]);
  assert.equal(updated.cart.items[0].snapshot.age, '');
  assert.equal(updated.cart.items[1].snapshot.age, '70');
  assert.deepEqual(assessPrescriptionCart(updated.cart, current).staleIds, ['rx-1']);
  assert.equal(prescriptionCartText(updated.cart, current).ok, false);
});

test('a changed PRN ceiling requires review even when the administered quantities still meet both limits', () => {
  const form = { ...fixtureForm,
    conditionalLimits: [{ minAge: 18, maxDailyMg: 500, label: 'Syntetyczny limit wieku' }] };
  const source = { ...fixtureSource, dose: 100, asNeeded: true, maxDailyMg: 1000 };
  const cart = add(createPrescriptionCart(), draftFor(form, source)), item = cart.items[0];
  const next = candidate(item);
  assert.equal(item.snapshot.calculation.dailyMg, 200);
  assert.match(item.texts.ds, /Nie przekraczać łącznie 1000 mg/);
  const nextLimits = doseLimitsFor(form, { age: 35, weight: 70, manualMax: '', sourceCheck: source });
  assert.equal(nextLimits.daily, 500);
  const recalculated = calculate(calculationInputFor(next, form, form.packOptions[0], {
    roundingStep: null, limits: nextLimits,
  }));
  assert.equal(recalculated.valid, true);
  for (const key of ['singleUnits', 'singleMg', 'dailyMg', 'totalUnits', 'packages']) {
    assert.equal(recalculated[key], item.snapshot.calculation[key]);
  }
  const validation = revalidatePrescriptionAge(next, { previousItem: item });
  assert.equal(validation.valid, true);
  assert.equal(validation.unchanged, false);
  const updated = complete(cart, next);
  assert.deepEqual(updated.updatedIds, []);
  assert.strictEqual(updated.cart, cart);
  assert.deepEqual(updated.cart.items[0].texts, item.texts);
  assert.equal(prescriptionCartText(updated.cart, next).ok, false);
});

test('age-dependent source confirmations are not inherited as fresh approval', () => {
  const source = { ...fixtureSource,
    selectionRequirements: [{ id: 'review-condition', label: 'Potwierdź warunek testowy' }] };
  const draft = draftFor(fixtureForm, source, { sourceConfirmations: ['review-condition'] });
  const cart = add(createPrescriptionCart(), draft), item = cart.items[0];
  const next = candidate(item);
  assert.equal(succeeds(revalidatePrescriptionAge(next, { previousItem: item })), false);
  assert.strictEqual(complete(cart, next).cart, cart);
  assert.deepEqual(item.snapshot.sourceConfirmations, ['review-condition']);
  assert.equal(prescriptionCartText(cart, next).ok, false);
});

test('manual and unit-dose prescriptions can receive a missing age when their results stay unchanged', () => {
  for (const patch of [{ doseMode: 'fixed', dose: '500' }, { doseMode: 'units', dose: '5' }]) {
    const cart = add(createPrescriptionCart(), draftFor(fixtureForm, null, patch)), item = cart.items[0];
    const next = candidate(item, { age: '35,5' });
    assert.equal(succeeds(revalidatePrescriptionAge(next, { previousItem: item })), true);
    const updated = complete(cart, next);
    assert.deepEqual(updated.updatedIds, ['rx-1']);
    assert.deepEqual(updated.cart.items[0].snapshot.calculation, item.snapshot.calculation);
    assert.equal(prescriptionCartText(updated.cart, next).ok, true);
  }
});

test('instruction-only prescriptions remain instructions after a compatible age completion', () => {
  const form = { ...fixtureForm, id: 'age-instruction', form: 'gel', calculationMode: 'instruction',
    packOptions: [{ id: 'one', quantity: 1, label: '1 opakowanie' }] };
  const source = { ...fixtureSource, id: 'age-instruction-source', formIds: [form.id],
    doseMode: 'instruction', dose: undefined, maxSingleMg: undefined, maxDailyMg: undefined,
    instructionText: 'Instrukcja syntetyczna do testu.', minDays: 1, maxDays: 7 };
  const draft = draftFor(form, source, { dose: '', instructionPacks: '1' });
  const cart = add(createPrescriptionCart(), draft), item = cart.items[0];
  const next = candidate(item);
  assert.deepEqual(item.snapshot.calculation, { packageSize: 1 });
  const updated = complete(cart, next);
  assert.deepEqual(updated.updatedIds, ['rx-1']);
  assert.deepEqual(updated.cart.items[0].snapshot.calculation, { packageSize: 1 });
  assert.deepEqual(updated.cart.items[0].texts, item.texts);
});

test('missing models, mismatched sources and corrupted reviewed output fail closed', () => {
  const baseline = augmentin().snapshot;
  for (const alter of [
    snapshot => { delete snapshot.validationModel; },
    snapshot => { snapshot.validationModel.source = null; },
    snapshot => { snapshot.validationModel.source.id = 'wrong-source'; },
    snapshot => { snapshot.validationModel.form.id = 'wrong-form'; },
    snapshot => { delete snapshot.calculation; },
    snapshot => { snapshot.calculation.singleUnits = 10; },
    snapshot => { snapshot.roundingPolicy.revision = 'outdated'; },
  ]) {
    const snapshot = structuredClone(baseline);
    alter(snapshot);
    const previousItem = { snapshot }, next = { ...structuredClone(snapshot), age: '35' };
    assert.equal(succeeds(revalidatePrescriptionAge(next, { previousItem })), false);
  }
});

test('age completion cannot authorize hidden medication or other patient changes', () => {
  const item = add(createPrescriptionCart(), augmentin()).items[0];
  for (const patch of [{ dose: '1000' }, { frequency: '3' }, { days: '7' }, { packageId: '70' },
    { weight: '71' }, { patientType: 'child' }, { ignoreCrCl: false }, { demo: true }]) {
    assert.equal(succeeds(revalidatePrescriptionAge(candidate(item, patch), { previousItem: item })), false);
  }
});
