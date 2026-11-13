import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './engine.js';

// Arithmetic and measuring-device fixtures only. Product-specific indications,
// source eligibility and clinical duration are checked by the regimen layer.
const paste = {
  patientKind: 'animal', species: 'horse', weight: 500,
  form: 'oralPaste', unitLabel: 'g', strengthMg: 370,
  doseMode: 'perKgDose', dose: 4, frequency: 1, days: 1,
  packageSize: 7.57,
};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-10 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);

test('oral paste converts active mg to actual product grams and counts actual gram packages', () => {
  const r = calculate({ ...paste, days: 2 });
  assert.equal(r.valid, true);
  close(r.singleMg, 2000);
  close(r.singleUnits, 2000 / 370);
  close(r.totalUnits, 4000 / 370);
  assert.equal(r.packages, 2);
  assert.equal(r.providedUnits, 15.14);
  close(r.leftoverUnits, 15.14 - 4000 / 370);
  assert.equal(r.unitLabel, 'g');
  assert.equal(r.status, 'warning');
});

test('oral paste and powder keep per-dose and per-day mg/kg semantics distinct', () => {
  for (const form of ['oralPaste', 'oralPowder']) {
    const input = { ...paste, form, strengthMg: 100, dose: 2, frequency: 2, packageSize: 100 };
    const perDose = calculate({ ...input, doseMode: 'perKgDose' });
    const perDay = calculate({ ...input, doseMode: 'perKgDay' });
    assert.equal(perDose.valid, true);
    assert.equal(perDay.valid, true);
    assert.equal(perDose.singleUnits, 10);
    assert.equal(perDay.singleUnits, 5);
    assert.equal(perDose.dailyMg, 2000);
    assert.equal(perDay.dailyMg, 1000);
  }
});

test('oral mass forms reject ml, kg, absent or non-string product units', () => {
  for (const form of ['oralPaste', 'oralPowder']) {
    for (const unitLabel of ['ml', 'mg', 'kg', 'sasz.', '', undefined, null, 1]) {
      for (const doseMode of ['fixed', 'units']) {
        const r = calculate({ ...paste, form, unitLabel, doseMode });
        assert.equal(r.valid, false, `${form}/${String(unitLabel)}/${doseMode}`);
        assert.equal(r.singleUnits, null);
        assert.match(r.errors.join(' '), /wymaga jednostki g/);
      }
    }
  }
});

test('mg-oriented oral mass doses require mg per gram, never a borrowed mg/ml concentration', () => {
  for (const form of ['oralPaste', 'oralPowder']) {
    for (const doseMode of ['fixed', 'perKgDose', 'perKgDay']) {
      for (const strengthMg of [undefined, null, '', 0, -1, NaN, Infinity, '370']) {
        const r = calculate({ ...paste, form, doseMode, strengthMg, concentrationMg: 370, concentrationMl: 1 });
        assert.equal(r.valid, false, `${form}/${doseMode}/${String(strengthMg)}`);
        assert.equal(r.singleUnits, null);
        assert.match(r.errors.join(' '), /mg\/g/);
      }
    }
  }
});

test('units mode can count product grams without claiming known active mg', () => {
  for (const form of ['oralPaste', 'oralPowder']) {
    const r = calculate({ ...paste, form, doseMode: 'units', dose: 2, strengthMg: null, packageSize: 10 });
    assert.equal(r.valid, true);
    assert.equal(r.singleUnits, 2);
    assert.equal(r.singleMg, null);
    assert.equal(r.packages, 1);
    assert.match(r.warnings.join(' '), /dawka substancji w mg nie została oceniona/);
  }
});

test('small active strength in oral powder retains milligram precision and product mass', () => {
  const r = calculate({ ...paste, form: 'oralPowder', strengthMg: 0.016, dose: 0.0008, frequency: 2, days: 10, packageSize: 500 });
  assert.equal(r.valid, true);
  assert.equal(r.singleMg, 0.4);
  assert.equal(r.dailyMg, 0.8);
  assert.equal(r.singleUnits, 25);
  assert.equal(r.totalUnits, 500);
  assert.equal(r.packages, 1);
  assert.equal(r.leftoverUnits, 0);
});

