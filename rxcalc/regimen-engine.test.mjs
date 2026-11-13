import test from 'node:test';
import assert from 'node:assert/strict';
import { availableRegimens, resolveRegimen } from './regimen-engine.js';

// Synthetic resolver fixtures, not an independent source of clinical dosing.
const weightBased = {
  id: 'dog-phase', formIds: ['dog-liquid'], species: ['dog'],
  doseMode: 'perKgDose', dose: 0.1, frequency: 1,
  minimumAge: { value: 6, unit: 'weeks' },
};
const dog = { formId: 'dog-liquid', species: 'dog', weight: 12, age: 10, ageUnit: 'weeks', days: null };
const catBands = {
  id: 'cat-table', formIds: ['cat-tablet'], species: ['cat'], doseMode: 'units', frequency: 1,
  weightBands: [
    { min: 2.5, max: 6, minInclusive: true, maxInclusive: true, units: 1 },
    { min: 6, max: 12, minInclusive: false, maxInclusive: true, units: 2 },
  ],
};
const cat = { formId: 'cat-tablet', species: 'cat', weight: 4, age: null, ageUnit: 'months', days: null };
const horseRestricted = {
  id: 'horse-food-restricted', formIds: ['horse-oral'], species: ['horse'],
  doseMode: 'perKgDose', dose: 1, frequency: 1, requiresFoodChainExclusion: true,
};
const horse = { formId: 'horse-oral', species: 'horse', weight: 500, age: null, ageUnit: 'years', days: null };

test('food-chain metadata is optional but must be a literal boolean when supplied', () => {
  for (const requiresFoodChainExclusion of [undefined, null, 'true', 'false', 0, 1, [], {}]) {
    const record = { ...horseRestricted, requiresFoodChainExclusion };
    const result = resolveRegimen(record, { ...horse, foodChainStatus: 'excluded' });
    assert.equal(result.valid, false);
    assert.equal(result.dose, null);
    assert.match(result.errors.join(' '), /warunek wykluczenia/);
    assert.deepEqual(availableRegimens([record], horse), []);
  }
  assert.equal(resolveRegimen(weightBased, dog).valid, true);
  assert.equal(resolveRegimen({ ...weightBased, requiresFoodChainExclusion: false }, dog).valid, true);
  assert.equal(resolveRegimen({ ...horseRestricted, requiresFoodChainExclusion: false }, horse).valid, true);
});

test('a true food-chain restriction is coherent only with horse-only source records', () => {
  for (const species of [['dog'], ['horse', 'dog'], ['horse', 'cat']]) {
    const record = { ...horseRestricted, species };
    const context = { ...horse, species: species[0], foodChainStatus: 'excluded' };
    const result = resolveRegimen(record, context);
    assert.equal(result.valid, false);
    assert.equal(result.dose, null);
    assert.match(result.errors.join(' '), /wyłącznie dla koni/);
    assert.deepEqual(availableRegimens([record], context), []);
  }
  assert.equal(resolveRegimen(horseRestricted, { ...horse, foodChainStatus: 'excluded' }).valid, true);
});

test('well-formed restricted regimens remain visible before food-chain status is chosen', () => {
  for (const foodChainStatus of [undefined, null, 'unknown', 'notExcluded', 'excluded', 'invalid']) {
    const available = availableRegimens([horseRestricted], { ...horse, foodChainStatus });
    assert.equal(available.length, 1);
    assert.equal(available[0].id, horseRestricted.id);
    assert.equal(available[0].requiresFoodChainExclusion, true);
  }
});

test('restricted resolution requires the exact excluded status and fails closed otherwise', () => {
  const allowed = resolveRegimen(horseRestricted, { ...horse, foodChainStatus: 'excluded' });
  assert.equal(allowed.valid, true);
  assert.deepEqual(allowed.errors, []);
  const contexts = [horse, ...[undefined, null, 'unknown', 'notExcluded', 'invalid', 'Excluded', ' excluded', 'excluded ', true, false, 0, 1, [], {}]
    .map(foodChainStatus => ({ ...horse, foodChainStatus }))];
  for (const context of contexts) {
    const result = resolveRegimen(horseRestricted, context);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /paszport/);
    assert.match(result.errors.join(' '), /potwierdź status wykluczenia/);
  }
});

