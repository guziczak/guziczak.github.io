import test from 'node:test';
import assert from 'node:assert/strict';
import { availableHumanRegimens, resolveHumanRegimen } from './human-regimen-engine.js';
import { calculate } from './engine.js';
import { DENTAL_SYSTEMIC_REGIMENS } from './dental-systemic.js';
import { DENTAL_TOPICAL_REGIMENS } from './dental-topicals.js';

// Synthetic fixtures test resolver semantics; they are not clinical dose sources.
const source = {
  id: 'human-source', formIds: ['exact-form'], specialties: ['dental'],
  indication: 'Syntetyczne wskazanie testowe',
  sourceUrl: 'https://example.org/source', sourceLabel: 'Źródło testowe',
  sourceSection: '4.2', sourceCheckedAt: '2026-11-13',
};
const fixed = { ...source, doseMode: 'fixed', dose: 100, frequency: 3 };
const context = { formId: 'exact-form', specialty: 'dental', patientType: 'adult', days: 5 };
const ranged = {
  ...source, doseMode: 'perKgDay', doseRange: { min: 20, max: 40 },
  frequencyOptions: [2, 3], minAgeMonths: 2, maxWeight: 40, maxWeightExclusive: true,
};
const child = {
  ...context, patientType: 'child', age: 24, ageUnit: 'months', weight: 20,
  dose: 30, frequency: 3,
};

test('source selection remains specific to formulation, specialty and explicit patient scope', () => {
  const adults = { ...fixed, patientTypes: ['adult'] };
  assert.equal(availableHumanRegimens([adults], context).length, 1);
  for (const changed of [
    { formId: 'other-strength' }, { specialty: 'veterinary' },
    { patientType: 'child' }, { patientType: 'unknown' },
  ]) {
    const other = { ...context, ...changed };
    assert.deepEqual(availableHumanRegimens([adults], other), []);
    const result = resolveHumanRegimen(adults, other);
    assert.equal(result.valid, false);
    assert.equal(result.dose, null);
  }
});

test('weight-defined adult-equivalent sources can apply to a child above the source weight threshold', () => {
  const byWeight = { ...fixed, minWeight: 40 };
  assert.equal(availableHumanRegimens([byWeight], { ...context, patientType: 'child' }).length, 1);
  assert.equal(resolveHumanRegimen(byWeight, { ...context, patientType: 'child', weight: 40 }).valid, true);
  assert.equal(resolveHumanRegimen(byWeight, { ...context, patientType: 'child', weight: 39.9 }).valid, false);
  assert.equal(resolveHumanRegimen(byWeight, context).valid, false);
});

test('malformed or unsourced records never expose dosing candidates', () => {
  const bad = [
    undefined, null, {}, { ...fixed, formIds: [] }, { ...fixed, specialties: 'dental' },
    { ...fixed, patientTypes: ['cat'] }, { ...fixed, indication: '' },
    { ...fixed, sourceUrl: 'javascript:alert(1)' }, { ...fixed, sourceSection: null },
    { ...fixed, sourceCheckedAt: '' }, { ...fixed, dose: '100' },
    { ...fixed, dose: NaN }, { ...fixed, dose: Infinity },
    { ...fixed, doseRange: { min: 50, max: 100 } },
    { ...fixed, frequencyOptions: [2, 3] }, { ...fixed, frequency: 2.5 },
    { ...ranged, doseRange: { min: 40, max: 20 } },
    { ...ranged, frequencyOptions: [2, 2] },
    { ...ranged, frequencyOptions: [] },
    { ...fixed, minAgeMonths: 13, maxAgeMonths: 12 },
    { ...fixed, minWeight: 40, maxWeight: 40, minWeightExclusive: true },
    { ...fixed, maxAgeExclusive: true },
    { ...fixed, minAgeExclusive: 'false' },
    { ...fixed, renalPolicy: 'automatically-adjust' },
    { ...fixed, minCrClExclusive: true },
    { ...fixed, asNeeded: 'true' }, { ...fixed, requireCrCl: 'false' },
    { ...fixed, maxDailyMg: -1 }, { ...fixed, maxDailyMgPerKg: NaN },
    { ...fixed, minDays: 7, maxDays: 5 },
    { ...fixed, fixedDays: 7, maxDays: 5 }, { ...fixed, reviewAfterDays: 0 },
    { ...fixed, minIntervalHours: 12 },
  ];
  assert.deepEqual(availableHumanRegimens(bad, context), []);
  for (const record of bad) {
    const result = resolveHumanRegimen(record, context);
    assert.equal(result.valid, false);
    assert.equal(result.dose, null);
    assert.equal(result.frequency, null);
    assert.ok(result.errors.length);
  }
});

