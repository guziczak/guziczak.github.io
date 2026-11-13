import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { REGIMENS } from './regimens.js';
import { availableRegimens, resolveRegimen } from './regimen-engine.js';
import { calculate, formatNumber } from './engine.js';

// Integration cases for the checked equine source records. These verify the
// shipped numerical contracts; they are not an independent clinical review.
const forms = new Map(DRUGS.flatMap(drug => drug.forms.map(form => [form.id, form])));
const regimens = new Map(REGIMENS.map(regimen => [regimen.id, regimen]));

function evaluate(id, overrides = {}, calculationOverrides = {}) {
  const regimen = regimens.get(id);
  assert.ok(regimen, `Missing equine source record: ${id}`);
  const form = forms.get(regimen.formIds[0]);
  assert.ok(form, `Missing equine formulation: ${regimen.formIds[0]}`);
  const context = {
    formId: form.id,
    species: 'horse',
    weight: 400,
    age: 5,
    ageUnit: 'years',
    days: regimen.fixedDays ?? regimen.minDays ?? 1,
    calculationBlocked: form.calculationBlocked === true,
    ...overrides,
  };
  const source = resolveRegimen(regimen, context);
  const arithmetic = calculate({
    ...form,
    patientKind: 'animal',
    species: context.species,
    weight: context.weight,
    doseMode: source.doseMode,
    dose: source.dose,
    frequency: source.frequency,
    days: context.days,
    calculationBlocked: context.calculationBlocked,
    packageSize: form.packOptions[0].quantity,
    ...calculationOverrides,
  });
  return { regimen, form, source, arithmetic, usable: source.valid && arithmetic.valid };
}

function near(actual, expected, label) {
  assert.equal(typeof actual, 'number', label);
  assert.ok(Number.isFinite(actual), label);
  assert.ok(Math.abs(actual - expected) <= 1e-10 * Math.max(1, Math.abs(expected)), `${label}: ${actual} != ${expected}`);
}

test('eight new equine source records preserve their exact formulation and checked document date', () => {
  const expected = [
    ['panacur-paste-nematodes', 'panacur-horse-paste-187-5'],
    ['panacur-paste-parascaris', 'panacur-horse-paste-187-5'],
    ['panacur-susp-larvae-five-days', 'panacur-horse-susp-100'],
    ['gastazole-treatment', 'gastazole-horse-paste-370'],
    ['gastazole-followup', 'gastazole-horse-paste-370'],
    ['ventipulmin-acute', 'ventipulmin-horse-granules'],
    ['ventipulmin-chronic', 'ventipulmin-horse-granules'],
    ['equioxx-horse-osteoarthritis', 'equioxx-horse-57'],
  ];
  for (const [id, formId] of expected) {
    const regimen = regimens.get(id), form = forms.get(formId);
    assert.ok(regimen && form, id);
    assert.deepEqual(regimen.formIds, [formId], id);
    assert.deepEqual(regimen.species, ['horse'], id);
    assert.deepEqual(form.targetSpecies, ['horse'], id);
    assert.equal(regimen.sourceCheckedAt, '2026-11-13', id);
    assert.equal(form.sourceCheckedAt, '2026-11-13', id);
    assert.equal(regimen.sourceUrl, form.sourceUrl, `${id}: dose and formulation use the same document`);
    assert.equal(form.defaultDose, null, id);
    assert.equal(form.defaultFrequency, null, id);
    assert.equal(form.defaultDays, null, id);
  }
});

test('Panacur paste distinguishes the 7.5 and 10 mg/kg single doses using actual 24 g syringes', () => {
  const cases = [
    ['panacur-paste-nematodes', 600, 7.5, 4500, 24, 1, 0],
    ['panacur-paste-nematodes', 450, 7.5, 3375, 18, 1, 6],
    ['panacur-paste-parascaris', 450, 10, 4500, 24, 1, 0],
    ['panacur-paste-parascaris', 600, 10, 6000, 32, 2, 16],
  ];
  for (const [id, weight, dose, singleMg, grams, packages, leftover] of cases) {
    const { source, arithmetic, form, usable } = evaluate(id, { weight, age: null });
    assert.equal(usable, true, `${id}/${weight} kg`);
    assert.equal(form.form, 'oralPaste');
    assert.equal(form.strengthMg, 187.5);
    assert.equal(form.unitLabel, 'g');
    assert.deepEqual(form.packOptions.map(pack => pack.quantity), [24]);
    assert.equal(form.shelfLifeDays, null, 'The Polish source does not state an in-use shelf life');
    assert.equal(form.doseStepUnits, undefined, 'No numerical syringe graduation is invented');
    assert.equal(source.doseMode, 'perKgDose');
    assert.equal(source.dose, dose);
    assert.equal(source.frequency, 1);
    assert.equal(source.fixedDays, 1);
    assert.equal(arithmetic.singleMg, singleMg);
    assert.equal(arithmetic.singleUnits, grams);
    assert.equal(arithmetic.totalUnits, grams);
    assert.equal(arithmetic.packages, packages);
    assert.equal(arithmetic.leftoverUnits, leftover);
    assert.equal(arithmetic.roundingDifferencePercent, 0);
  }
});

