import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { apixabanReductionCriteria } from './cardio-anticoagulant-regimens.js';
import { resolveHumanRegimen } from './human-regimen-engine.js';
import { calculate } from './engine.js';
import { parseRenalNumber } from './renal-function.js';
import { RENAL_STATE_DEFAULTS, renalAssessmentForState, renalRegimenContext,
  renalCreatinineInput, renalCreatinineUnitChange } from './renal-state.js';
import { renalPanelMarkup, renalResultMarkup, updateRenalPanel } from './renal-view.js';
import { prescriptionHeader, prescriptionText, humanDosingText } from './dental-output.js';
import { createPrescriptionCart, savePrescriptionItem, assessPrescriptionCart, prescriptionCartText,
  preparePrescriptionEdit, normalizePatientContext, patientContextKey } from './prescription-cart.js';

const sourceById = id => HUMAN_REGIMENS.find(source => source.id === `cardio-${id}`);
const standard = sourceById('eliquis-nvaf-standard');
const reduced = sourceById('eliquis-nvaf-two-criteria');
const person = (patch = {}, source = standard) => ({
  ...RENAL_STATE_DEFAULTS, specialty: 'cardio', patientType: 'adult',
  age: '68', humanAgeUnit: 'years', weight: '72', species: '', vetAgeUnit: 'years',
  foodChainStatus: 'unknown', renalStatus: 'unknown',
  renalInputMode: 'calculate', renalSex: 'male', renalCalculationReviewed: true,
  humanSerumCreatinine: '1', humanCrCl: '99',
  drugId: 'apixaban', formId: source.formIds[0], regimenId: source.id,
  dose: String(source.dose), doseMode: 'fixed', frequency: String(source.frequency), days: '30',
  sourceConfirmations: source.selectionRequirements.map(requirement => requirement.id),
  confirmed: true, demo: false, ...patch,
});
const clinicalContext = (state, source = standard) => ({
  formId: state.formId, specialty: state.specialty, patientType: state.patientType,
  age: parseRenalNumber(state.age), ageUnit: state.humanAgeUnit, weight: parseRenalNumber(state.weight),
  dose: parseRenalNumber(state.dose), frequency: parseRenalNumber(state.frequency), days: parseRenalNumber(state.days),
  sourceConfirmations: state.sourceConfirmations, renalStatus: state.renalStatus,
  ...renalRegimenContext(state, source),
});
const resolved = (state, source = standard) => resolveHumanRegimen(source, clinicalContext(state, source));
const panelOptions = (state, source = standard) => ({
  state, assessment: renalAssessmentForState(state),
  criteria: apixabanReductionCriteria(source, clinicalContext(state, source)), required: source.requireCrCl,
});
const convertState = (state, unit) => ({ ...state, ...renalCreatinineUnitChange(state, unit) });

function draft(state, source = standard) {
  const drug = DRUGS.find(drug => drug.id === state.drugId);
  const form = drug.forms.find(form => form.id === state.formId);
  const pack = form.packOptions[0];
  const context = clinicalContext(state, source);
  const eligibility = resolveHumanRegimen(source, context);
  const calculation = calculate({ ...form, ...context, patientKind: 'human', doseMode: 'fixed',
    packageSize: pack.quantity, maxDailyMg: source.maxDailyMg ?? null });
  const header = prescriptionHeader({ form, name: `${drug.substance}\n${form.label}`, pack,
    packages: calculation.packages });
  const dosing = humanDosingText({ source, amount: `${calculation.singleUnits} tabl.`,
    route: form.routeLabel, frequency: context.frequency, days: context.days });
  return { valid: eligibility.valid && calculation.valid, confirmed: state.confirmed, demo: state.demo,
    label: form.label, snapshot: { ...state, packageId: pack.id },
    texts: Object.fromEntries(['full', 'ds'].map(mode => [mode,
      prescriptionText({ mode, header, dosing, source })])),
    eligibility, calculation,
  };
}