test('missing or malformed context and reference-only products fail closed', () => {
  for (const bad of [null, [], true, {}, { ...context, calculationBlocked: true }]) {
    assert.equal(resolveHumanRegimen(fixed, bad).valid, false);
    assert.deepEqual(availableHumanRegimens([fixed], bad), []);
  }
});

test('source ranges require a clinician choice and preserve that choice on subsequent resolutions', () => {
  const withoutChoice = resolveHumanRegimen(ranged, { ...child, dose: null, frequency: null });
  assert.equal(withoutChoice.valid, false);
  assert.equal(withoutChoice.dose, null);
  assert.equal(withoutChoice.frequency, null);
  assert.deepEqual(withoutChoice.doseRange, { min: 20, max: 40 });
  assert.deepEqual(withoutChoice.frequencyOptions, [2, 3]);
  for (const weight of [20, 21, 25]) {
    const selected = resolveHumanRegimen(ranged, { ...child, dose: 32.5, frequency: 2, weight });
    assert.equal(selected.valid, true);
    assert.equal(selected.dose, 32.5);
    assert.equal(selected.frequency, 2);
  }
  for (const change of [{ dose: 19.9 }, { dose: 40.1 }, { dose: '30' },
    { frequency: 1 }, { frequency: 4 }, { frequency: 2.5 }, { frequency: '2' }]) {
    assert.equal(resolveHumanRegimen(ranged, { ...child, ...change }).valid, false);
  }
  for (const dose of [20, 40]) assert.equal(resolveHumanRegimen(ranged, { ...child, dose }).valid, true);
});

test('fixed source values do not require user re-entry but cannot be overwritten under the same source label', () => {
  const result = resolveHumanRegimen(fixed, context);
  assert.equal(result.valid, true);
  assert.equal(result.dose, 100);
  assert.equal(result.frequency, 3);
  assert.deepEqual(result.requirements, ['days']);
  assert.equal(resolveHumanRegimen(fixed, { ...context, dose: 100, frequency: 3 }).valid, true);
  for (const change of [{ dose: 200 }, { frequency: 2 }, { dose: '100' }, { frequency: NaN }]) {
    assert.equal(resolveHumanRegimen(fixed, { ...context, ...change }).valid, false);
  }
});

test('missing clinical context blocks use without deleting the known source candidate', () => {
  const record = { ...fixed, minAgeMonths: 36, minWeight: 10, renalPolicy: 'normal-only' };
  const result = resolveHumanRegimen(record, { ...context, days: null });
  assert.equal(result.valid, false);
  assert.equal(result.dose, 100);
  assert.equal(result.frequency, 3);
  assert.deepEqual(new Set(result.requirements), new Set(['age', 'weight', 'days']));
  const completed = resolveHumanRegimen(record, {
    ...context, age: 5, ageUnit: 'years', weight: 20, renalStatus: 'normal',
  });
  assert.equal(completed.valid, true);
  assert.deepEqual(completed.requirements, result.requirements);
});

test('source maximum per kg becomes a current-patient ceiling and is tightened by an absolute cap', () => {
  const record = { ...ranged, maxDailyMg: 1000, maxDailyMgPerKg: 35, limitLabel: 'Limit tego schematu' };
  const light = resolveHumanRegimen(record, { ...child, weight: 20 });
  assert.equal(light.valid, true);
  assert.equal(light.maxDailyMgPerKg, 35);
  assert.equal(light.maxDailyMg, 700);
  assert.equal(light.limitLabel, 'Limit tego schematu');
  const heavier = resolveHumanRegimen(record, { ...child, weight: 35, dose: 25 });
  assert.equal(heavier.valid, true);
  assert.equal(heavier.maxDailyMg, 1000);
  assert.equal(resolveHumanRegimen(record, { ...child, dose: 36 }).valid, false);
  assert.equal(resolveHumanRegimen(record, { ...child, weight: 35 }).valid, false);
});