test('each resolution rechecks the current food-chain status without changing other constraints', () => {
  const context = { ...horse, foodChainStatus: 'excluded' };
  assert.equal(resolveRegimen(horseRestricted, context).valid, true);
  context.foodChainStatus = 'unknown';
  assert.equal(resolveRegimen(horseRestricted, context).valid, false);
  context.foodChainStatus = 'notExcluded';
  assert.equal(resolveRegimen(horseRestricted, context).valid, false);
  context.foodChainStatus = 'excluded';
  assert.equal(resolveRegimen(horseRestricted, context).valid, true);
  const bounded = { ...horseRestricted, maxDays: 5 };
  const invalid = resolveRegimen(bounded, { ...horse, weight: 0, days: 6 });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(' '), /masę/);
  assert.match(invalid.errors.join(' '), /limit/);
  assert.match(invalid.errors.join(' '), /paszport/);
  assert.equal(resolveRegimen({ ...horseRestricted, requiresFoodChainExclusion: false }, { ...horse, foodChainStatus: 'invalid' }).valid, true);
});

test('a regimen is available only for its exact formulation and species', () => {
  const records = [weightBased, catBands];
  assert.deepEqual(availableRegimens(records, dog).map(r => r.id), ['dog-phase']);
  assert.deepEqual(availableRegimens(records, cat).map(r => r.id), ['cat-table']);
  for (const context of [{}, { ...dog, species: 'cat' }, { ...dog, formId: 'other-strength' }, { ...dog, calculationBlocked: true }]) {
    assert.deepEqual(availableRegimens(records, context), []);
    const result = resolveRegimen(weightBased, context);
    assert.equal(result.valid, false);
    assert.equal(result.dose, null);
  }
});

test('missing or malformed records never produce a suggested dose', () => {
  const bad = [undefined, null, {}, { ...weightBased, dose: null }, { ...weightBased, dose: NaN },
    { ...weightBased, dose: Infinity }, { ...weightBased, dose: -0.1 }, { ...weightBased, dose: '0.1' },
    { ...weightBased, frequency: 0 }, { ...weightBased, frequency: 1.5 }, { ...weightBased, frequency: Infinity },
    { ...weightBased, doseMode: 'fixed' }, { ...weightBased, formIds: 'dog-liquid' },
    { ...weightBased, minimumAge: { value: 6, unit: 'fortnights' } },
    { ...weightBased, fixedDays: 1.5 }, { ...weightBased, maxDays: 0 },
    { ...weightBased, fixedDays: 7, maxDays: 1 }, { ...weightBased, minWeight: 15, maxWeight: 10 },
  ];
  for (const record of bad) {
    const result = resolveRegimen(record, dog);
    assert.equal(result.valid, false);
    assert.equal(result.dose, null);
    assert.ok(result.errors.length);
  }
  assert.deepEqual(availableRegimens(bad, dog), []);
});

test('preparation blocks cannot be bypassed by mg/kg or unit regimens', () => {
  for (const [record, context] of [[weightBased, dog], [catBands, cat]]) {
    const result = resolveRegimen(record, { ...context, calculationBlocked: true });
    assert.equal(result.valid, false);
    assert.equal(result.dose, null);
    assert.equal(result.frequency, null);
    assert.match(result.errors.join(' '), /przygotowania/);
  }
});

test('matching mg/kg candidates retain explicit unit semantics without inventing duration', () => {
  for (const doseMode of ['perKgDose', 'perKgDay']) {
    const result = resolveRegimen({ ...weightBased, doseMode }, dog);
    assert.equal(result.valid, true);
    assert.equal(result.doseMode, doseMode);
    assert.equal(result.dose, 0.1);
    assert.equal(result.frequency, 1);
    assert.equal(result.fixedDays, null);
    assert.equal(result.minDays, null);
    assert.equal(result.maxDays, null);
  }
});