function saved(state = person(), source = standard) {
  const entry = draft(state, source);
  assert.equal(entry.valid, true, entry.eligibility.errors.join(' '));
  const result = savePrescriptionItem(createPrescriptionCart(), entry);
  assert.equal(result.ok, true, result.message);
  return { ...result, entry };
}

test('state adapter keeps calculated and assessed CrCl paths explicit', () => {
  const automatic = person();
  assert.equal(renalAssessmentForState(automatic).crcl, 72);
  assert.equal(clinicalContext(automatic).crcl, 72);
  assert.equal(resolved(automatic).valid, true);
  const manual = { ...automatic, renalInputMode: 'manual', humanCrCl: '45,5' };
  assert.equal(renalAssessmentForState(manual).crcl, 45.5);
  assert.equal(clinicalContext(manual).crcl, 45.5);
  assert.equal(resolved(manual).valid, true);
  assert.notEqual(patientContextKey(automatic), patientContextKey(manual));
});

test('calculation mode never falls back to a previously entered manual CrCl', () => {
  for (const patch of [
    { humanSerumCreatinine: '' }, { renalSex: '' }, { renalCalculationReviewed: false },
    { renalCalculationWeight: 'invalid' }, { age: '' },
  ]) {
    const state = person({ humanCrCl: '90', ...patch });
    const context = clinicalContext(state);
    assert.equal(context.crcl, null, JSON.stringify(patch));
    assert.equal(normalizePatientContext(state).crcl, null);
    assert.equal(resolved(state).valid, false);
    assert.ok(context.renalIssues.length > 0);
  }
  const unchecked = renalAssessmentForState(person({ renalCalculationReviewed: false }));
  assert.ok(unchecked.issues.some(issue => issue.field === 'renalStable' && issue.kind === 'missing'));
  assert.equal(unchecked.issues.some(issue => issue.code === 'renal-function-unstable'), false);
});

test('unit swaps preserve normalized criteria, CrCl and the reviewed cart context', () => {
  for (const value of ['1', '1.5', '1.51', '1.4999']) {
    const original = person({ humanSerumCreatinine: value });
    const si = convertState(original, 'umol/l');
    const returned = convertState(si, 'mg/dl');
    const before = renalAssessmentForState(original);
    for (const state of [si, returned]) {
      const after = renalAssessmentForState(state);
      assert.equal(after.serumCreatinineMgDl, before.serumCreatinineMgDl, value);
      assert.equal(after.crcl, before.crcl, value);
      assert.deepEqual(apixabanReductionCriteria(standard, clinicalContext(state)),
        apixabanReductionCriteria(standard, clinicalContext(original)), value);
      assert.equal(patientContextKey(state), patientContextKey(original), value);
      const { cart } = saved(original);
      assert.equal(assessPrescriptionCart(cart, state).canCopy, true, value);
    }
  }
});

test('canonical laboratory input survives repeated display conversions near a clinical cutoff', () => {
  for (const [value, unit, age] of [
    ['1.4999999999999998', 'mg/dl', '80'],
    ['123.456789012345', 'umol/l', '68'],
    ['1.23456789012345', 'mg/dl', '68'],
  ]) {
    const original = person({ humanSerumCreatinine: value, renalCreatinineUnit: unit, age });
    const reference = renalAssessmentForState(original);
    const referenceCriteria = apixabanReductionCriteria(standard, clinicalContext(original));
    const { cart } = saved(original);
    let changed = original;
    for (let change = 0; change < 12; change++) {
      const nextUnit = changed.renalCreatinineUnit === 'mg/dl' ? 'umol/l' : 'mg/dl';
      const before = structuredClone(changed);
      const patch = renalCreatinineUnitChange(changed, nextUnit);
      assert.deepEqual(changed, before, 'unit patch must be pure');
      changed = { ...changed, ...patch };
      const retained = renalCreatinineInput(changed);
      assert.equal(retained.retained, true);
      assert.equal(retained.value, value);
      assert.equal(retained.unit, unit);
      assert.equal(renalAssessmentForState(changed).serumCreatinineMgDl, reference.serumCreatinineMgDl);
      assert.equal(renalAssessmentForState(changed).crcl, reference.crcl);
      assert.deepEqual(apixabanReductionCriteria(standard, clinicalContext(changed)), referenceCriteria);
      assert.equal(patientContextKey(changed), patientContextKey(original));
      assert.equal(assessPrescriptionCart(cart, changed).canCopy, true);
      assert.equal(prescriptionCartText(cart, changed).text, cart.items[0].texts.full);
    }
    assert.equal(changed.humanSerumCreatinine, original.humanSerumCreatinine);
    assert.equal(changed.renalCreatinineUnit, original.renalCreatinineUnit);
  }
});

