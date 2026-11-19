import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { availableHumanRegimens, resolveHumanRegimen } from './human-regimen-engine.js';
import { calculate } from './engine.js';
import { ingredientDailyDose } from './daily-dose.js';
import { CARDIO_MAINTENANCE_REGIMENS as records, CARDIO_MAINTENANCE_RESEARCH as research } from './cardio-maintenance-regimens.js';

const expectedForms = [
  'betaloc-zok-25', 'betaloc-zok-50', 'betaloc-zok-100',
  'ramipril-krka-5', 'ramipril-krka-10', 'toramide-2.5', 'toramide-5', 'toramide-10',
  'atoris-10', 'atoris-20', 'atoris-40',
];
const forms = new Map(DRUGS.flatMap(drug => drug.forms.map(form => [form.id, { form, drug }])));
const find = id => {
  const record = records.find(item => item.id === `cardio-${id}`);
  assert.ok(record, id);
  return record;
};
const context = (record, overrides = {}) => ({
  formId: record.formIds[0], specialty: 'cardio', patientType: 'adult',
  age: 55, ageUnit: 'years', weight: 70, renalStatus: 'unknown',
  crcl: record.requireCrCl ? record.maxCrCl === 60 ? 40 : 80 : null,
  dose: record.dose ?? record.doseRange?.min, frequency: record.frequency,
  days: record.fixedDays ?? 30,
  sourceConfirmations: (record.selectionRequirements || []).map(item => item.id),
  ...overrides,
});
const arithmeticInput = (record, formId, dose = record.dose ?? record.doseRange.min) => {
  const { form } = forms.get(formId);
  return {
    form: form.form, strengthMg: form.strengthMg, unitLabel: form.unitLabel,
    allowedFractions: form.allowedFractions, doseMode: record.doseMode, dose,
    frequency: record.frequency, days: record.fixedDays ?? 30,
    weight: 70, packageSize: form.packOptions[0].quantity,
    maxDailyMg: record.maxDailyMg ?? null, maxSingleMg: record.maxSingleMg ?? null,
  };
};

test('each of the eleven existing exact formulations has an explicitly sourced adult option', () => {
  assert.deepEqual([...new Set(records.flatMap(record => record.formIds))].sort(), [...expectedForms].sort());
  assert.equal(new Set(records.map(record => record.id)).size, records.length);
  for (const formId of expectedForms) {
    assert.ok(forms.has(formId), formId);
    const available = availableHumanRegimens(records, { formId, specialty: 'cardio', patientType: 'adult' });
    assert.ok(available.length > 0, formId);
    assert.deepEqual(availableHumanRegimens(records, { formId, specialty: 'dental', patientType: 'adult' }), []);
    assert.deepEqual(availableHumanRegimens(records, { formId, specialty: 'cardio', patientType: 'child' }), []);
  }
  for (const record of records) {
    assert.match(record.sourceUrl, /^https:\/\/rejestrymedyczne\.ezdrowie\.gov\.pl\/api\/rpl\/medicinal-products\/\d+\/characteristic$/);
    assert.equal(record.sourceCheckedAt, research.checkedAt);
    assert.equal(record.lockSourceValues, true);
    assert.ok(record.indication && record.phaseLabel && record.sourceSection);
  }
});

test('every exposed phase resolves in its declared context and is measurable with its actual formulation', () => {
  for (const record of records) {
    for (const formId of record.formIds) {
      const doses = record.doseRange ? [record.doseRange.min, record.doseRange.max] : [record.dose];
      for (const dose of doses) {
        const resolved = resolveHumanRegimen(record, context(record, { formId, dose }));
        assert.equal(resolved.valid, true, `${record.id}/${formId}: ${resolved.errors.join(' ')}`);
        const result = calculate(arithmeticInput(record, formId, dose));
        assert.equal(result.valid, true, `${record.id}/${formId}/${dose}: ${result.errors.join(' ')}`);
        assert.ok(result.singleUnits > 0);
        assert.equal(result.dailyMg, dose * record.frequency);
      }
    }
  }
});

