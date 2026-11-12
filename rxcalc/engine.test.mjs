import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Works both with and without a package.json declaring type: module.
const source = await readFile(new URL('./engine.js', import.meta.url), 'utf8');
const { calculate, calculateCrCl, formatNumber } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const base = { form: 'suspension', doseMode: 'units', dose: 6.5, frequency: 2, days: 7, concentrationMg: 400, concentrationMl: 5, packageSize: 70, unitLabel: 'ml' };

test('91 ml regimen: quantities, mg and packages share the same dose', () => {
  const r = calculate(base);
  assert.equal(r.valid, true);
  assert.equal(r.singleMg, 520);
  assert.equal(r.dailyMg, 1040);
  assert.equal(r.totalUnits, 91);
  assert.equal(r.packages, 2);
  assert.equal(r.leftoverUnits, 49);
  assert.equal(r.status, 'warning'); // no clinical ceiling was supplied
  assert.equal(calculate({ ...base, packageSize: 140 }).packages, 1);
});
test('mg/kg/day and mg/kg/dose have intentionally different semantics', () => {
  const r = calculate({ ...base, doseMode: 'perKgDay', dose: 40, weight: 20 });
  const s = calculate({ ...base, doseMode: 'perKgDose', dose: 40, weight: 20 });
  assert.equal(r.singleMg, 400);
  assert.equal(s.singleMg, 800);
});
test('weight cannot be silently defaulted', () => {
  for (const weight of [null, undefined, '', 0, -5, NaN, Infinity, '20']) {
    assert.equal(calculate({ ...base, doseMode: 'perKgDay', weight }).valid, false);
  }
});
test('blank inputs and non-finite inputs never become a valid zero result', () => {
  for (const key of ['dose', 'frequency', 'days', 'packageSize']) {
    for (const value of [null, '', undefined, 0, -1, Infinity, NaN]) {
      const r = calculate({ ...base, [key]: value });
      assert.equal(r.valid, false, `${key}: ${value}`);
      assert.equal(r.totalUnits, null);
    }
  }
});
test('actual rounded dose, not theoretical dose, is tested against the ceiling', () => {
  const r = calculate({ ...base, doseMode: 'fixed', dose: 490, roundingStep: 1, concentrationMg: 100, concentrationMl: 1, maxDailyMg: 990 });
  assert.equal(r.theoreticalUnits, 4.9);
  assert.equal(r.singleUnits, 5);
  assert.equal(r.dailyMg, 1000);
  assert.equal(r.valid, false);
  assert.equal(r.status, 'critical');
  assert.equal(r.totalUnits, 70);
});
test('zero after rounding is blocked', () => {
  const r = calculate({ ...base, dose: 0.1, roundingStep: 1 });
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /zerową/);
});
test('tablet 0.75 cannot be created from a half-divisible product', () => {
  const r = calculate({ ...base, form: 'tablet', doseMode: 'fixed', dose: 375, strengthMg: 500, allowedFractions: [1, 0.5] });
  assert.equal(r.singleUnits, 0.75);
  assert.equal(r.valid, false);
  assert.equal(r.status, 'critical');
});
test('whole plus permitted half is allowed', () => {
  const r = calculate({ ...base, form: 'tablet', doseMode: 'fixed', dose: 750, strengthMg: 500, allowedFractions: [1, 0.5] });
  assert.equal(r.singleUnits, 1.5);
  assert.equal(r.valid, true);
});
test('unknown tablet divisibility is incomplete, never silently assumed', () => {
  const r = calculate({ ...base, form: 'tablet', dose: 0.5, strengthMg: 500 });
  assert.equal(r.valid, false);
  assert.equal(r.status, 'incomplete');
});
test('integer tablets do not need subdivision metadata', () => {
  assert.equal(calculate({ ...base, form: 'tablet', dose: 2, strengthMg: 500 }).valid, true);
});
test('an empty fraction set means only whole tablets', () => {
  assert.equal(calculate({ ...base, form: 'tablet', dose: 0.5, strengthMg: 500, allowedFractions: [] }).valid, false);
});
test('age restriction requires age and retains arithmetic for review', () => {
  const r = calculate({ ...base, minAge: 12 });
  assert.equal(r.valid, false);
  assert.equal(r.status, 'incomplete');
  assert.equal(r.totalUnits, 91);
  assert.equal(calculate({ ...base, minAge: 12, age: 11.99 }).status, 'critical');
  assert.equal(calculate({ ...base, minAge: 12, age: 12 }).valid, true);
});
test('age zero is valid input for a caller-supplied newborn rule', () => {
  assert.equal(calculate({ ...base, minAge: 0, age: 0 }).valid, true);
});
test('no rounding or float residue creates an extra package at an exact boundary', () => {
  const r = calculate({ ...base, dose: 0.1, frequency: 3, days: 10, packageSize: 3 });
  assert.equal(r.totalUnits, 3);
  assert.equal(r.packages, 1);
});
test('in-use shelf life can require additional bottles', () => {
  const r = calculate({ ...base, dose: 5, frequency: 2, days: 14, packageSize: 140, shelfLifeDays: 7 });
  assert.equal(r.totalUnits, 140);
  assert.equal(r.packages, 2);
  assert.equal(r.expiryWasteUnits, 70);
});
test('expiry calculation opens bottles sequentially without arbitrary week boundaries', () => {
  const r = calculate({ ...base, dose: 15, frequency: 2, days: 14, packageSize: 100, shelfLifeDays: 7 });
  assert.equal(r.totalUnits, 420);
  assert.equal(r.packages, 5);
  assert.equal(r.expiryWasteUnits, 0);
});
test('fractional spray actuations blocked; grams remain fractional', () => {
  assert.equal(calculate({ ...base, form: 'spray', dose: 1.5 }).valid, false);
  const r = calculate({ ...base, form: 'gel', dose: 0.2, packageSize: 5, unitLabel: 'g' });
  assert.equal(r.valid, true);
  assert.equal(r.totalUnits, 2.8);
  assert.equal(r.singleMg, null);
});
test('spray and gel reject mg-oriented modes without pretending to know a conversion', () => {
  for (const form of ['spray', 'gel']) assert.equal(calculate({ ...base, form, doseMode: 'fixed' }).valid, false);
});
test('drops use the explicitly supplied product-specific calibration', () => {
  const r = calculate({ ...base, form: 'drops', doseMode: 'fixed', dose: 10, concentrationMg: 20, concentrationMl: 1, dropsPerMl: 20, packageSize: 200 });
  assert.equal(r.singleUnits, 10);
  assert.equal(r.singleMg, 10);
  assert.equal(calculate({ ...base, form: 'drops', doseMode: 'fixed' }).valid, false);
});
test('unit-only drops can calculate quantity, but cannot pass supplied mg limits without calibration', () => {
  const r = calculate({ ...base, form: 'drops', dose: 10, maxDailyMg: 100 });
  assert.equal(r.valid, false);
  assert.equal(r.status, 'incomplete');
  assert.equal(r.singleMg, null);
});
test('source limit boundary is inclusive and separate single-dose ceiling is checked', () => {
  assert.equal(calculate({ ...base, maxDailyMg: 1040 }).valid, true);
  assert.equal(calculate({ ...base, maxDailyMg: 1039 }).status, 'critical');
  assert.equal(calculate({ ...base, maxDailyMg: 2000, maxSingleMg: 500 }).status, 'critical');
});
test('invalid optional parameters are not silently discarded', () => {
  for (const fields of [{ maxDailyMg: -1 }, { roundingStep: 0 }, { age: -1 }, { days: 5000 }, { frequency: 100 }, { allowedFractions: [1, 2] }]) {
    assert.equal(calculate({ ...base, ...fields }).valid, false);
  }
});
test('Cockcroft–Gault uses adult age, sex and creatinine units explicitly', () => {
  assert.ok(Math.abs(calculateCrCl({ age: 60, sex: 'male', weight: 72, creatinine: 1 }) - 80) < 1e-10);
  assert.ok(Math.abs(calculateCrCl({ age: 60, sex: 'female', weight: 72, creatinine: 1 }) - 68) < 1e-10);
  assert.equal(calculateCrCl({ age: 60, sex: 'male', weight: 72, creatinine: 88.4, creatinineUnit: 'µmol/l' }), 80);
  for (const fields of [{ age: 17 }, { creatinine: 0 }, { sex: undefined }, { weight: '' }, { creatinineUnit: 'mg/l' }]) {
    assert.equal(calculateCrCl({ age: 60, sex: 'male', weight: 72, creatinine: 1, ...fields }), null);
  }
});
test('Polish formatter never displays NaN or Infinity', () => {
  assert.equal(formatNumber(6.5), '6,5');
  assert.equal(formatNumber(null), '—');
  assert.equal(formatNumber(NaN), '—');
  assert.equal(formatNumber(Infinity), '—');
});
test('daily schedule requires a whole number of administrations and days', () => {
  for (const fields of [{frequency: 0.5}, {frequency: 2.2}, {days: 0.5}, {days: 7.1}]) {
    const r = calculate({...base, ...fields});
    assert.equal(r.valid, false);
    assert.equal(r.totalUnits, null);
  }
});
test('extreme positive concentration and package parameters cannot produce Infinity or NaN', () => {
  const fields = [
    {concentrationMl: Number.MIN_VALUE},
    {concentrationMg: Number.MIN_VALUE},
    {packageSize: Number.MIN_VALUE},
    {shelfLifeDays: Number.MIN_VALUE},
    {concentrationMg: 1, concentrationMl: 1e-308},
    {concentrationMg: 1, concentrationMl: 1e-306, dose: 100},
    {maxDailyMg: Number.MIN_VALUE},
    {packageSize: 1e-100},
  ];
  for (const patch of fields) {
    const r = calculate({...base, ...patch});
    assert.equal(r.valid, false, JSON.stringify(patch));
    for (const value of Object.values(r)) {
      if (typeof value === 'number') assert.equal(Number.isFinite(value), true, JSON.stringify(patch));
    }
  }
});
test('injection quantities and packages use ml exclusively', () => {
  const r = calculate({...base, form:'injection', dose:0.4, concentrationMg:100, concentrationMl:1, packageSize:0.4, singleUseUnitSize:0.4});
  assert.equal(r.valid, true);
  assert.equal(r.singleMg, 40);
  for (const unitLabel of ['amp.', 'strzykawki', 'mg', '', null]) {
    assert.equal(calculate({...base, form:'injection', unitLabel}).valid, false);
  }
});
test('injection packaging counts fresh single-use containers for every administration', () => {
  const r = calculate({...base, form:'injection', dose:0.4, frequency:2, days:7, concentrationMg:100, concentrationMl:1, packageSize:10, singleUseUnitSize:1});
  assert.equal(r.valid, true);
  assert.equal(r.totalUnits, 5.6);
  assert.equal(r.singleUseContainers, 14);
  assert.equal(r.packages, 2);
  assert.equal(r.providedUnits, 20);
  assert.equal(r.unusedSingleUseVolume, 8.4);
  assert.equal(r.leftoverUnits, 14.4); // 8.4 ml discarded + 6 unopened 1 ml containers
  assert.equal(r.expiryWasteUnits, 0);
});
test('a larger injection dose can require multiple fresh containers per administration', () => {
  const r = calculate({...base, form:'injection', dose:1.2, frequency:2, days:3, packageSize:10, singleUseUnitSize:1});
  assert.equal(r.valid, true);
  assert.equal(r.singleUseContainers, 12);
  assert.equal(r.packages, 2);
  assert.equal(r.unusedSingleUseVolume, 4.8);
});
test('injection package and container volume must describe an integer count', () => {
  for (const fields of [
    {singleUseUnitSize:null},
    {singleUseUnitSize:2,packageSize:1},
    {singleUseUnitSize:0.4,packageSize:1},
    {singleUseUnitSize:Number.MIN_VALUE},
    {singleUseUnitSize:1e-100},
    {singleUseUnitSize:1,shelfLifeDays:7},
  ]) {
    assert.equal(calculate({...base,form:'injection',packageSize:10,...fields}).valid,false,JSON.stringify(fields));
  }
  assert.equal(calculate({...base,form:'injection',dose:0.1,packageSize:0.3,singleUseUnitSize:0.1}).valid,true);
});