test('a per-kg-per-day source upper endpoint is scoped to the selected regimen and never selected as the dose', () => {
  const result = resolveHumanRegimen(ranged, child);
  assert.equal(result.valid, true);
  assert.equal(result.dose, 30);
  assert.equal(result.maxDailyMg, 800);
  assert.equal(result.maxDailyMgPerKg, 40);
  assert.match(result.limitLabel, /wybranego schematu/);
  const noWeight = resolveHumanRegimen(ranged, { ...child, weight: null });
  assert.equal(noWeight.valid, false);
  assert.equal(noWeight.maxDailyMg, null);
  assert.equal(noWeight.maxDailyMgPerKg, 40);
});

test('per-kg dose and per-kg daily amount have different total-day semantics', () => {
  const record = { ...fixed, doseMode: 'perKgDay', dose: 5, maxDailyMg: 100 };
  const person = { ...context, weight: 20 };
  assert.equal(resolveHumanRegimen(record, person).valid, true);
  const perDose = resolveHumanRegimen({ ...record, doseMode: 'perKgDose' }, person);
  assert.equal(perDose.valid, false);
  assert.match(perDose.errors.join(' '), /dobowa/);
});

test('single-dose ceilings also use the stricter per-kg and absolute limit', () => {
  const record = { ...fixed, doseMode: 'perKgDose', dose: 4, maxSingleMgPerKg: 5, maxSingleMg: 90 };
  const light = resolveHumanRegimen(record, { ...context, weight: 10 });
  assert.equal(light.valid, true);
  assert.equal(light.maxSingleMg, 50);
  const heavy = resolveHumanRegimen(record, { ...context, weight: 25 });
  assert.equal(heavy.valid, false);
  assert.equal(heavy.maxSingleMg, 90);
  assert.match(heavy.errors.join(' '), /jednorazowa/);
});

test('age and weight boundaries honor inclusive and exclusive wording', () => {
  const record = { ...fixed, minAgeMonths: 144, minAgeExclusive: true, minWeight: 50, minWeightExclusive: true };
  assert.equal(resolveHumanRegimen(record, { ...context, age: 12, ageUnit: 'years', weight: 51 }).valid, false);
  assert.equal(resolveHumanRegimen(record, { ...context, age: 145, ageUnit: 'months', weight: 50 }).valid, false);
  assert.equal(resolveHumanRegimen(record, { ...context, age: 145, ageUnit: 'months', weight: 50.1 }).valid, true);
  const maximum = { ...fixed, maxAgeMonths: 144, maxWeight: 40, maxWeightExclusive: true };
  assert.equal(resolveHumanRegimen(maximum, { ...context, age: 12, ageUnit: 'years', weight: 39.9 }).valid, true);
  assert.equal(resolveHumanRegimen(maximum, { ...context, age: 12, ageUnit: 'years', weight: 40 }).valid, false);
  assert.equal(resolveHumanRegimen({ ...maximum, maxAgeExclusive: true }, { ...context, age: 12, ageUnit: 'years', weight: 39 }).valid, false);
});

test('infant age uses month precision and ambiguous day conversions never pass a threshold', () => {
  const record = { ...fixed, minAgeMonths: 2 };
  assert.equal(resolveHumanRegimen(record, { ...context, age: 1, ageUnit: 'months' }).valid, false);
  assert.equal(resolveHumanRegimen(record, { ...context, age: 2, ageUnit: 'months' }).valid, true);
  assert.equal(resolveHumanRegimen(record, { ...context, age: 0.25, ageUnit: 'years' }).valid, true);
  assert.equal(resolveHumanRegimen(record, { ...context, age: 55, ageUnit: 'days' }).valid, false);
  const ambiguous = resolveHumanRegimen(record, { ...context, age: 60, ageUnit: 'days' });
  assert.equal(ambiguous.valid, false);
  assert.match(ambiguous.errors.join(' '), /ukończonych miesiącach/);
  assert.equal(resolveHumanRegimen(record, { ...context, age: 62, ageUnit: 'days' }).valid, true);
  const upper = { ...fixed, maxAgeMonths: 3 };
  assert.equal(resolveHumanRegimen(upper, { ...context, age: 84, ageUnit: 'days' }).valid, true);
  assert.equal(resolveHumanRegimen(upper, { ...context, age: 90, ageUnit: 'days' }).valid, false);
});

