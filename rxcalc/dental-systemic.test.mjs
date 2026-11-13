import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './engine.js';
import {
  DENTAL_SYSTEMIC_FORM_ADDITIONS as additions,
  DENTAL_SYSTEMIC_FORM_PATCHES as patches,
  DENTAL_SYSTEMIC_REGIMENS as regimens,
} from './dental-systemic.js';

const regimen = id => {
  const value = regimens.find(record => record.id === id);
  assert.ok(value, `Missing clinical record: ${id}`);
  return value;
};
const suspensionInput = (record, dose, weight, concentrationMg) => ({
  patientKind: 'human', form: 'suspension', unitLabel: 'ml',
  doseMode: record.doseMode, dose, weight, frequency: record.frequency, days: 7,
  concentrationMg, concentrationMl: 5, packageSize: 100,
  maxDailyMg: record.maxDailyMgPerKg * weight,
});

test('pediatric antibiotic source quantity is the whole day, not each administration', () => {
  const record = regimen('dental-ospamox-child-tid');
  // Clinician-selected example for arithmetic verification, not a dose default.
  const weak = calculate(suspensionInput(record, 90, 30, 250));
  const strong = calculate(suspensionInput(record, 90, 30, 500));
  assert.equal(weak.valid, true);
  assert.equal(weak.dailyMg, 2700);
  assert.equal(weak.singleMg, 900);
  assert.equal(weak.singleUnits, 18);
  assert.equal(strong.singleUnits, 9);
  assert.equal(strong.dailyMg, weak.dailyMg);
});

test('Augmentin 7:1 dental source does not inherit high respiratory or other-ratio dosing', () => {
  const record = regimen('dental-augmentin-400-57-child');
  const valid = calculate(suspensionInput(record, 45, 20, 400));
  const excessive = calculate(suspensionInput(record, 70, 20, 400));
  assert.equal(valid.valid, true);
  assert.equal(valid.dailyMg, 900);
  assert.equal(valid.singleMg, 450);
  assert.equal(valid.singleUnits, 5.625);
  assert.equal(excessive.valid, false);
  assert.equal(excessive.status, 'critical');
  assert.equal(record.minAgeMonths, 2);
  assert.equal(record.maxWeight, 40);
  assert.equal(record.maxWeightExclusive, true);
});

test('new tablet strengths preserve source subdivision and do not manufacture quarter tablets', () => {
  const tablet500 = additions.find(record => record.form.strengthMg === 500).form;
  const tablet1000 = additions.find(record => record.form.strengthMg === 1000).form;
  const input = form => ({
    patientKind: 'human', form: 'tablet', unitLabel: 'tabl.', doseMode: 'fixed',
    dose: 750, frequency: 2, days: 7, packageSize: 14,
    strengthMg: form.strengthMg, allowedFractions: form.allowedFractions,
  });
  assert.equal(calculate(input(tablet500)).valid, true);
  assert.equal(calculate(input(tablet500)).singleUnits, 1.5);
  assert.equal(calculate(input(tablet1000)).singleUnits, 0.75);
  assert.equal(calculate(input(tablet1000)).valid, false);
  assert.notEqual(tablet500.id, 'ospamox-500'); // existing suspension identity
});

test('Ibuprom shortest interval does not override its formulation-specific daily ceiling', () => {
  const record = regimen('dental-ibuprom-200-over12');
  const input = dose => ({
    patientKind: 'human', form: 'tablet', unitLabel: 'tabl.', doseMode: record.doseMode,
    dose, frequency: 6, days: 1, packageSize: 20,
    strengthMg: 200, allowedFractions: [1],
    maxSingleMg: record.maxSingleMg, maxDailyMg: record.maxDailyMg,
  });
  assert.equal(calculate(input(200)).valid, true);
  assert.equal(calculate(input(400)).valid, false);
  assert.equal(record.asNeeded, true);
  assert.equal(record.minIntervalHours, 4);
});

test('a documented antibiotic range never becomes an invented default dose or seven-day course', () => {
  for (const record of regimens.filter(value => /ospamox|augmentin/.test(value.id))) {
    assert.ok(record.doseRange);
    assert.equal(record.dose, undefined);
    assert.equal(record.fixedDays, undefined);
    assert.equal(record.defaultDays, undefined);
    assert.match(record.limitLabel, /zakresu|schematu/);
    assert.equal(record.renalPolicy, 'normal-only');
    assert.equal(record.minCrCl, 30);
    assert.equal(record.minCrClExclusive, true);
    assert.notEqual(record.requireCrCl, true);
  }
  assert.equal(regimen('dental-ospamox-child-tid').frequency, 3);
  assert.equal(regimen('dental-ospamox-child-tid').frequencyOptions, undefined);
});

test('paracetamol 4g ceiling remains tied to both source population conditions', () => {
  const record = regimen('dental-metafen-paracetamol-over12-over50');
  assert.equal(record.minAgeMonths, 144);
  assert.equal(record.minAgeExclusive, true);
  assert.equal(record.minWeight, 50);
  assert.equal(record.minWeightExclusive, true);
  assert.equal(record.maxDailyMg, 4000);
  assert.equal(record.minIntervalHours, 4);
  assert.deepEqual(record.frequencyOptions, [1, 2, 3, 4]);
  assert.equal(record.asNeeded, true);
});

test('catalogue extensions neither assert pharmacy stock nor set universal antibiotic limits', () => {
  for (const { form } of additions) {
    assert.equal(form.defaultDose, null);
    assert.equal(form.defaultDays, null);
    assert.equal(form.maxDailyMg, null);
    assert.ok(form.packOptions.every(pack => pack.availabilityStatus === 'documented-not-stock-verified'));
  }
  for (const { changes } of patches) {
    assert.ok(changes.packOptions.every(pack => pack.availabilityStatus === 'documented-not-stock-verified'));
  }
});
