import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './engine.js';

// These fixtures test arithmetic and container handling, not prescribing advice.
// Indications, source-specific doses and eligibility belong to the regimen layer.
const vial = {
  patientKind: 'animal', species: 'horse', weight: 500,
  form: 'injection', unitLabel: 'ml', doseMode: 'units', dose: 11,
  frequency: 1, days: 5, concentrationMg: 10, concentrationMl: 1,
  packageSize: 100, injectionContainerUse: 'multiDose', shelfLifeDays: 28,
};
const close = (actual, expected) => assert.ok(
  Math.abs(actual - expected) <= 1e-10 * Math.max(1, Math.abs(expected)),
  `${actual} != ${expected}`,
);
const noQuantity = result => {
  for (const key of ['theoreticalUnits', 'singleUnits', 'singleMg', 'dailyUnits', 'dailyMg', 'totalUnits', 'packages']) {
    assert.equal(result[key], null, key);
  }
};

test('one reusable 100 ml vial supplies five separate 11 ml administrations', () => {
  const r = calculate(vial);
  assert.equal(r.valid, true);
  assert.equal(r.singleMg, 110);
  assert.equal(r.totalUnits, 55);
  assert.equal(r.dosesPerVial, 9);
  assert.equal(r.packages, 1);
  assert.equal(r.providedUnits, 100);
  assert.equal(r.leftoverUnits, 45);
  assert.equal(r.discardedMultiDoseVolume, 0);
  assert.equal(r.expiryWasteUnits, 0);
  assert.equal(r.singleUseContainers, null);
  assert.equal(r.unusedSingleUseVolume, null);
  assert.equal(r.unusedSingleUseUnits, null);
  assert.match(r.checks.join(' '), /jedno nakłucie na podanie/);
  assert.match(r.checks.join(' '), /całej dawki z jednej fiolki/);
  assert.match(r.checks.join(' '), /nie są łączone między fiolkami/);
});

test('expiry opens replacement vials only when needed and counts expired prior remnants', () => {
  const r = calculate({ ...vial, shelfLifeDays: 2 });
  assert.equal(r.valid, true);
  assert.equal(r.dosesPerVial, 2);
  assert.equal(r.packages, 3);
  assert.equal(r.totalUnits, 55);
  assert.equal(r.providedUnits, 300);
  assert.equal(r.leftoverUnits, 245);
  assert.equal(r.expiryWasteUnits, 156); // Two previous vials each retained 78 ml.
  assert.equal(r.discardedMultiDoseVolume, 156);
  assert.match(r.warnings.join(' '), /Liczbę opakowań zwiększono ze względu na trwałość/);
  assert.equal(r.leftoverUnits - r.discardedMultiDoseVolume, 89); // Last vial residue is not declared expired.
});

test('one-day vial shelf life permits the specified number of administrations that day', () => {
  const r = calculate({ ...vial, shelfLifeDays: 1, frequency: 2, days: 3 });
  assert.equal(r.valid, true);
  assert.equal(r.dosesPerVial, 2);
  assert.equal(r.totalUnits, 66);
  assert.equal(r.packages, 3);
  assert.equal(r.expiryWasteUnits, 156);
});

test('a withdrawal limit replaces a vial without mislabelling its remainder as expiry', () => {
  const r = calculate({ ...vial, maxWithdrawalsPerVial: 3, days: 7 });
  assert.equal(r.valid, true);
  assert.equal(r.dosesPerVial, 3);
  assert.equal(r.packages, 3);
  assert.equal(r.totalUnits, 77);
  assert.equal(r.discardedMultiDoseVolume, 134);
  assert.equal(r.expiryWasteUnits, 0);
  assert.match(r.checks.join(' '), /maksymalnie 3 nakłuć/);
  assert.equal(r.warnings.some(message => message.startsWith('Liczbę opakowań zwiększono ze względu na trwałość')), false);
});

test('the earliest applicable volume, expiry or withdrawal limit controls complete doses', () => {
  const expiry = calculate({ ...vial, shelfLifeDays: 2, maxWithdrawalsPerVial: 3 });
  const punctures = calculate({ ...vial, shelfLifeDays: 3, maxWithdrawalsPerVial: 2 });
  const tied = calculate({ ...vial, shelfLifeDays: 2, maxWithdrawalsPerVial: 2 });
  for (const r of [expiry, punctures, tied]) {
    assert.equal(r.valid, true);
    assert.equal(r.dosesPerVial, 2);
    assert.equal(r.packages, 3);
    assert.equal(r.discardedMultiDoseVolume, 156);
  }
  assert.equal(expiry.expiryWasteUnits, 156);
  assert.equal(punctures.expiryWasteUnits, 0);
  assert.equal(tied.expiryWasteUnits, 0); // A tied cause is not attributed solely to expiry.
});