test('missing required patient data blocks application even when a fixed candidate is known', () => {
  const result = resolveRegimen(weightBased, { ...dog, age: null, weight: null });
  assert.equal(result.valid, false);
  assert.equal(result.dose, 0.1);
  assert.match(result.errors.join(' '), /wiek/);
  assert.match(result.errors.join(' '), /masę/);
  const table = resolveRegimen(catBands, { ...cat, weight: null });
  assert.equal(table.valid, false);
  assert.equal(table.dose, null);
});

test('weight is required and validated for all source regimens including constant units', () => {
  for (const weight of [null, undefined, 0, -1, NaN, Infinity, '12']) {
    for (const record of [weightBased, { ...weightBased, doseMode: 'units', dose: 1 }]) {
      const result = resolveRegimen(record, { ...dog, weight });
      assert.equal(result.valid, false);
      assert.match(result.errors.join(' '), /masę/);
    }
  }
  const bounded = { ...weightBased, minWeight: 3, maxWeight: 10 };
  assert.equal(resolveRegimen(bounded, { ...dog, weight: 3 }).valid, true);
  assert.equal(resolveRegimen(bounded, { ...dog, weight: 10 }).valid, true);
  assert.equal(resolveRegimen(bounded, { ...dog, weight: 2.99 }).valid, false);
  assert.equal(resolveRegimen(bounded, { ...dog, weight: 10.01 }).valid, false);
});

test('first-day scheme permits one day and rejects the multi-day shortcut', () => {
  const initial = { ...weightBased, fixedDays: 1, maxDays: 1 };
  const suggestion = resolveRegimen(initial, dog);
  assert.equal(suggestion.valid, true);
  assert.equal(suggestion.fixedDays, 1);
  assert.equal(resolveRegimen(initial, { ...dog, days: 1 }).valid, true);
  assert.equal(resolveRegimen(initial, { ...dog, days: 7 }).valid, false);
  assert.match(resolveRegimen(initial, { ...dog, days: 7 }).errors.join(' '), /dokładnie 1 dzień/);
});

test('a maximum duration is inclusive and is never inserted as the chosen duration', () => {
  const limited = { ...weightBased, maxDays: 5 };
  const suggestion = resolveRegimen(limited, dog);
  assert.equal(suggestion.valid, true);
  assert.equal(suggestion.fixedDays, null);
  assert.equal(suggestion.maxDays, 5);
  assert.equal(resolveRegimen(limited, { ...dog, days: 5 }).valid, true);
  assert.equal(resolveRegimen(limited, { ...dog, days: 6 }).valid, false);
  for (const days of [0, -1, 1.5, Infinity, NaN, '5']) assert.equal(resolveRegimen(limited, { ...dog, days }).valid, false);
});

test('minimum duration is inclusive, permits longer courses, and stays optional', () => {
  const limited = { ...weightBased, minDays: 10 };
  const tooShort = resolveRegimen(limited, { ...dog, days: 9 });
  assert.equal(tooShort.valid, false);
  assert.match(tooShort.errors.join(' '), /minimum.*10 dni/);
  assert.equal(resolveRegimen(limited, { ...dog, days: 10 }).valid, true);
  assert.equal(resolveRegimen(limited, { ...dog, days: 11 }).valid, true);
  assert.equal(resolveRegimen(weightBased, { ...dog, days: 1 }).valid, true);
  assert.equal(resolveRegimen(weightBased, dog).minDays, null);
});