test('selection requires the declared clinical conditions and never infers adulthood from a label', () => {
  for (const record of records) {
    assert.ok(record.selectionRequirements.length > 0, record.id);
    assert.equal(new Set(record.selectionRequirements.map(item => item.id)).size, record.selectionRequirements.length);
    assert.equal(resolveHumanRegimen(record, context(record, { sourceConfirmations: [] })).valid, false, record.id);
    assert.equal(resolveHumanRegimen(record, context(record, { age: 17 })).valid, false, record.id);
  }
  const ramipril = find('ramipril-hypertension-5-crcl-ge60');
  const withoutLiverCheck = context(ramipril).sourceConfirmations.filter(id => id !== 'ramipril-no-hepatic-impairment');
  assert.equal(resolveHumanRegimen(ramipril, context(ramipril, { sourceConfirmations: withoutLiverCheck })).valid, false);
});

test('Betaloc mg are succinate amounts, never the tartrate-equivalent number in the product name', () => {
  const initial = find('betaloc-hypertension-initial');
  assert.equal(initial.dose, 47.5);
  assert.equal(calculate(arithmeticInput(initial, 'betaloc-zok-25')).singleUnits, 2);
  assert.equal(calculate(arithmeticInput(initial, 'betaloc-zok-50')).singleUnits, 1);
  assert.equal(resolveHumanRegimen(initial, context(initial, { dose: 50 })).valid, false);
  const range = find('betaloc-hypertension-increased');
  assert.deepEqual(range.doseRange, { min: 95, max: 190 });
  assert.equal(calculate(arithmeticInput(range, 'betaloc-zok-100', 190)).singleUnits, 2);
  const { form, drug } = forms.get('betaloc-zok-100');
  const note = ingredientDailyDose({ form, drug, source: range,
    sourceCheck: resolveHumanRegimen(range, context(range, { formId: form.id, dose: 190 })),
    input: arithmeticInput(range, form.id, 190) });
  assert.equal(note.rows[0].daily, 190);
  assert.equal(note.rows[0].ceiling, 190);
});

test('Betaloc HF starts and later phases remain distinct and respect equal-dose splitting', () => {
  const low = find('betaloc-hf-initial-nyha3to4');
  assert.deepEqual(low.formIds, ['betaloc-zok-25']);
  assert.equal(low.dose, 11.875);
  assert.equal(low.fixedDays, 7);
  assert.equal(calculate(arithmeticInput(low, 'betaloc-zok-25')).singleUnits, 0.5);
  assert.equal(resolveHumanRegimen(low, context(low, { formId: 'betaloc-zok-50' })).valid, false);
  const standard = find('betaloc-hf-initial-standard');
  assert.equal(standard.dose, 23.75);
  assert.equal(standard.fixedDays, 14);
  const target = find('betaloc-hf-maintenance-zok200');
  assert.equal(target.dose, 190);
  assert.equal(target.fixedDays, undefined);
  assert.equal(resolveHumanRegimen(target, context(target, {
    sourceConfirmations: context(target).sourceConfirmations.filter(id => id !== 'betaloc-hf-target-tolerated'),
  })).valid, false);
});

test('ramipril CrCl bands do not overlap at 60 and missing renal data never selects a dose', () => {
  const standard = find('ramipril-hypertension-10-crcl-ge60');
  const reduced = find('ramipril-hypertension-5-crcl10to60');
  assert.equal(resolveHumanRegimen(standard, context(standard, { crcl: null })).valid, false);
  assert.equal(resolveHumanRegimen(reduced, context(reduced, { crcl: null })).valid, false);
  assert.equal(resolveHumanRegimen(standard, context(standard, { crcl: 59.9 })).valid, false);
  assert.equal(resolveHumanRegimen(standard, context(standard, { crcl: 60 })).valid, true);
  assert.equal(resolveHumanRegimen(reduced, context(reduced, { crcl: 59.9 })).valid, true);
  assert.equal(resolveHumanRegimen(reduced, context(reduced, { crcl: 60 })).valid, false);
  assert.equal(resolveHumanRegimen(reduced, context(reduced, { crcl: 10 })).valid, true);
  assert.equal(resolveHumanRegimen(reduced, context(reduced, { crcl: 9.9 })).valid, false);
  assert.equal(resolveHumanRegimen(reduced, context(reduced, { dose: 10 }), { allowNumericOverrides: true }).valid, false);
});