test('Panacur suspension uses the Irish 100 mg/ml five-day larval-stage regimen, not the paste regimen', () => {
  const id = 'panacur-susp-larvae-five-days';
  const { source, arithmetic, form, usable } = evaluate(id, { weight: 500, age: null });
  assert.equal(usable, true);
  assert.equal(form.form, 'suspension');
  assert.equal(form.unitLabel, 'ml');
  assert.equal(form.concentrationMg, 100);
  assert.equal(form.concentrationMl, 1);
  assert.deepEqual(form.packOptions.map(pack => pack.quantity), [250, 1000, 2500]);
  assert.equal(form.shelfLifeDays, null, 'Do not borrow the UK product\'s in-use shelf life');
  assert.equal(new URL(form.sourceUrl).hostname, 'assets.hpra.ie');
  assert.match(form.sourceLabel, /HPRA.*Irlandia/);
  assert.equal(source.dose, 7.5);
  assert.equal(source.frequency, 1);
  assert.equal(source.fixedDays, 5);
  assert.equal(arithmetic.singleMg, 3750);
  assert.equal(arithmetic.singleUnits, 37.5);
  assert.equal(arithmetic.dailyUnits, 37.5);
  assert.equal(arithmetic.totalUnits, 187.5);
  assert.equal(arithmetic.packages, 1);
  assert.equal(arithmetic.leftoverUnits, 62.5);

  const larger = evaluate(id, { weight: 1000 });
  assert.equal(larger.usable, true);
  assert.equal(larger.arithmetic.singleUnits, 75);
  assert.equal(larger.arithmetic.totalUnits, 375);
  assert.equal(larger.arithmetic.packages, 2);

  assert.deepEqual(availableRegimens(REGIMENS, { formId: form.id, species: 'horse' }).map(r => r.id), [id]);
  assert.deepEqual(availableRegimens(REGIMENS, { formId: 'panacur-horse-paste-187-5', species: 'horse' }).map(r => r.id).sort(),
    ['panacur-paste-nematodes', 'panacur-paste-parascaris']);
});

test('Panacur single administrations cannot become courses, and its five-day regimen cannot be shortened', () => {
  for (const [id, invalidDays] of [
    ['panacur-paste-nematodes', [2, 5]],
    ['panacur-paste-parascaris', [2, 5]],
    ['panacur-susp-larvae-five-days', [1, 4, 6]],
  ]) {
    for (const days of invalidDays) {
      const result = evaluate(id, { days });
      assert.equal(result.source.valid, false, `${id}/${days} days`);
      assert.match(result.source.errors.join(' '), /dokładnie/);
      assert.equal(result.arithmetic.valid, true, 'Arithmetic alone cannot validate a treatment duration');
      assert.equal(result.usable, false);
    }
  }
});

test('Gastazole treatment and follow-up calculate separate 28-day supplies at their distinct doses', () => {
  for (const [id, dose, milligrams, divisions, packages] of [
    ['gastazole-treatment', 4, 1600, 4, 16],
    ['gastazole-followup', 1, 400, 1, 4],
  ]) {
    const { source, arithmetic, form, usable } = evaluate(id, { weight: 400 });
    assert.equal(usable, true, id);
    assert.equal(form.form, 'oralPaste');
    assert.equal(form.unitLabel, 'g');
    assert.equal(form.strengthMg, 370);
    assert.deepEqual(form.packOptions.map(pack => pack.quantity), [7.57]);
    assert.equal(form.shelfLifeDays, 28);
    assert.equal(form.doseStepUnits, 400 / 370);
    assert.equal(source.dose, dose);
    assert.equal(source.frequency, 1);
    assert.equal(source.fixedDays, 28);
    near(arithmetic.singleMg, milligrams, `${id}: active ingredient`);
    near(arithmetic.singleUnits, milligrams / 370, `${id}: paste grams`);
    near(arithmetic.singleUnits / form.doseStepUnits, divisions, `${id}: whole syringe divisions`);
    near(arithmetic.totalUnits, milligrams / 370 * 28, `${id}: selected phase supply`);
    assert.equal(arithmetic.packages, packages);
    near(arithmetic.roundingDifferencePercent, 0, `${id}: no clinical rounding of a recurring gram fraction`);
    for (const days of [27, 29, 56]) {
      const invalid = evaluate(id, { days });
      assert.equal(invalid.source.valid, false, `${id}/${days} days`);
      assert.equal(invalid.usable, false, 'A phase cannot silently become a combined two-phase prescription');
    }
  }
});