test('actual input edits clear or invalidate retained creatinine instead of freezing a previous result', () => {
  const original = person({ age: '80', humanSerumCreatinine: '1.4999999999999998' });
  const converted = convertState(original, 'umol/l');
  assert.equal(converted.humanSerumCreatinine, '132,6');
  assert.equal(apixabanReductionCriteria(standard, clinicalContext(converted)).reduction, false);
  const { cart } = saved(original);

  // A deliberate edit may have the same visible text as the conversion: the
  // input event explicitly clears its retained original and makes it a new lab value.
  const deliberateSameText = { ...converted, renalCreatinineSource: null };
  assert.equal(renalCreatinineInput(deliberateSameText).retained, false);
  assert.equal(renalAssessmentForState(deliberateSameText).serumCreatinineMgDl, 1.5);
  assert.equal(apixabanReductionCriteria(standard, clinicalContext(deliberateSameText)).reduction, true);
  assert.equal(resolved(deliberateSameText).valid, false);
  assert.equal(assessPrescriptionCart(cart, deliberateSameText).canCopy, false);

  // The display guard also protects against callers which changed text/unit
  // but forgot to remove the old retained object.
  const changedText = { ...converted, humanSerumCreatinine: '176,8' };
  assert.equal(renalCreatinineInput(changedText).retained, false);
  assert.equal(renalAssessmentForState(changedText).serumCreatinineMgDl, 2);
  assert.equal(assessPrescriptionCart(cart, changedText).canCopy, false);
  const changedUnit = { ...converted, renalCreatinineUnit: 'mg/dl' };
  assert.equal(renalCreatinineInput(changedUnit).retained, false);
  assert.equal(renalAssessmentForState(changedUnit).serumCreatinineMgDl, 132.6);
  const cleared = { ...converted, humanSerumCreatinine: '' };
  assert.equal(renalCreatinineInput(cleared).retained, false);
  assert.equal(renalAssessmentForState(cleared).serumCreatinineMgDl, null);
  assert.equal(renalAssessmentForState(cleared).crcl, null);

  const newlyConverted = convertState(changedText, 'mg/dl');
  assert.equal(newlyConverted.renalCreatinineSource.value, '176,8');
  assert.equal(newlyConverted.renalCreatinineSource.unit, 'umol/l');
  assert.equal(renalAssessmentForState(newlyConverted).serumCreatinineMgDl, 2);
});