test('insufficient residual ml are not pooled to invent further full administrations', () => {
  const r = calculate({ ...vial, days: 100 });
  assert.equal(r.valid, true);
  assert.equal(r.dosesPerVial, 9);
  assert.equal(r.totalUnits, 1100);
  assert.equal(r.packages, 12); // ceil(1100/100) would incorrectly return 11.
  assert.equal(r.providedUnits, 1200);
  assert.equal(r.leftoverUnits, 100);
  assert.equal(r.discardedMultiDoseVolume, 11);
  assert.equal(r.expiryWasteUnits, 0);
  assert.equal(r.warnings.some(message => message.startsWith('Liczbę opakowań zwiększono ze względu na trwałość')), false);
});

test('an exact vial boundary survives binary floating-point residue', () => {
  const r = calculate({ ...vial, dose: 0.1, packageSize: 0.3, days: 6 });
  assert.equal(r.valid, true);
  assert.equal(r.dosesPerVial, 3);
  assert.equal(r.packages, 2);
  assert.equal(r.totalUnits, 0.6);
  assert.equal(r.providedUnits, 0.6);
  assert.equal(r.leftoverUnits, 0);
  assert.equal(r.discardedMultiDoseVolume, 0);
});

test('vial capacity uses the administered dose after an explicitly requested rounding', () => {
  const unrounded = calculate({ ...vial, days: 20 });
  const rounded = calculate({ ...vial, days: 20, roundingStep: 10 });
  assert.equal(unrounded.valid, true);
  assert.equal(unrounded.dosesPerVial, 9);
  assert.equal(unrounded.packages, 3);
  assert.equal(rounded.valid, true);
  assert.equal(rounded.singleUnits, 10);
  assert.equal(rounded.dosesPerVial, 10);
  assert.equal(rounded.packages, 2);
  assert.match(rounded.warnings.join(' '), /Zaokrąglono ilość/);
});

test('a multi-dose administration larger than one vial blocks supply with an actionable error', () => {
  const r = calculate({ ...vial, dose: 101 });
  assert.equal(r.valid, false);
  assert.equal(r.packages, null);
  assert.equal(r.dosesPerVial, null);
  assert.equal(r.discardedMultiDoseVolume, null);
  assert.match(r.errors.join(' '), /przekracza objętość jednej fiolki/);
  assert.match(r.errors.join(' '), /Wybierz większą fiolkę/);
});

test('injection container kinds are explicit, and invalid values never fall back to single-use', () => {
  for (const injectionContainerUse of [null, '', 'multidose', 'single-use', false, 1, {}, []]) {
    const r = calculate({ ...vial, injectionContainerUse });
    assert.equal(r.valid, false, String(injectionContainerUse));
    noQuantity(r);
    assert.match(r.errors.join(' '), /rodzaj pojemnika/);
  }
  const incompatible = calculate({ ...vial, form: 'solution' });
  assert.equal(incompatible.valid, false);
  noQuantity(incompatible);
});

test('multi-dose vials require positive whole-day in-use shelf life', () => {
  for (const shelfLifeDays of [undefined, null, '', 0, -1, 0.5, NaN, Infinity, '28', 3661]) {
    const r = calculate({ ...vial, shelfLifeDays });
    assert.equal(r.valid, false, String(shelfLifeDays));
    noQuantity(r);
    assert.match(r.errors.join(' '), /trwałość|Trwałość/);
  }
});

test('single-use volume metadata cannot silently override a reusable vial model', () => {
  for (const singleUseUnitSize of [1, 100, 0, -1, NaN, Infinity, '100']) {
    const r = calculate({ ...vial, singleUseUnitSize });
    assert.equal(r.valid, false, String(singleUseUnitSize));
    noQuantity(r);
    assert.match(r.errors.join(' '), /wielodawkowa nie może/);
  }
  for (const singleUseUnitSize of [undefined, null, '']) {
    assert.equal(calculate({ ...vial, singleUseUnitSize }).valid, true);
  }
});

test('withdrawal caps must be positive safe integers and belong to multi-dose vials', () => {
  for (const maxWithdrawalsPerVial of [0, -1, 1.5, NaN, Infinity, '3', Number.MAX_SAFE_INTEGER + 1]) {
    const r = calculate({ ...vial, maxWithdrawalsPerVial });
    assert.equal(r.valid, false, String(maxWithdrawalsPerVial));
    noQuantity(r);
    assert.match(r.errors.join(' '), /nakłuć/);
  }
  const singleUse = calculate({ ...vial, injectionContainerUse: 'singleUse', singleUseUnitSize: 100, shelfLifeDays: null, maxWithdrawalsPerVial: 3 });
  assert.equal(singleUse.valid, false);
  assert.match(singleUse.errors.join(' '), /wyłącznie fiolki wielodawkowej/);
});