// Synthetic concentrations and dose inputs verify arithmetic only, not veterinary regimens.
const animalArithmetic = {
  patientKind: 'animal', form: 'solution', doseMode: 'perKgDose',
  dose: 10, frequency: 2, days: 1, concentrationMg: 100,
  concentrationMl: 1, packageSize: 1000, unitLabel: 'ml',
};
test('animal arithmetic retains sub-kilogram weights and accepts a 700 kg horse', () => {
  for (const [species, weight, singleMg, singleUnits] of [
    ['hamster', 0.08, 0.8, 0.008],
    ['rat', 0.3, 3, 0.03],
    ['horse', 700, 7000, 70],
  ]) {
    const r = calculate({...animalArithmetic, species, weight});
    assert.equal(r.valid, true, species);
    assert.equal(r.singleMg, singleMg, species);
    assert.equal(r.singleUnits, singleUnits, species);
    assert.equal(r.dailyUnits, singleUnits * 2, species);
    assert.equal(r.status, 'warning', species);
  }
});
test('animal profile requires a supported species rather than assuming one', () => {
  for (const species of [undefined, null, '', 'rabbit', 'Dog', ['dog'], {}]) {
    const r = calculate({...animalArithmetic, species, weight: 1});
    assert.equal(r.valid, false);
    assert.equal(r.singleUnits, null);
    assert.match(r.errors.join(' '), /gatunek/);
  }
  for (const species of ['dog', 'cat', 'horse', 'hamster', 'rat']) {
    assert.equal(calculate({...animalArithmetic, species, weight: 1}).valid, true, species);
  }
});
test('animal weight is mandatory for every dose mode, including fixed and unit modes', () => {
  for (const doseMode of ['units', 'fixed', 'perKgDay', 'perKgDose']) {
    for (const weight of [undefined, null, '', 0, -1, NaN, Infinity, '0.08']) {
      const r = calculate({...animalArithmetic, species: 'hamster', doseMode, weight});
      assert.equal(r.valid, false, `${doseMode}: ${weight}`);
      assert.equal(r.singleUnits, null);
      assert.match(r.errors.join(' '), /masę ciała/);
    }
  }
});
test('technical veterinary weight range does not expand the human range', () => {
  assert.equal(calculate({...base, weight: 500}).valid, true);
  assert.equal(calculate({...base, weight: 500.01}).valid, false);
  assert.equal(calculate({...base, patientKind: 'human', weight: 700}).valid, false);
  assert.equal(calculate({...animalArithmetic, species: 'horse', weight: 2000}).valid, true);
  assert.equal(calculate({...animalArithmetic, species: 'horse', weight: 2000.01}).valid, false);
  assert.equal(calculateCrCl({age: 60, sex: 'male', weight: 700, creatinine: 1}), null);
});
test('invalid patient kind cannot silently bypass human validation', () => {
  for (const patientKind of ['', null, false, 'veterinary', ['animal'], {}]) {
    assert.equal(calculate({...base, patientKind}).valid, false);
  }
});
test('animal results never imply clinical clearance even with user-supplied limits', () => {
  const r = calculate({...animalArithmetic, species: 'dog', weight: 10, maxDailyMg: 200});
  assert.equal(r.valid, true);
  assert.equal(r.maxRatio, 1);
  assert.equal(r.status, 'warning');
  assert.ok(r.warnings.includes('Przeliczenie arytmetyczne. Dobór leku i dawkowanie dla tego gatunku wymagają weryfikacji lekarza weterynarii.'));
  const critical = calculate({...animalArithmetic, species: 'dog', weight: 10, maxDailyMg: 199});
  assert.equal(critical.valid, false);
  assert.equal(critical.status, 'critical');
});