test('cart editing preserves the current canonical input and still revokes final approval', () => {
  const original = person({ age: '80', humanSerumCreatinine: '1.4999999999999998' });
  const converted = convertState(original, 'umol/l');
  const { item: originalItem } = saved(original);
  const { item: convertedItem } = saved(converted);
  assert.deepEqual(convertedItem.snapshot.renalCreatinineSource, converted.renalCreatinineSource);
  assert.notEqual(convertedItem.snapshot.renalCreatinineSource, converted.renalCreatinineSource);
  assert.equal(Object.isFrozen(convertedItem.snapshot.renalCreatinineSource), true);
  for (const item of [originalItem, convertedItem]) {
    const edit = preparePrescriptionEdit(item, converted);
    assert.equal(edit.ok, true);
    assert.equal(edit.state.confirmed, false);
    assert.deepEqual(edit.state.renalCreatinineSource, converted.renalCreatinineSource);
    assert.equal(edit.state.humanSerumCreatinine, converted.humanSerumCreatinine);
    assert.equal(renalAssessmentForState(edit.state).serumCreatinineMgDl, 1.4999999999999998);
    assert.equal(patientContextKey(edit.state), patientContextKey(original));
    assert.deepEqual(edit.state.sourceConfirmations, original.sourceConfirmations);
  }
  const currentNewLab = convertState(person({ humanSerumCreatinine: '1.2' }), 'umol/l');
  const changed = preparePrescriptionEdit(convertedItem, currentNewLab);
  assert.deepEqual(changed.state.renalCreatinineSource, currentNewLab.renalCreatinineSource);
  assert.equal(renalAssessmentForState(changed.state).serumCreatinineMgDl, 1.2);
  assert.deepEqual(changed.state.sourceConfirmations, []);
});

test('manual assessed CrCl and already decisive age/weight work without separate SCr', () => {
  for (const [source, age, weight, decision] of [[standard, '68', '72', false], [reduced, '80', '60', true]]) {
    const state = person({ renalInputMode: 'manual', humanCrCl: '45', humanSerumCreatinine: '',
      age, weight, renalSex: '', renalCalculationReviewed: false }, source);
    const result = resolved(state, source);
    assert.equal(result.valid, true, result.errors.join(' '));
    assert.equal(result.requirements.includes('serumCreatinine'), false);
    assert.equal(apixabanReductionCriteria(source, clinicalContext(state, source)).reduction, decision);
    assert.equal(saved(state, source).entry.valid, true);
  }
  const undecided = person({ renalInputMode: 'manual', age: '80', weight: '72', humanCrCl: '45', humanSerumCreatinine: '' });
  assert.equal(resolved(undecided).valid, false);
  assert.ok(resolved(undecided).issues.some(issue => issue.code === 'missing-serum-creatinine'));
});

test('partial criteria expose honest count bounds for missing age, weight and SCr', () => {
  for (const context of [null, {}, []]) {
    const criteria = apixabanReductionCriteria(standard, context);
    assert.equal(criteria.minimumCount, 0);
    assert.equal(criteria.maximumCount, 3);
    assert.equal(criteria.reduction, null);
  }
  const oneKnown = apixabanReductionCriteria(standard, { age: 80, ageUnit: 'years' });
  assert.equal(oneKnown.minimumCount, 1);
  assert.equal(oneKnown.maximumCount, 3);
  assert.equal(oneKnown.reduction, null);
});

test('invalid supplied SCr remains a blocking input even when the count is already decisive', () => {
  for (const [source, age, weight] of [[standard, '68', '72'], [reduced, '80', '60']]) {
    for (const humanSerumCreatinine of ['n/a', '0', '-1', '1 mg/dl', Infinity]) {
      const state = person({ renalInputMode: 'manual', humanCrCl: '45', age, weight, humanSerumCreatinine }, source);
      const result = resolved(state, source);
      assert.equal(result.valid, false, String(humanSerumCreatinine));
      assert.equal(result.issues.filter(issue => issue.field === 'serumCreatinine').length, 1);
      assert.ok(result.issues.some(issue => issue.field === 'serumCreatinine' && issue.kind === 'invalid'));
      assert.equal(savePrescriptionItem(createPrescriptionCart(), draft(state, source)).ok, false);
    }
  }
  const oneCriterion = person({ renalInputMode: 'manual', humanCrCl: '45', age: '80', humanSerumCreatinine: 'wrong' });
  const result = resolved(oneCriterion);
  assert.equal(result.issues.filter(issue => issue.field === 'serumCreatinine').length, 1);
  assert.equal(result.issues.find(issue => issue.field === 'serumCreatinine').kind, 'invalid');
});