test('legacy injections still default to fresh single-use containers, including human patients', () => {
  const input = {
    form: 'injection', unitLabel: 'ml', doseMode: 'units', dose: 0.4,
    frequency: 2, days: 7, concentrationMg: 100, concentrationMl: 1,
    packageSize: 10, singleUseUnitSize: 1,
  };
  const legacy = calculate(input);
  const explicit = calculate({ ...input, injectionContainerUse: 'singleUse' });
  assert.deepEqual(legacy, explicit);
  assert.equal(legacy.valid, true);
  assert.equal(legacy.singleUseContainers, 14);
  assert.equal(legacy.packages, 2);
  assert.equal(legacy.unusedSingleUseVolume, 8.4);
  assert.equal(legacy.unusedSingleUseUnits, 8.4);
  assert.equal(legacy.leftoverUnits, 14.4);
  assert.equal(legacy.dosesPerVial, null);
  assert.equal(legacy.discardedMultiDoseVolume, null);
  assert.equal(calculate({ ...input, singleUseUnitSize: undefined }).valid, false);
});

test('required food-chain exclusion blocks all calculation modes before exposing a quantity', () => {
  for (const doseMode of ['units', 'fixed', 'perKgDose', 'perKgDay']) {
    for (const foodChainStatus of [undefined, null, '', 'unknown', 'notExcluded']) {
      const r = calculate({ ...vial, doseMode, dose: 0.1, requiresFoodChainExclusion: true, foodChainStatus });
      assert.equal(r.valid, false, `${doseMode}/${String(foodChainStatus)}`);
      assert.equal(r.status, 'critical');
      noQuantity(r);
      assert.match(r.errors.join(' '), /koń wyłączony z uboju/);
    }
  }
  const eligible = calculate({ ...vial, requiresFoodChainExclusion: true, foodChainStatus: 'excluded' });
  assert.equal(eligible.valid, true);
  assert.equal(eligible.packages, 1);
  assert.match(eligible.checks.join(' '), /wyłączenie konia/);
});

test('an exclusion flag cannot be satisfied by a different species or a human profile', () => {
  for (const patch of [
    { patientKind: 'human' },
    { patientKind: undefined },
    { species: 'dog' },
    { species: 'cat' },
    { species: undefined },
  ]) {
    const r = calculate({ ...vial, requiresFoodChainExclusion: true, foodChainStatus: 'excluded', ...patch });
    assert.equal(r.valid, false, JSON.stringify(patch));
    noQuantity(r);
    assert.match(r.errors.join(' '), /koń wyłączony/);
  }
});

test('unrestricted forms permit missing food status but reject malformed supplied status', () => {
  for (const foodChainStatus of [undefined, null, '', 'unknown', 'excluded', 'notExcluded']) {
    assert.equal(calculate({ ...vial, foodChainStatus }).valid, true, String(foodChainStatus));
  }
  for (const foodChainStatus of ['yes', 'Excluded', true, {}, []]) {
    const r = calculate({ ...vial, foodChainStatus });
    assert.equal(r.valid, false, String(foodChainStatus));
    noQuantity(r);
    assert.match(r.errors.join(' '), /status wyłączenia/);
  }
  const malformedRequirement = calculate({ ...vial, requiresFoodChainExclusion: 'true' });
  assert.equal(malformedRequirement.valid, false);
  noQuantity(malformedRequirement);
});

test('oral gel uses actual grams and mg/g, with the same unit and calibration guards as paste', () => {
  const input = {
    patientKind: 'animal', species: 'horse', weight: 500,
    form: 'oralGel', unitLabel: 'g', doseMode: 'perKgDose', dose: 0.2,
    strengthMg: 20, frequency: 1, days: 1, packageSize: 10,
  };
  const r = calculate({ ...input, doseStepUnits: 1 });
  assert.equal(r.valid, true);
  assert.equal(r.singleMg, 100);
  assert.equal(r.singleUnits, 5);
  assert.equal(r.totalUnits, 5);
  assert.equal(r.packages, 1);
  assert.equal(r.providedUnits, 10);
  assert.equal(calculate({ ...input, doseStepUnits: 2 }).valid, false);
  assert.equal(calculate({ ...input, unitLabel: 'ml' }).valid, false);
  assert.equal(calculate({ ...input, strengthMg: null, concentrationMg: 20, concentrationMl: 1 }).valid, false);
  assert.equal(calculate({ ...input, doseMode: 'units', dose: 5, requiresFoodChainExclusion: true }).valid, false);
});