test('Gastazole four-week and 70 kg source boundaries are independent of syringe measurability', () => {
  for (const id of ['gastazole-treatment', 'gastazole-followup']) {
    const boundary = evaluate(id, { weight: 400, age: 4, ageUnit: 'weeks' });
    assert.equal(boundary.usable, true, id);
    assert.equal(evaluate(id, { age: 28, ageUnit: 'days' }).source.valid, true, id);
    for (const context of [
      { age: 3.999, ageUnit: 'weeks' },
      { age: 27, ageUnit: 'days' },
      { age: null },
      { weight: 69.999 },
    ]) {
      const result = evaluate(id, context);
      assert.equal(result.source.valid, false, `${id}: ${JSON.stringify(context)}`);
      assert.equal(result.usable, false);
    }
    const minimumWeight = evaluate(id, { weight: 70, age: 4, ageUnit: 'weeks' });
    assert.equal(minimumWeight.source.valid, true, `${id}: 70 kg is inside the source population`);
    assert.equal(minimumWeight.arithmetic.valid, false, `${id}: source eligibility cannot imply a measurable syringe setting`);
    assert.match(minimumWeight.arithmetic.errors.join(' '), /podziałkom przyrządu/);
  }
});

test('Gastazole 500 kg follow-up is blocked rather than rounded from 1.25 syringe divisions', () => {
  const treatment = evaluate('gastazole-treatment', { weight: 500 });
  assert.equal(treatment.usable, true);
  near(treatment.arithmetic.singleUnits / treatment.form.doseStepUnits, 5, '500 kg treatment setting');

  const followup = evaluate('gastazole-followup', { weight: 500 });
  assert.equal(followup.source.valid, true);
  assert.equal(followup.arithmetic.valid, false);
  assert.equal(followup.arithmetic.status, 'critical');
  assert.equal(followup.usable, false);
  near(followup.arithmetic.theoreticalUnits, 500 / 370, 'Unrounded required paste');
  near(followup.arithmetic.singleUnits / followup.form.doseStepUnits, 1.25, 'Unrounded device divisions');
  assert.equal(followup.arithmetic.singleUnits, followup.arithmetic.theoreticalUnits);
  near(followup.arithmetic.roundingDifferencePercent, 0, 'No clinical rounding of a recurring gram fraction');
  assert.match(followup.arithmetic.errors.join(' '), /Nie zaokrąglono do podziałki/);
});

test('Ventipulmin preserves the hydrochloride microgram dose and returns grams of 0.016 mg/g granules', () => {
  const { source, arithmetic, form, usable } = evaluate('ventipulmin-acute', { weight: 500, days: 10 });
  assert.equal(usable, true);
  assert.equal(form.form, 'oralPowder');
  assert.equal(form.unitLabel, 'g');
  assert.equal(form.strengthMg, 0.016);
  assert.equal(form.doseBasisIngredient, 'chlorowodorku klenbuterolu');
  assert.deepEqual(form.packOptions.map(pack => pack.quantity), [500]);
  assert.equal(source.doseMode, 'perKgDose');
  assert.equal(source.dose, 0.0008);
  assert.equal(formatNumber(source.dose, 6), '0,0008');
  assert.equal(source.frequency, 2);
  assert.equal(arithmetic.singleMg, 0.4);
  assert.equal(arithmetic.dailyMg, 0.8);
  assert.equal(arithmetic.singleUnits, 25);
  assert.equal(arithmetic.dailyUnits, 50);
  assert.equal(arithmetic.totalUnits, 500);
  assert.equal(arithmetic.packages, 1);
  assert.equal(arithmetic.roundingDifferencePercent, 0);
});