test('NVAF criteria use actual patient weight, independently from the weight selected for CG', () => {
  const actualAboveThreshold = person({ age: '80', weight: '75', renalCalculationWeight: '55' });
  assert.equal(renalAssessmentForState(actualAboveThreshold).weightUsedKg, 55);
  const criteria = apixabanReductionCriteria(standard, clinicalContext(actualAboveThreshold));
  assert.equal(criteria.weight, false);
  assert.equal(criteria.reduction, false);
  assert.equal(resolved(actualAboveThreshold).valid, true);
  const actualAtThreshold = person({ age: '80', weight: '60', renalCalculationWeight: '75' }, reduced);
  assert.equal(apixabanReductionCriteria(reduced, clinicalContext(actualAtThreshold, reduced)).weight, true);
  assert.equal(resolved(actualAtThreshold, reduced).valid, true);
});

test('matching reviewed renal context exports the complete Rp. and advice modes', () => {
  const state = person();
  const { cart, entry } = saved(state);
  const full = prescriptionCartText(cart, state, { mode: 'full' });
  assert.equal(full.ok, true);
  assert.equal(full.text, entry.texts.full);
  assert.match(full.text, /^Rp\. Apixabanum\nEliquis/);
  assert.match(full.text, /1 op\. po 60 tabl\./);
  assert.match(full.text, /^D\.S\. Stosować 1 tabl\./m);
  const advice = prescriptionCartText(cart, state, { mode: 'ds' });
  assert.equal(advice.ok, true);
  assert.equal(advice.text, `${entry.label}\n${entry.texts.ds}`);
  assert.doesNotMatch(advice.text, /^Rp\./m);
  assert.match(advice.text, /^D\.S\./m);
});

test('changes to calculation sex, review, SCr or selected mass stale the cart and block both exports', () => {
  const state = person();
  const { cart, item } = saved(state);
  for (const patch of [
    { renalSex: 'female' }, { renalCalculationReviewed: false }, { humanSerumCreatinine: '1.2' },
    { renalCalculationWeight: '65' }, { renalInputMode: 'manual' },
  ]) {
    const changed = { ...state, ...patch };
    assert.equal(assessPrescriptionCart(cart, changed).canCopy, false, JSON.stringify(patch));
    assert.deepEqual(assessPrescriptionCart(cart, changed).staleIds, [item.id]);
    for (const mode of ['full', 'ds']) {
      const output = prescriptionCartText(cart, changed, { mode });
      assert.equal(output.ok, false);
      assert.equal(output.text, '');
    }
  }
});

test('loading a saved item keeps current renal inputs and revokes final approval', () => {
  const original = person();
  const { item } = saved(original);
  const current = person({ humanSerumCreatinine: '1,2', renalCreatinineUnit: 'mg/dl',
    humanCrCl: '41', renalSex: 'female', renalCalculationWeight: '65', renalCalculationReviewed: false });
  const edit = preparePrescriptionEdit(item, current);
  assert.equal(edit.ok, true);
  for (const field of ['humanSerumCreatinine', 'humanCrCl', 'renalCreatinineUnit', 'renalSex',
    'renalCalculationWeight', 'renalCalculationReviewed', 'renalInputMode'])
    assert.equal(edit.state[field], current[field], field);
  assert.equal(edit.state.confirmed, false);
  assert.deepEqual(edit.state.sourceConfirmations, []);
  assert.equal(edit.state.regimenId, original.regimenId);
  assert.equal(edit.state.dose, original.dose);
  const unchanged = preparePrescriptionEdit(item, original);
  assert.equal(unchanged.state.confirmed, false);
  assert.deepEqual(unchanged.state.sourceConfirmations, original.sourceConfirmations);
});