test('a recurring-decimal applicator step accepts five exact divisions without rounding', () => {
  const r = calculate({ ...paste, doseStepUnits: 400 / 370 });
  assert.equal(r.valid, true);
  close(r.singleUnits, 5 * 400 / 370);
  close(r.singleMg, 2000);
  close(r.roundingDifferencePercent, 0);
  assert.match(r.checks.join(' '), /pełnym podziałkom/);
  assert.equal(r.warnings.some(t => t.startsWith('Zaokrąglono')), false);
});

test('a quarter-division maintenance amount is blocked without changing the calculated dose', () => {
  const unrestricted = calculate({ ...paste, dose: 1 });
  const measured = calculate({ ...paste, dose: 1, doseStepUnits: 400 / 370 });
  assert.equal(unrestricted.valid, true);
  assert.equal(measured.valid, false);
  assert.equal(measured.status, 'critical');
  assert.equal(measured.singleUnits, unrestricted.singleUnits);
  assert.equal(measured.singleMg, unrestricted.singleMg);
  close(measured.singleUnits / (400 / 370), 1.25);
  assert.match(measured.errors.join(' '), /Nie zaokrąglono do podziałki/);
});

test('bad measuring-step metadata fails closed before quantity calculation', () => {
  for (const doseStepUnits of [0, -1, NaN, Infinity, '1', {}, [], 1e6 + 1]) {
    const r = calculate({ ...paste, doseStepUnits });
    assert.equal(r.valid, false, String(doseStepUnits));
    assert.equal(r.singleUnits, null);
    assert.match(r.errors.join(' '), /krok podziałki/);
  }
  for (const doseStepUnits of [undefined, null, '']) {
    assert.equal(calculate({ ...paste, doseStepUnits }).valid, true);
  }
});

test('sub-step and unrepresentably large division counts cannot pass calibration', () => {
  for (const doseStepUnits of [100, Number.MIN_VALUE, 1e-30]) {
    const r = calculate({ ...paste, doseStepUnits });
    assert.equal(r.valid, false);
    assert.equal(r.status, 'critical');
    assert.match(r.errors.join(' '), /pełnym podziałkom/);
  }
});

test('explicit manual rounding is still checked against the physical step and remains disclosed', () => {
  const input = { ...paste, doseMode: 'units', dose: 1.3, doseStepUnits: 0.5, packageSize: 10 };
  const withoutRounding = calculate(input);
  assert.equal(withoutRounding.valid, false);
  assert.equal(withoutRounding.singleUnits, 1.3);
  const representable = calculate({ ...input, roundingStep: 0.5 });
  assert.equal(representable.valid, true);
  assert.equal(representable.singleUnits, 1.5);
  assert.equal(representable.singleMg, 555);
  assert.ok(representable.roundingDifferencePercent > 15);
  assert.match(representable.warnings.join(' '), /Zaokrąglono ilość/);
  const stillUnrepresentable = calculate({ ...input, roundingStep: 0.2 });
  assert.equal(stillUnrepresentable.valid, false);
  assert.equal(stillUnrepresentable.singleUnits, 1.4);
});

test('oral containers use their actual gram capacity and opened shelf life without per-dose disposal', () => {
  const input = { ...paste, form: 'oralPowder', weight: 100, strengthMg: 0.016, dose: 0.0008, frequency: 2, days: 42, packageSize: 500 };
  const reusable = calculate(input);
  const openedLimit = calculate({ ...input, shelfLifeDays: 21 });
  assert.equal(reusable.valid, true);
  assert.equal(reusable.totalUnits, 420);
  assert.equal(reusable.packages, 1);
  assert.equal(openedLimit.valid, true);
  assert.equal(openedLimit.totalUnits, 420);
  assert.equal(openedLimit.packages, 2);
  assert.equal(openedLimit.expiryWasteUnits, 290);
  assert.equal(openedLimit.singleUseContainers, null);
  assert.match(openedLimit.warnings.join(' '), /trwałość po otwarciu/);
});

test('topical gel still rejects mg-oriented modes and preserves its units-only calculation', () => {
  for (const doseMode of ['fixed', 'perKgDose', 'perKgDay']) {
    const r = calculate({ ...paste, form: 'gel', doseMode });
    assert.equal(r.valid, false);
    assert.match(r.errors.join(' '), /wprowadź ilość na podanie/);
  }
  const units = calculate({ ...paste, form: 'gel', doseMode: 'units', dose: 0.2, packageSize: 5 });
  assert.equal(units.valid, true);
  assert.equal(units.singleUnits, 0.2);
});