test('invalid supplied age and weight are not silently ignored', () => {
  for (const age of [-1, NaN, Infinity, '12', 131]) {
    assert.equal(resolveHumanRegimen(fixed, { ...context, age, ageUnit: 'years' }).valid, false);
  }
  assert.equal(resolveHumanRegimen(fixed, { ...context, age: 3, ageUnit: 'weeks' }).valid, false);
  assert.equal(resolveHumanRegimen(fixed, { ...context, age: 3 }).valid, false);
  for (const weight of [0, -1, NaN, Infinity, '20', 501]) {
    assert.equal(resolveHumanRegimen(fixed, { ...context, weight }).valid, false);
  }
});

test('optional renal context permits arithmetic without asserting normal function and keeps known limits', () => {
  const record = { ...fixed, renalPolicy: 'normal-only', minCrCl: 30, minCrClExclusive: true };
  for (const renalStatus of [undefined, null, 'unknown']) {
    const supplied = { ...context, renalStatus };
    const result = resolveHumanRegimen(record, supplied);
    assert.equal(result.valid, true);
    assert.equal(result.requirements.includes('renalStatus'), false);
    assert.match(result.warnings.join(' '), /bez oceny czynności nerek/);
    assert.equal(supplied.renalStatus, renalStatus);
  }
  for (const renalStatus of ['impaired', 'Normal', true]) {
    assert.equal(resolveHumanRegimen(record, { ...context, renalStatus }).valid, false);
  }
  assert.equal(resolveHumanRegimen(record, { ...context, renalStatus: 'normal' }).valid, true);
  const eligible = { ...context, renalStatus: 'unknown' };
  assert.equal(resolveHumanRegimen(record, { ...eligible, crcl: 30.1 }).valid, true);
  for (const crcl of [30, 29, 0, -1, NaN, Infinity, '60']) {
    assert.equal(resolveHumanRegimen(record, { ...eligible, crcl }).valid, false);
  }
  assert.equal(resolveHumanRegimen({ ...record, minCrClExclusive: false }, { ...eligible, crcl: 30 }).valid, true);
  assert.equal(resolveHumanRegimen(record, { ...eligible, renalStatus: 'impaired', crcl: 90 }).valid, false);
});

test('known impairment still blocks a source with no numeric CrCl threshold', () => {
  const record = { ...fixed, renalPolicy: 'normal-only' };
  const unknown = resolveHumanRegimen(record, { ...context, renalStatus: 'unknown', crcl: 90 });
  assert.equal(unknown.valid, true);
  assert.match(unknown.warnings.join(' '), /bez oceny czynności nerek/);
  for (const crcl of [undefined, 90]) {
    assert.equal(resolveHumanRegimen(record, { ...context, renalStatus: 'impaired', crcl }).valid, false);
  }
});

test('only an explicit requireCrCl flag makes numeric CrCl mandatory; eGFR is not substituted', () => {
  const record = { ...fixed, requireCrCl: true, minCrCl: 30 };
  const missingCrCl = resolveHumanRegimen(record, { ...context, egfr: 90 });
  assert.equal(missingCrCl.valid, false);
  assert.ok(missingCrCl.requirements.includes('crcl'));
  assert.equal(resolveHumanRegimen(record, { ...context, crcl: 90 }).valid, true);
});