const sachet = {
  patientKind: 'animal', species: 'horse', weight: 500,
  form: 'oralPowder', unitLabel: 'g', doseMode: 'units',
  strengthMg: 200, dose: 11, frequency: 2, days: 1,
  packageSize: 100, singleUseUnitSize: 5,
};

test('two 11 g administrations use six 5 g sachets and discard 8 g', () => {
  const r = calculate(sachet);
  assert.equal(r.valid, true);
  assert.equal(r.totalUnits, 22);
  assert.equal(r.singleUseContainers, 6);
  assert.equal(r.unusedSingleUseUnits, 8);
  assert.equal(r.unusedSingleUseVolume, null);
  assert.equal(r.packages, 1);
  assert.equal(r.leftoverUnits, 78);
  assert.equal(r.expiryWasteUnits, 0);
  assert.match(r.warnings.join(' '), /8 g łącznie/);
  assert.equal(r.warnings.some(message => message.includes('ml')), false);
});

test('six 5.5 g administrations use twelve sachets, independently discarding each remainder', () => {
  const r = calculate({ ...sachet, dose: 5.5, days: 3 });
  assert.equal(r.valid, true);
  assert.equal(r.totalUnits, 33);
  assert.equal(r.singleUseContainers, 12);
  assert.equal(r.unusedSingleUseUnits, 27);
  assert.equal(r.packages, 1);
  assert.equal(r.leftoverUnits, 67);
});

test('a daily 5.5 g administration for 28 days needs 56 sachets and three 100 g boxes', () => {
  const r = calculate({ ...sachet, dose: 5.5, frequency: 1, days: 28 });
  assert.equal(r.valid, true);
  assert.equal(r.totalUnits, 154);
  assert.equal(r.singleUseContainers, 56);
  assert.equal(r.unusedSingleUseUnits, 126);
  assert.equal(r.packages, 3);
  assert.equal(r.providedUnits, 300);
  assert.equal(r.leftoverUnits, 146); // 126 g discarded plus four unopened sachets.
  assert.equal(calculate({ ...sachet, dose: 5.5, frequency: 1, days: 28, packageSize: 500 }).packages, 1);
});

test('single-use paste applicators do not carry leftover grams into a manually extended course', () => {
  const r = calculate({ ...sachet, form: 'oralPaste', dose: 5, frequency: 1, days: 3, packageSize: 7.49, singleUseUnitSize: 7.49, discardRemainderAfterUse: true });
  assert.equal(r.valid, true);
  assert.equal(r.totalUnits, 15);
  assert.equal(r.singleUseContainers, 3);
  assert.equal(r.packages, 3);
  close(r.providedUnits, 22.47);
  close(r.unusedSingleUseUnits, 7.47);
  close(r.leftoverUnits, 7.47);
  assert.equal(r.unusedSingleUseVolume, null);
  assert.match(r.checks.join(' '), /pozostałość po podaniu jest usuwana/);
});

test('oral single-use metadata must describe complete containers in grams and cannot add shelf life', () => {
  for (const form of ['oralPaste', 'oralPowder', 'oralGel']) {
    for (const patch of [
      { singleUseUnitSize: 0 },
      { singleUseUnitSize: -1 },
      { singleUseUnitSize: '5' },
      { singleUseUnitSize: NaN },
      { singleUseUnitSize: Number.MIN_VALUE },
      { singleUseUnitSize: 6 },
      { singleUseUnitSize: 101 },
      { unitLabel: 'ml' },
      { shelfLifeDays: 7 },
      { singleUseUnitSize: null, discardRemainderAfterUse: true },
    ]) {
      const r = calculate({ ...sachet, form, ...patch });
      assert.equal(r.valid, false, `${form}/${JSON.stringify(patch)}`);
      noQuantity(r);
    }
    const valid = calculate({ ...sachet, form });
    assert.equal(valid.valid, true, form);
    assert.equal(valid.singleUseContainers, 6, form);
  }
});

test('oral containers without single-use metadata retain ordinary reusable gram accounting', () => {
  const r = calculate({ ...sachet, form: 'oralPaste', singleUseUnitSize: null, dose: 5, frequency: 1, days: 3, packageSize: 7.49 });
  assert.equal(r.valid, true);
  assert.equal(r.totalUnits, 15);
  assert.equal(r.packages, 3);
  assert.equal(r.singleUseContainers, null);
  assert.equal(r.unusedSingleUseUnits, null);
  const shorter = calculate({ ...sachet, form: 'oralPaste', singleUseUnitSize: null, dose: 3, frequency: 1, days: 2, packageSize: 7.49 });
  assert.equal(shorter.valid, true);
  assert.equal(shorter.packages, 1);
});