test('a duration range enforces both endpoints and does not choose a missing duration', () => {
  const ranged = { ...weightBased, minDays: 10, maxDays: 14 };
  const context = { ...dog, days: null };
  const suggestion = resolveRegimen(ranged, context);
  assert.equal(suggestion.valid, true);
  assert.equal(suggestion.minDays, 10);
  assert.equal(suggestion.maxDays, 14);
  assert.equal(suggestion.fixedDays, null);
  assert.equal(context.days, null);
  assert.equal(Object.hasOwn(suggestion, 'days'), false);
  assert.equal(resolveRegimen(ranged, { ...dog, days: undefined }).valid, true);
  for (const days of [10, 11, 14]) assert.equal(resolveRegimen(ranged, { ...dog, days }).valid, true);
  for (const days of [9, 15]) assert.equal(resolveRegimen(ranged, { ...dog, days }).valid, false);
});

test('malformed or contradictory minimum duration constraints cannot expose a dose or option', () => {
  const malformed = [
    ...[0, -1, 1.5, NaN, Infinity, '10'].map(minDays => ({ ...weightBased, minDays })),
    { ...weightBased, minDays: 15, maxDays: 14 },
    { ...weightBased, minDays: 10, fixedDays: 9 },
    { ...weightBased, minDays: 10, maxDays: 14, fixedDays: 15 },
  ];
  assert.deepEqual(availableRegimens(malformed, dog), []);
  for (const record of malformed) {
    const result = resolveRegimen(record, { ...dog, days: 12 });
    assert.equal(result.valid, false);
    assert.equal(result.dose, null);
    assert.equal(result.minDays, null);
    assert.ok(result.errors.length);
  }
});

test('fixed duration can equal either bound of a valid duration range', () => {
  for (const fixedDays of [10, 12, 14]) {
    const record = { ...weightBased, minDays: 10, maxDays: 14, fixedDays };
    assert.equal(availableRegimens([record], dog).length, 1);
    assert.equal(resolveRegimen(record, { ...dog, days: fixedDays }).valid, true);
    assert.equal(resolveRegimen(record, { ...dog, days: fixedDays + 1 }).valid, false);
  }
  const exact = { ...weightBased, minDays: 10, maxDays: 10, fixedDays: 10 };
  assert.equal(resolveRegimen(exact, { ...dog, days: 10 }).valid, true);
});

test('tablet band boundaries 2.5, 6 and 12 are literal without nearest-band rounding', () => {
  for (const [weight, expectedDose] of [[2.5, 1], [5.999, 1], [6, 1], [6.00001, 2], [12, 2]]) {
    const result = resolveRegimen(catBands, { ...cat, weight });
    assert.equal(result.valid, true, String(weight));
    assert.equal(result.doseMode, 'units');
    assert.equal(result.dose, expectedDose, String(weight));
  }
  for (const weight of [2.49999, 12.00001]) {
    const result = resolveRegimen(catBands, { ...cat, weight });
    assert.equal(result.valid, false);
    assert.equal(result.dose, null);
  }
});

test('gaps in source tablet tables remain unsupported instead of rounding weight', () => {
  const bands = { ...catBands, weightBands: [
    { min: 3, max: 4, minInclusive: true, maxInclusive: true, units: 0.5 },
    { min: 4.1, max: 8, minInclusive: true, maxInclusive: true, units: 1 },
  ] };
  assert.equal(resolveRegimen(bands, { ...cat, weight: 4 }).dose, 0.5);
  assert.equal(resolveRegimen(bands, { ...cat, weight: 4.1 }).dose, 1);
  for (const weight of [4.00001, 4.05, 4.09999]) {
    const result = resolveRegimen(bands, { ...cat, weight });
    assert.equal(result.valid, false);
    assert.equal(result.dose, null);
  }
});

test('overlapping or malformed tablet tables fail before choosing any band', () => {
  const variants = [
    [{ min: 2.5, max: 6, minInclusive: true, maxInclusive: true, units: 1 }, { min: 6, max: 12, minInclusive: true, maxInclusive: true, units: 2 }],
    [{ min: 2.5, max: 7, minInclusive: true, maxInclusive: false, units: 1 }, { min: 6, max: 12, minInclusive: true, maxInclusive: true, units: 2 }],
    [], [{ min: 2, max: 6, units: 1 }], [{ min: 2, max: 6, minInclusive: true, maxInclusive: true, units: NaN }],
  ];
  for (const weightBands of variants) {
    const result = resolveRegimen({ ...catBands, weightBands }, cat);
    assert.equal(result.valid, false);
    assert.equal(result.dose, null);
  }
  assert.equal(resolveRegimen({ ...catBands, dose: 1 }, cat).valid, false);
  assert.equal(resolveRegimen({ ...catBands, doseMode: 'perKgDose' }, cat).valid, false);
});