test('numeric duration is required and no source upper bound becomes a default course', () => {
  const record = { ...fixed, minDays: 3, maxDays: 7 };
  const absent = resolveHumanRegimen(record, { ...context, days: null });
  assert.equal(absent.valid, false);
  assert.equal(absent.fixedDays, null);
  assert.equal(absent.minDays, 3);
  assert.equal(absent.maxDays, 7);
  for (const days of [3, 5, 7]) assert.equal(resolveHumanRegimen(record, { ...context, days }).valid, true);
  for (const days of [2, 8, 0, 2.5, '5', Infinity]) assert.equal(resolveHumanRegimen(record, { ...context, days }).valid, false);
  const fixedCourse = { ...record, fixedDays: 5 };
  assert.equal(resolveHumanRegimen(fixedCourse, { ...context, days: 5 }).valid, true);
  assert.equal(resolveHumanRegimen(fixedCourse, { ...context, days: 4 }).valid, false);
});

test('review duration is advisory and is distinct from a maximum or preset duration', () => {
  const record = { ...fixed, reviewAfterDays: 3 };
  const result = resolveHumanRegimen(record, context);
  assert.equal(result.valid, true);
  assert.equal(result.fixedDays, null);
  assert.equal(result.maxDays, null);
  assert.match(result.warnings.join(' '), /ponownej oceny/);
});

test('PRN dose, daily count, total maximum and minimum interval are checked together', () => {
  const record = {
    ...source, doseMode: 'fixed', doseRange: { min: 200, max: 400 },
    frequencyOptions: [1, 2, 3, 4, 5, 6, 7], asNeeded: true,
    minIntervalHours: 4, maxDailyMg: 1200,
  };
  for (const [dose, frequency] of [[200, 6], [400, 3]]) {
    const result = resolveHumanRegimen(record, { ...context, dose, frequency });
    assert.equal(result.valid, true);
    assert.equal(result.asNeeded, true);
    assert.equal(result.minIntervalHours, 4);
  }
  const excessive = resolveHumanRegimen(record, { ...context, dose: 400, frequency: 4 });
  assert.equal(excessive.valid, false);
  assert.match(excessive.errors.join(' '), /dobowa/);
  const interval = resolveHumanRegimen({ ...record, maxDailyMg: 2000 }, { ...context, dose: 200, frequency: 7 });
  assert.equal(interval.valid, false);
  assert.match(interval.errors.join(' '), /odstępu/);
});

test('unit-based source limits control both per-application and daily amounts', () => {
  const record = {
    ...source, doseMode: 'units', doseRange: { min: 1, max: 8 },
    frequencyOptions: [1, 2, 3, 4], maxUnitsPerDose: 4, maxDailyUnits: 12,
  };
  assert.equal(resolveHumanRegimen(record, { ...context, dose: 4, frequency: 3 }).valid, true);
  assert.equal(resolveHumanRegimen(record, { ...context, dose: 5, frequency: 1 }).valid, false);
  assert.equal(resolveHumanRegimen(record, { ...context, dose: 4, frequency: 4 }).valid, false);
});

test('qualitative application instructions expose no fabricated dose, grams, mg or package count', () => {
  const record = { ...source, doseMode: 'instruction', instructionText: 'Nałożyć ilość opisaną w instrukcji.', amountText: 'pasek około 1 cm' };
  const result = resolveHumanRegimen(record, { ...context, days: null, dose: 123, frequency: 99 });
  assert.equal(result.valid, true);
  assert.equal(result.doseMode, 'instruction');
  assert.equal(result.dose, null);
  assert.equal(result.frequency, null);
  assert.equal(result.maxDailyMg, null);
  assert.equal(result.amountText, record.amountText);
  assert.equal(Object.hasOwn(result, 'packages'), false);
  assert.deepEqual(result.requirements, []);
  assert.equal(resolveHumanRegimen({ ...record, dose: 0.2 }, context).valid, false);
  assert.equal(resolveHumanRegimen({ ...record, instructionText: '' }, context).valid, false);
});

test('instruction sources can require a frequency choice or duration explicitly', () => {
  const record = {
    ...source, doseMode: 'instruction', instructionText: 'Ilość zgodna z opisem producenta.',
    frequencyOptions: [2, 3],
  };
  assert.equal(resolveHumanRegimen(record, { ...context, days: null }).valid, false);
  const chosen = resolveHumanRegimen(record, { ...context, days: null, frequency: 3 });
  assert.equal(chosen.valid, true);
  assert.equal(chosen.frequency, 3);
  assert.equal(chosen.dose, null);
  assert.deepEqual(chosen.requirements, ['frequency']);
  const required = resolveHumanRegimen({ ...record, requiresDuration: true }, { ...context, days: null, frequency: 3 });
  assert.equal(required.valid, false);
  assert.ok(required.requirements.includes('days'));
  assert.equal(resolveHumanRegimen({ ...record, maxDays: 7 }, { ...context, days: 8, frequency: 3 }).valid, false);
});