test('Ventipulmin requires 10–14 days for acute disease or at least 28 days for chronic disease', () => {
  for (const days of [10, 14]) {
    const result = evaluate('ventipulmin-acute', { weight: 500, days });
    assert.equal(result.usable, true, `Acute ${days} days`);
    assert.equal(result.source.fixedDays, null);
    assert.equal(result.source.minDays, 10);
    assert.equal(result.source.maxDays, 14);
  }
  for (const days of [9, 15, 21, 28]) {
    const result = evaluate('ventipulmin-acute', { days });
    assert.equal(result.source.valid, false, `Acute ${days} days`);
    assert.equal(result.usable, false);
  }
  for (const days of [28, 42, 43]) {
    const result = evaluate('ventipulmin-chronic', { days });
    assert.equal(result.usable, true, `Chronic ${days} days`);
    assert.equal(result.source.fixedDays, null);
    assert.equal(result.source.minDays, 28);
    assert.equal(result.source.maxDays, null, 'Do not invent a chronic-course ceiling');
  }
  for (const days of [1, 14, 21, 27]) {
    const result = evaluate('ventipulmin-chronic', { days });
    assert.equal(result.source.valid, false, `Chronic ${days} days`);
    assert.equal(result.usable, false);
  }
});

test('Ventipulmin 21-day in-use life increases supply when low daily use leaves expired granules', () => {
  const result = evaluate('ventipulmin-chronic', { weight: 100, days: 28 });
  assert.equal(result.usable, true);
  assert.equal(result.form.shelfLifeDays, 21);
  assert.equal(result.arithmetic.singleUnits, 5);
  assert.equal(result.arithmetic.dailyUnits, 10);
  assert.equal(result.arithmetic.totalUnits, 280);
  assert.equal(result.arithmetic.packages, 2, 'The first 500 g container expires after only 210 g is used');
  assert.equal(result.arithmetic.expiryWasteUnits, 290);
  assert.equal(result.arithmetic.providedUnits, 1000);
  assert.equal(result.arithmetic.leftoverUnits, 720);
  assert.match(result.arithmetic.warnings.join(' '), /trwałość po otwarciu/);
  assert.equal(evaluate('ventipulmin-chronic', { weight: 100, days: 42 }).arithmetic.packages, 2);
  assert.equal(evaluate('ventipulmin-chronic', { weight: 100, days: 43 }).arithmetic.packages, 3);
});

test('Equioxx is one whole 57 mg tablet only within the literal inclusive 450–600 kg range', () => {
  for (const weight of [450, 525, 600]) {
    const { source, arithmetic, form, usable } = evaluate('equioxx-horse-osteoarthritis', { weight, days: 14 });
    assert.equal(usable, true, `${weight} kg`);
    assert.equal(source.doseMode, 'units');
    assert.equal(source.dose, 1);
    assert.equal(source.frequency, 1);
    assert.equal(source.maxDays, 14);
    assert.equal(source.fixedDays, null);
    assert.equal(form.strengthMg, 57);
    assert.deepEqual(form.allowedFractions, [1]);
    assert.equal(arithmetic.singleUnits, 1);
    assert.equal(arithmetic.singleMg, 57);
    assert.equal(arithmetic.totalUnits, 14);
    assert.equal(arithmetic.packages, 2);
  }
  for (const weight of [449.999, 600.001, 300, 900]) {
    const result = evaluate('equioxx-horse-osteoarthritis', { weight });
    assert.equal(result.source.valid, false, `${weight} kg`);
    assert.equal(result.source.dose, 1, 'The source does not invent a half or double tablet');
    assert.equal(result.arithmetic.valid, true, 'The source range must gate copying even when arithmetic succeeds');
    assert.equal(result.usable, false);
  }
});

test('Equioxx cannot exceed its 14-day source limit or acquire a tablet-splitting permission', () => {
  const tooLong = evaluate('equioxx-horse-osteoarthritis', { weight: 500, days: 15 });
  assert.equal(tooLong.source.valid, false);
  assert.equal(tooLong.arithmetic.valid, true);
  assert.equal(tooLong.usable, false);
  assert.match(tooLong.source.errors.join(' '), /limit.*14/);

  const split = evaluate('equioxx-horse-osteoarthritis', { weight: 500 }, { dose: 0.5 });
  assert.equal(split.arithmetic.valid, false);
  assert.equal(split.arithmetic.status, 'critical');
  assert.equal(split.arithmetic.singleUnits, 0.5);
  assert.equal(split.arithmetic.roundingDifferencePercent, 0);
  assert.match(split.arithmetic.errors.join(' '), /podzielności produktu/);
});