test('native age unit comparisons respect exact source thresholds', () => {
  assert.equal(resolveRegimen(weightBased, { ...dog, age: 6 }).valid, true);
  assert.equal(resolveRegimen(weightBased, { ...dog, age: 5.999 }).valid, false);
  const monthly = { ...weightBased, minimumAge: { value: 4, unit: 'months' } };
  assert.equal(resolveRegimen(monthly, { ...dog, age: 4, ageUnit: 'months' }).valid, true);
  assert.equal(resolveRegimen(monthly, { ...dog, age: 3.999, ageUnit: 'months' }).valid, false);
});

test('cross-unit age intervals distinguish known old, known young and ambiguous boundaries', () => {
  assert.equal(resolveRegimen(weightBased, { ...dog, age: 1, ageUnit: 'years' }).valid, true);
  assert.equal(resolveRegimen(weightBased, { ...dog, age: 1, ageUnit: 'months' }).valid, false);
  const ambiguous = resolveRegimen(weightBased, { ...dog, age: 1.4, ageUnit: 'months' });
  assert.equal(ambiguous.valid, false);
  assert.match(ambiguous.errors.join(' '), /tygodniach/);
  const monthly = { ...weightBased, minimumAge: { value: 4, unit: 'months' } };
  assert.equal(resolveRegimen(monthly, { ...dog, age: 18, ageUnit: 'weeks' }).valid, true);
  const sixteenWeeks = resolveRegimen(monthly, { ...dog, age: 16, ageUnit: 'weeks' });
  assert.equal(sixteenWeeks.valid, false);
  assert.match(sixteenWeeks.errors.join(' '), /miesiącach/);
  assert.equal(resolveRegimen(weightBased, { ...dog, age: 42, ageUnit: 'days' }).valid, true);
  assert.equal(resolveRegimen(weightBased, { ...dog, age: 41, ageUnit: 'days' }).valid, false);
});

test('optional age still rejects invalid values or unknown units when supplied', () => {
  for (const [age, ageUnit] of [[-1, 'weeks'], [NaN, 'weeks'], [Infinity, 'weeks'], ['4', 'months'], [4, 'fortnights'], [4, undefined]]) {
    assert.equal(resolveRegimen(catBands, { ...cat, age, ageUnit }).valid, false);
  }
  assert.equal(resolveRegimen(catBands, { ...cat, age: 0, ageUnit: 'days' }).valid, true);
  assert.equal(resolveRegimen(catBands, { ...cat, age: null, ageUnit: undefined }).valid, true);
});

test('each resolution uses current patient data rather than retaining the last tablet band', () => {
  const context = { ...cat, weight: 6 };
  assert.equal(resolveRegimen(catBands, context).dose, 1);
  context.weight = 7;
  assert.equal(resolveRegimen(catBands, context).dose, 2);
  context.weight = 12.1;
  assert.equal(resolveRegimen(catBands, context).dose, null);
  context.species = 'dog';
  context.weight = 7;
  assert.equal(resolveRegimen(catBands, context).dose, null);
});

test('resolution and available-record copies do not mutate source data', () => {
  const record = structuredClone(catBands);
  const before = JSON.stringify(record);
  resolveRegimen(record, cat);
  const [selected] = availableRegimens([record], cat);
  selected.formIds.push('different-form');
  selected.weightBands[0].units = 99;
  assert.equal(JSON.stringify(record), before);
  assert.equal(resolveRegimen(record, cat).dose, 1);
});