test('a source-bounded qualitative treatment cannot be exported with an open-ended duration', () => {
  const record = { ...source, doseMode: 'instruction', instructionText: 'Stosować miejscowo zgodnie z opisem.' };
  for (const bounds of [{ maxDays: 5 }, { minDays: 7, maxDays: 10 }, { fixedDays: 3 }]) {
    const missingDays = resolveHumanRegimen({ ...record, ...bounds }, { ...context, days: null });
    assert.equal(missingDays.valid, false);
    assert.ok(missingDays.requirements.includes('days'));
    assert.match(missingDays.errors.join(' '), /czas stosowania/);
  }
  assert.equal(resolveHumanRegimen({ ...record, maxDays: 5 }, { ...context, days: 5 }).valid, true);
  assert.equal(resolveHumanRegimen({ ...record, minDays: 7, maxDays: 10 }, { ...context, days: 7 }).valid, true);
  assert.equal(resolveHumanRegimen({ ...record, fixedDays: 3 }, { ...context, days: 3 }).valid, true);
  const reviewOnly = resolveHumanRegimen({ ...record, reviewAfterDays: 7 }, { ...context, days: null });
  assert.equal(reviewOnly.valid, true);
  assert.ok(!reviewOnly.requirements.includes('days'));
});

test('the resolver and available options do not mutate source records or context', () => {
  const records = [structuredClone(ranged)];
  const person = structuredClone(child);
  const originalRecords = structuredClone(records);
  const originalPerson = structuredClone(person);
  const options = availableHumanRegimens(records, person);
  options[0].formIds.push('other');
  options[0].specialties.push('other');
  options[0].doseRange.max = 999;
  options[0].frequencyOptions.push(12);
  const result = resolveHumanRegimen(records[0], person);
  result.doseRange.max = 999;
  result.frequencyOptions.push(24);
  assert.deepEqual(records, originalRecords);
  assert.deepEqual(person, originalPerson);
});

test('the final numeric engine still checks rounded-dose maxima and physical formulation constraints', () => {
  const record = { ...ranged, doseRange: { min: 20, max: 21 }, maxDailyMgPerKg: 21 };
  const resolved = resolveHumanRegimen(record, { ...child, dose: 21, frequency: 2, weight: 10 });
  assert.equal(resolved.valid, true);
  const arithmetic = calculate({
    form: 'suspension', doseMode: resolved.doseMode, dose: resolved.dose,
    weight: 10, frequency: resolved.frequency, days: 5,
    concentrationMg: 100, concentrationMl: 5, unitLabel: 'ml', packageSize: 100,
    roundingStep: 1, maxDailyMg: resolved.maxDailyMg,
  });
  // 5.25 ml rounds down to 5 ml with this step: the source ceiling remains 210 mg.
  assert.equal(arithmetic.valid, true);
  assert.ok(Math.abs(arithmetic.maxRatio - 200 / 210) < 1e-12);
  const roundedUp = calculate({
    form: 'suspension', doseMode: resolved.doseMode, dose: resolved.dose,
    weight: 10, frequency: resolved.frequency, days: 5,
    concentrationMg: 100, concentrationMl: 5, unitLabel: 'ml', packageSize: 100,
    roundingStep: 3, maxDailyMg: resolved.maxDailyMg,
  });
  assert.equal(roundedUp.valid, false);
  assert.match(roundedUp.errors.join(' '), /dobowa/);
  const spray = calculate({
    form: 'spray', doseMode: 'units', dose: 1.5, frequency: 2, days: 3,
    unitLabel: 'rozpylenia', packageSize: 100,
  });
  assert.equal(spray.valid, false);
  assert.match(spray.errors.join(' '), /Ułamkowa/);
});