test('human renal values cannot alter the veterinary cart context or cross patient groups', () => {
  const animal = { ...person(), specialty: 'veterinary', species: 'dog', age: '5', weight: '20' };
  const changedHumanRenalFields = { ...animal, humanCrCl: '10', humanSerumCreatinine: '9',
    renalSex: 'female', renalCalculationWeight: '1', renalCalculationReviewed: false,
    renalCreatinineUnit: 'umol/l', renalInputMode: 'manual' };
  const normalized = normalizePatientContext(animal);
  for (const field of ['crcl', 'serumCreatinine', 'renalSex', 'renalCalculationWeight', 'renalCalculationReviewed'])
    assert.equal(normalized[field], null);
  assert.equal(patientContextKey(animal), patientContextKey(changedHumanRenalFields));
  assert.deepEqual(renalRegimenContext(animal, { specialties: ['veterinary'] }),
    { crcl: null, serumCreatinine: null, renalIssues: [] });
  const { cart, item } = saved();
  assert.equal(assessPrescriptionCart(cart, animal).canCopy, false);
  assert.equal(preparePrescriptionEdit(item, animal).ok, false);
  assert.equal(resolveHumanRegimen(standard, clinicalContext(animal)).valid, false);
});

test('renal panel presents the required inputs of each path and identifies the selected mass', () => {
  const calculated = person({ renalCalculationWeight: '65' });
  const automaticMarkup = renalPanelMarkup(panelOptions(calculated));
  assert.match(automaticMarkup, /id="humanSerumCreatinine"[^>]*\brequired\b/);
  assert.match(automaticMarkup, /id="renalSex"[^>]*\brequired\b/);
  assert.doesNotMatch(automaticMarkup, /id="humanCrCl"/);
  assert.match(automaticMarkup, /Masa do wzoru: 65 kg/);
  assert.match(automaticMarkup, /wybrana przez lekarza/);
  const manual = person({ renalInputMode: 'manual', humanSerumCreatinine: '', humanCrCl: '45' });
  const manualMarkup = renalPanelMarkup(panelOptions(manual));
  assert.match(manualMarkup, /id="humanCrCl"[^>]*\brequired\b/);
  assert.doesNotMatch(manualMarkup.match(/<input id="humanSerumCreatinine"[^>]*>/)?.[0] || '', /\brequired\b/);
  assert.doesNotMatch(manualMarkup, /id="renalSex"/);
  assert.match(manualMarkup, /na podstawie wieku i masy/);
  const ambiguous = person({ renalInputMode: 'manual', age: '80', humanSerumCreatinine: '' });
  assert.match(renalPanelMarkup(panelOptions(ambiguous)), /id="humanSerumCreatinine"[^>]*\brequired\b/);
  const pending = person({ renalCalculationReviewed: false });
  const output = renalResultMarkup(panelOptions(pending));
  assert.match(output, /Potwierdź stabilność/);
  assert.doesNotMatch(output, /<strong>[\d,\.]+/);
});

test('live renal updates change status and requirement without replacing the active input', () => {
  const nodes = new Map([
    ['#renal-panel', {}], ['#renal-result', { innerHTML: '' }],
    ['#humanSerumCreatinine', { required: false, value: '1,', selectionStart: 2, selectionEnd: 2 }],
    ['#renal-creatinine-label', { textContent: '' }],
    ['#renalCalculationReviewed', { checked: true }], ['#renal-criteria', { hidden: false, textContent: '' }],
  ]);
  const root = { querySelector: selector => nodes.get(selector) || null };
  const input = nodes.get('#humanSerumCreatinine');
  const state = person({ renalInputMode: 'manual', age: '80', humanSerumCreatinine: '' });
  updateRenalPanel(root, panelOptions(state));
  assert.equal(input.required, true);
  assert.match(nodes.get('#renal-criteria').textContent, /uzupełnij potrzebne dane/);
  updateRenalPanel(root, panelOptions({ ...state, age: '68', renalCalculationReviewed: false }));
  assert.equal(input.required, false);
  assert.equal(nodes.get('#renalCalculationReviewed').checked, false);
  assert.match(nodes.get('#renal-criteria').textContent, /na podstawie wieku i masy/);
  assert.equal(nodes.get('#humanSerumCreatinine'), input);
  assert.equal(input.value, '1,');
  assert.equal(input.selectionStart, 2);
  assert.equal(input.selectionEnd, 2);
});