test('ramipril whole tablets cannot silently supply its smaller starts or replace 5 mg twice daily with 10 mg once daily', () => {
  const ramipril = records.filter(record => record.id.startsWith('cardio-ramipril-'));
  assert.ok(ramipril.every(record => record.dose >= 5));
  const hf = find('ramipril-hf-maintenance-5-bid');
  assert.deepEqual(hf.formIds, ['ramipril-krka-5']);
  assert.equal(hf.dose, 5);
  assert.equal(hf.frequency, 2);
  assert.equal(calculate(arithmeticInput(hf, 'ramipril-krka-5')).dailyMg, 10);
  assert.equal(resolveHumanRegimen(hf, context(hf, { formId: 'ramipril-krka-10', dose: 10, frequency: 1 })).valid, false);
  const dialysis = find('ramipril-hypertension-haemodialysis-maintenance-5');
  assert.equal(resolveHumanRegimen(dialysis, context(dialysis, { crcl: null })).valid, true);
  assert.equal(dialysis.maxDailyMg, 5);
  assert.match(dialysis.administration, /po jej zakończeniu/);
});

test('torasemide hypertension and oedema have separate source scopes and ceilings', () => {
  const hypertension = find('toramide-hypertension-increased');
  assert.equal(hypertension.maxDailyMg, 5);
  assert.ok(!hypertension.formIds.includes('toramide-10'));
  assert.equal(resolveHumanRegimen(hypertension, context(hypertension, { dose: 10 }), { allowNumericOverrides: true }).valid, false);
  const oedema = find('toramide-oedema-adjusted-10');
  assert.deepEqual(oedema.doseRange, { min: 10, max: 20 });
  assert.equal(oedema.maxDailyMg, 20);
  assert.equal(resolveHumanRegimen(oedema, context(oedema, { dose: null })).valid, false);
  assert.equal(resolveHumanRegimen(oedema, context(oedema, { dose: 40 })).valid, false);
  assert.ok(!records.some(record => record.id.startsWith('cardio-toramide-') && (record.dose === 40 || record.maxDailyMg === 40)));
});

test('atorvastatin ranges never default to the maximum and its 20 mg interaction variant excludes the 40 mg tablet', () => {
  const start = find('atoris-hypercholesterolaemia-initial');
  assert.deepEqual(start.formIds, ['atoris-10']);
  assert.equal(start.dose, 10);
  const maintenance = find('atoris-hypercholesterolaemia-maintenance-40');
  const unchosen = resolveHumanRegimen(maintenance, context(maintenance, { dose: null }));
  assert.equal(unchosen.valid, false);
  assert.equal(unchosen.dose, null);
  assert.equal(resolveHumanRegimen(maintenance, context(maintenance, { dose: 80 })).valid, true);
  assert.equal(resolveHumanRegimen(maintenance, context(maintenance, { dose: 90 })).valid, false);
  const interaction = find('atoris-interaction-cap20-20');
  assert.equal(interaction.maxDailyMg, 20);
  assert.equal(resolveHumanRegimen(interaction, context(interaction, { dose: 40 }), { allowNumericOverrides: true }).valid, false);
  assert.ok(!records.some(record => record.id.startsWith('cardio-atoris-interaction-cap20') && record.formIds.includes('atoris-40')));
});

test('chronic prescriptions require a chosen supply duration without inventing a treatment endpoint', () => {
  const maintenance = records.filter(record => !record.fixedDays);
  for (const record of maintenance) {
    const unresolved = resolveHumanRegimen(record, context(record, { days: null }));
    assert.equal(unresolved.valid, false, record.id);
    assert.equal(unresolved.fixedDays, null, record.id);
    assert.equal(record.maxDays, undefined, record.id);
  }
  assert.equal(records.filter(record => record.fixedDays).length, 2);
});