test('overflow in a derived per-kg ceiling cannot create an infinite permitted dose', () => {
  const record = { ...fixed, maxDailyMgPerKg: Number.MAX_VALUE };
  const result = resolveHumanRegimen(record, { ...context, weight: 2 });
  assert.equal(result.valid, false);
  assert.equal(result.maxDailyMg, null);
  assert.match(result.errors.join(' '), /poza zakresem/);
  const units = resolveHumanRegimen({ ...fixed, doseMode: 'units', dose: Number.MAX_VALUE }, context);
  assert.equal(units.valid, false);
  assert.match(units.errors.join(' '), /poza zakresem/);
});

test('the researched systemic records enforce their actual product and population limits', () => {
  const find = id => DENTAL_SYSTEMIC_REGIMENS.find(record => record.id === id);
  const augmentin = find('dental-augmentin-400-57-child');
  const infant = {
    ...context, formId: 'augmentin-400-57', patientType: 'child',
    age: 2, ageUnit: 'months', weight: 5, dose: 45, renalStatus: 'normal', days: 7,
  };
  const result = resolveHumanRegimen(augmentin, infant);
  assert.equal(result.valid, true);
  assert.equal(result.frequency, 2);
  assert.equal(result.maxDailyMg, 225);
  for (const changes of [{ age: 1 }, { weight: 40 }, { dose: 90 }, { crcl: 25 }]) {
    assert.equal(resolveHumanRegimen(augmentin, { ...infant, ...changes }).valid, false);
  }
  const ospamox = find('dental-ospamox-child-tid');
  const childDose = { ...infant, formId: 'ospamox-250', dose: 30 };
  assert.equal(resolveHumanRegimen(ospamox, childDose).valid, true);
  assert.equal(resolveHumanRegimen(ospamox, childDose).frequency, 3);
  assert.equal(resolveHumanRegimen(ospamox, { ...childDose, frequency: 2 }).valid, false);
  const ibuprom = find('dental-ibuprom-200-over12');
  const adultPain = {
    ...context, formId: 'ibuprom-200', age: 30, ageUnit: 'years',
    dose: 400, frequency: 3, renalStatus: 'normal', days: 3,
  };
  assert.equal(resolveHumanRegimen(ibuprom, adultPain).valid, true);
  assert.equal(resolveHumanRegimen(ibuprom, { ...adultPain, frequency: 4 }).valid, false);
  const paracetamol = find('dental-metafen-paracetamol-over12-over50');
  const paracetamolContext = { ...adultPain, formId: 'metafen-paracetamol-500', dose: 1000, frequency: 4, weight: 50 };
  assert.equal(resolveHumanRegimen(paracetamol, paracetamolContext).valid, false);
  assert.equal(resolveHumanRegimen(paracetamol, { ...paracetamolContext, weight: 50.1 }).valid, true);
});

test('the researched topical records preserve qualitative quantities and bounded treatment time', () => {
  const find = id => DENTAL_TOPICAL_REGIMENS.find(record => record.id === id);
  const adult = { ...context, age: 30, ageUnit: 'years', days: null };
  const sachol = resolveHumanRegimen(find('sachol-mucosa'), {
    ...adult, formId: 'sachol-gel', frequency: 3,
  });
  assert.equal(sachol.valid, true);
  assert.equal(sachol.dose, null);
  assert.match(sachol.instructionText, /około 1 cm/);
  const dezaftanContext = { ...adult, formId: 'dezaftan-med-spray' };
  assert.equal(resolveHumanRegimen(find('dezaftan-med-adult'), dezaftanContext).valid, false);
  assert.equal(resolveHumanRegimen(find('dezaftan-med-adult'), { ...dezaftanContext, days: 5 }).valid, true);
  assert.equal(resolveHumanRegimen(find('dezaftan-med-adult'), { ...dezaftanContext, days: 6 }).valid, false);
  const periodontal = { ...adult, formId: 'metronidazol-chema-ointment' };
  assert.equal(resolveHumanRegimen(find('metronidazole-periodontal'), periodontal).valid, false);
  const course = resolveHumanRegimen(find('metronidazole-periodontal'), { ...periodontal, days: 7 });
  assert.equal(course.valid, true);
  assert.equal(course.frequency, 2);
  assert.equal(course.dose, null);
});
