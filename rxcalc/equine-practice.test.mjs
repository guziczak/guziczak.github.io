import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { REGIMENS } from './regimens.js';
import { availableRegimens, resolveRegimen } from './regimen-engine.js';
import { calculate } from './engine.js';

// Exercise the shipped imports and product-specific source contracts together.
// These are regression checks of the verified records, not a clinical review.
const records = new Map(REGIMENS.map(record => [record.id, record]));
const forms = new Map(DRUGS.flatMap(drug => drug.forms.map(form => [form.id, { drug, form }])));
const products = [
  {
    drugId: 'vet-flunivis', formId: 'flunivis-horse-50-iv', form: 'injection', route: 'iv', sourceId: 50492,
    regimens: [['flunivis-horse-msk-pyrexia', 5]],
  },
  {
    drugId: 'vet-butagran-equi', formId: 'butagran-equi-horse-200', form: 'oralPowder', route: 'oral', sourceId: 30160,
    regimens: [['butagran-horse-day-one', 1], ['butagran-horse-days-two-four', 3], ['butagran-horse-daily-continuation', 14]],
  },
  {
    drugId: 'vet-paramectin', formId: 'paramectin-horse-paste-18-7', form: 'oralPaste', route: 'oral', sourceId: 18731,
    regimens: [['paramectin-horse-susceptible-parasites', 1]],
  },
  {
    drugId: 'vet-iverpraz', formId: 'iverpraz-horse-paste-18-7-140-3', form: 'oralPaste', route: 'oral', sourceId: 31634,
    regimens: [['iverpraz-horse-mixed-infestation-table', 1]],
  },
  {
    drugId: 'vet-equimoxin', formId: 'equimoxin-horse-gel-18-92', form: 'oralGel', route: 'oral', sourceId: 47141,
    regimens: [['equimoxin-horse-susceptible-parasites', 1]],
  },
  {
    drugId: 'vet-pyrantel-vet-planet', formId: 'pyrantel-vet-planet-horse-paste-350', form: 'oralPaste', route: 'oral', sourceId: 16565,
    regimens: [['pyrantel-vet-planet-horse-nematodes', 1], ['pyrantel-vet-planet-horse-anoplocephala', 1]],
  },
];
const selectedDays = new Map(products.flatMap(product => product.regimens));

function evaluate(id, overrides = {}, arithmeticOverrides = {}) {
  const regimen = records.get(id);
  assert.ok(regimen, `Missing shipped regimen: ${id}`);
  const { form } = forms.get(regimen.formIds[0]) ?? {};
  assert.ok(form, `Missing shipped formulation for ${id}`);
  const context = {
    formId: form.id, species: 'horse', weight: 500, age: 5, ageUnit: 'years',
    days: selectedDays.get(id), foodChainStatus: 'excluded',
    calculationBlocked: form.calculationBlocked === true,
    ...overrides,
  };
  const source = resolveRegimen(regimen, context);
  const arithmeticInput = {
    ...form,
    patientKind: 'animal', species: context.species, weight: context.weight,
    foodChainStatus: context.foodChainStatus,
    doseMode: source.doseMode, dose: source.dose, frequency: source.frequency,
    days: context.days, calculationBlocked: context.calculationBlocked,
    packageSize: form.packOptions[0].quantity,
    ...arithmeticOverrides,
  };
  const arithmetic = calculate(arithmeticInput);
  return { regimen, form, context, source, arithmetic, arithmeticInput, usable: source.valid && arithmetic.valid };
}

function near(actual, expected, label) {
  assert.equal(typeof actual, 'number', label);
  assert.ok(Number.isFinite(actual), label);
  assert.ok(Math.abs(actual - expected) <= 1e-10 * Math.max(1, Math.abs(expected)), `${label}: ${actual} != ${expected}`);
}

test('six added products and all nine source regimens are wired into the shipped horse catalogue', () => {
  assert.equal(products.length, 6);
  assert.equal(selectedDays.size, 9);
  for (const expected of products) {
    const entries = DRUGS.filter(drug => drug.id === expected.drugId);
    assert.equal(entries.length, 1, expected.drugId);
    const drug = entries[0], form = forms.get(expected.formId)?.form;
    assert.ok(form, expected.formId);
    assert.ok(drug.forms.includes(form));
    assert.ok(drug.specialties.includes('veterinary'));
    assert.equal(typeof drug.substanceLabel, 'string');
    assert.ok(drug.substanceLabel.trim());
    assert.equal(form.form, expected.form);
    assert.equal(form.routeCode, expected.route);
    assert.equal(form.unitLabel, expected.form === 'injection' ? 'ml' : 'g');
    assert.deepEqual(form.targetSpecies, ['horse']);
    assert.equal(form.defaultDose, null);
    assert.equal(form.defaultFrequency, null);
    assert.equal(form.defaultDays, null);
    assert.equal(form.sourceCheckedAt, '2026-11-13');
    const url = new URL(form.sourceUrl);
    assert.equal(url.protocol, 'https:');
    assert.ok(['rejestrymedyczne.ezdrowie.gov.pl', 'rejestry.ezdrowie.gov.pl'].includes(url.hostname));
    assert.equal(url.pathname, `/api/rpl/medicinal-products/${expected.sourceId}/characteristic`);
    const offered = availableRegimens(REGIMENS, { formId: form.id, species: 'horse' });
    assert.deepEqual(offered.map(record => record.id).sort(), expected.regimens.map(([id]) => id).sort());
    for (const [id, days] of expected.regimens) {
      assert.equal(REGIMENS.filter(record => record.id === id).length, 1, id);
      const { regimen, source, arithmetic, usable } = evaluate(id, { days });
      assert.deepEqual(regimen.formIds, [form.id], id);
      assert.deepEqual(regimen.species, ['horse'], id);
      assert.equal(regimen.sourceUrl, form.sourceUrl, id);
      assert.equal(regimen.sourceCheckedAt, '2026-11-13', id);
      for (const key of ['sourceSection', 'indication', 'phaseLabel', 'screening']) {
        assert.ok(typeof regimen[key] === 'string' && regimen[key].trim(), `${id}: ${key}`);
      }
      assert.equal(source.valid, true, `${id}: ${source.errors.join(' ')}`);
      assert.equal(arithmetic.valid, true, `${id}: ${arithmetic.errors.join(' ')}`);
      assert.equal(usable, true, id);
      assert.ok(arithmetic.singleUnits > 0 && arithmetic.packages >= 1, id);
      assert.equal(arithmetic.status, 'warning', `${id}: a calculation is not clinical clearance`);
    }
  }
});

test('added source records cannot transfer to another species or a neighbouring equine product', () => {
  for (const id of selectedDays.keys()) {
    const correct = evaluate(id);
    const otherForm = products.find(product => product.formId !== correct.form.id).formId;
    for (const patch of [{ species: 'dog' }, { species: 'rat' }, { formId: otherForm }]) {
      const context = { ...correct.context, ...patch };
      assert.equal(availableRegimens(REGIMENS, context).some(record => record.id === id), false, `${id}: ${JSON.stringify(patch)}`);
      const source = resolveRegimen(correct.regimen, context);
      assert.equal(source.valid, false, id);
      assert.equal(source.dose, null, id);
    }
  }
});

test('Flunivis 500 kg for five days uses 11 ml IV doses and the selected multidose vial size', () => {
  for (const [packageSize, packages, dosesPerVial, discarded] of [[50, 2, 4, 6], [100, 1, 9, 0]]) {
    const { form, regimen, source, arithmetic, usable } = evaluate('flunivis-horse-msk-pyrexia', { weight: 500, days: 5 }, { packageSize });
    assert.equal(usable, true);
    assert.equal(form.routeCode, 'iv');
    assert.equal(regimen.routeCode, 'iv');
    assert.equal(form.concentrationMg, 50);
    assert.equal(form.concentrationMl, 1);
    assert.equal(form.doseBasisIngredient, 'fluniksyny');
    assert.equal(form.injectionContainerUse, 'multiDose');
    assert.equal(form.shelfLifeDays, 28);
    assert.equal(form.maxWithdrawalsPerVial, 25);
    assert.ok(form.packOptions.some(pack => pack.quantity === packageSize));
    assert.equal(source.dose, 1.1);
    assert.equal(source.frequency, 1);
    assert.equal(source.maxDays, 5);
    assert.equal(arithmetic.singleMg, 550);
    assert.equal(arithmetic.singleUnits, 11);
    assert.equal(arithmetic.totalUnits, 55);
    assert.equal(arithmetic.packages, packages);
    assert.equal(arithmetic.dosesPerVial, dosesPerVial);
    assert.equal(arithmetic.discardedMultiDoseVolume, discarded);
    assert.equal(arithmetic.singleUseContainers, null, 'A multidose vial is not an ampoule for every administration');
  }
  const tooLong = evaluate('flunivis-horse-msk-pyrexia', { days: 6 });
  assert.equal(tooLong.source.valid, false);
  assert.equal(tooLong.arithmetic.valid, true);
  assert.equal(tooLong.usable, false, 'Duration must be checked by the source resolver');
});

test('Butagran phases preserve per-administration dosing and count fresh 5 g sachets separately', () => {
  const cases = [
    ['butagran-horse-day-one', 1, 4.4, 2, 2200, 11, 22, 6, 8, 1],
    ['butagran-horse-days-two-four', 3, 2.2, 2, 1100, 5.5, 33, 12, 27, 1],
    ['butagran-horse-daily-continuation', 14, 2.2, 1, 1100, 5.5, 77, 28, 63, 2],
  ];
  for (const [id, days, dose, frequency, milligrams, singleGrams, totalGrams, sachets, discarded, packs] of cases) {
    const { form, source, arithmetic, usable } = evaluate(id, { weight: 500, days });
    assert.equal(usable, true, id);
    assert.equal(form.form, 'oralPowder');
    assert.equal(form.unitLabel, 'g');
    assert.equal(form.strengthMg, 200);
    assert.equal(form.doseBasisIngredient, 'fenylbutazonu');
    assert.equal(form.singleUseUnitSize, 5);
    assert.equal(form.shelfLifeDays, null);
    assert.deepEqual(form.packOptions.map(pack => pack.quantity), [100, 500]);
    assert.equal(source.doseMode, 'perKgDose');
    assert.equal(source.dose, dose);
    assert.equal(source.frequency, frequency);
    assert.equal(arithmetic.singleMg, milligrams);
    assert.equal(arithmetic.singleUnits, singleGrams);
    assert.equal(arithmetic.totalUnits, totalGrams);
    assert.equal(arithmetic.singleUseContainers, sachets);
    assert.equal(arithmetic.unusedSingleUseUnits, discarded);
    assert.equal(arithmetic.unusedSingleUseVolume, null, 'Powder losses are grams, not ml');
    assert.equal(arithmetic.packages, packs);
    assert.equal(arithmetic.roundingDifferencePercent, 0, 'The administered dose is not rounded to a full sachet');
  }
  const largerBox = evaluate('butagran-horse-daily-continuation', { days: 14 }, { packageSize: 500 });
  assert.equal(largerBox.usable, true);
  assert.equal(largerBox.arithmetic.singleUseContainers, 28);
  assert.equal(largerBox.arithmetic.packages, 1);
});

test('Butagran loading and three-day phases cannot become longer courses or fill in continuation duration', () => {
  for (const [id, days] of [
    ['butagran-horse-day-one', 2],
    ['butagran-horse-day-one', 4],
    ['butagran-horse-days-two-four', 1],
    ['butagran-horse-days-two-four', 4],
  ]) {
    const result = evaluate(id, { days });
    assert.equal(result.source.valid, false, `${id}/${days}`);
    assert.equal(result.usable, false);
    assert.match(result.source.errors.join(' '), /dokładnie/);
  }
  const continuation = evaluate('butagran-horse-daily-continuation', { days: null });
  assert.equal(continuation.source.fixedDays, null);
  assert.equal(continuation.source.maxDays, null);
  assert.equal(continuation.source.frequency, 1, 'Only the explicitly selected daily continuation is modelled');
  assert.equal(continuation.source.valid, true);
  assert.equal(continuation.arithmetic.valid, false);
  assert.equal(continuation.arithmetic.totalUnits, null);
  assert.equal(continuation.arithmetic.packages, null);
});

test('all three food-chain-restricted products block source and manual calculations without confirmed exclusion', () => {
  const restrictedIds = new Set(['butagran-equi-horse-200', 'equimoxin-horse-gel-18-92', 'pyrantel-vet-planet-horse-paste-350']);
  const restrictedProducts = products.filter(product => forms.get(product.formId).form.requiresFoodChainExclusion === true);
  assert.deepEqual(new Set(restrictedProducts.map(product => product.formId)), restrictedIds);
  for (const product of restrictedProducts) {
    const form = forms.get(product.formId).form;
    for (const [id] of product.regimens) {
      assert.equal(records.get(id).requiresFoodChainExclusion, true, id);
      for (const foodChainStatus of [undefined, 'unknown', 'notExcluded']) {
        const result = evaluate(id, { foodChainStatus });
        assert.equal(result.source.valid, false, `${id}/${foodChainStatus}`);
        assert.match(result.source.errors.join(' '), /produkcji żywności/);
        assert.equal(result.arithmetic.valid, false, `${id}/${foodChainStatus}`);
        assert.equal(result.arithmetic.singleUnits, null);
        assert.equal(result.arithmetic.packages, null);
        assert.equal(result.usable, false);
      }
      assert.equal(evaluate(id, { foodChainStatus: 'excluded' }).usable, true, id);
    }
    // Entering grams manually must retain the catalogue's product restriction.
    const manualInput = {
      ...form, patientKind: 'animal', species: 'horse', weight: 500,
      doseMode: 'units', dose: form.doseStepUnits ?? 5, frequency: 1, days: 1,
      packageSize: form.packOptions[0].quantity,
    };
    for (const foodChainStatus of [undefined, 'unknown', 'notExcluded']) {
      const manual = calculate({ ...manualInput, foodChainStatus });
      assert.equal(manual.valid, false, `${form.id}: manual/${foodChainStatus}`);
      assert.equal(manual.status, 'critical');
      assert.equal(manual.singleUnits, null);
      assert.equal(manual.packages, null);
    }
    assert.equal(calculate({ ...manualInput, foodChainStatus: 'excluded' }).valid, true, form.id);
  }
});

test('Iverpraz follows the printed grams table including endpoints and fractional weights inside a row', () => {
  const cases = [
    [100, 1.070], [101, 1.605], [150, 1.605], [151, 2.140], [200, 2.140],
    [201, 2.675], [250, 2.675], [251, 3.210], [300, 3.210], [301, 3.745],
    [350, 3.745], [351, 4.280], [400, 4.280], [401, 4.815], [450, 4.815],
    [451, 5.350], [499.5, 5.350], [500, 5.350], [501, 5.885], [550, 5.885],
    [551, 6.420], [600, 6.420], [601, 6.955], [650, 6.955], [651, 7.490], [700, 7.490],
  ];
  for (const [weight, grams] of cases) {
    const { form, source, arithmetic, usable } = evaluate('iverpraz-horse-mixed-infestation-table', { weight });
    assert.equal(usable, true, `${weight} kg`);
    assert.equal(source.doseMode, 'units');
    assert.equal(source.dose, grams);
    assert.equal(source.fixedDays, 1);
    assert.equal(source.frequency, 1);
    assert.equal(form.doseStepUnits, 0.535);
    assert.equal(arithmetic.singleUnits, grams);
    assert.equal(arithmetic.totalUnits, grams);
    assert.equal(arithmetic.packages, 1);
    near(arithmetic.singleUnits / form.doseStepUnits, Math.round(grams / 0.535), 'Whole labelled divisions');
    near(arithmetic.roundingDifferencePercent, 0, 'No additional dose rounding');
  }
});

test('Iverpraz rejects gaps and extrapolation while keeping both active ingredients and their basis', () => {
  for (const weight of [100.5, 150.5, 200.5, 250.5, 300.5, 350.5, 400.5, 450.5, 500.5, 550.5, 600.5, 650.5, 700.01]) {
    const result = evaluate('iverpraz-horse-mixed-infestation-table', { weight });
    assert.equal(result.source.valid, false, `${weight} kg`);
    assert.equal(result.source.dose, null);
    assert.equal(result.arithmetic.singleUnits, null);
    assert.equal(result.usable, false);
  }
  const result = evaluate('iverpraz-horse-mixed-infestation-table', { weight: 500 });
  assert.deepEqual(result.form.activeIngredients, [
    { substanceLabel: 'Iwermektyna', strengthMg: 18.7 },
    { substanceLabel: 'Prazykwantel', strengthMg: 140.3 },
  ]);
  assert.equal(result.form.strengthMg, 18.7);
  assert.equal(result.form.doseBasisIngredient, 'iwermektyny');
  assert.ok(result.form.combinationNote?.trim());
  assert.equal(result.arithmetic.singleUnits, 5.35, 'Use the printed amount rather than recomputing it from one ingredient');
  assert.equal(result.arithmetic.singleMg, 100.045, 'The engine mg field reports ivermectin, not the sum of the ingredients');
  near(result.arithmetic.singleUnits * result.form.activeIngredients[1].strengthMg, 750.605, 'Praziquantel in the printed amount');
  assert.equal(result.form.unmodelledShelfLifeMonths, 6);
  assert.equal(result.form.shelfLifeDays, null);
});

test('source age gates retain weeks and months without promoting precautions into new thresholds', () => {
  for (const [id, age, ageUnit] of [
    ['paramectin-horse-susceptible-parasites', 6, 'weeks'],
    ['iverpraz-horse-mixed-infestation-table', 2, 'weeks'],
    ['equimoxin-horse-susceptible-parasites', 4, 'months'],
  ]) {
    const boundary = evaluate(id, { age, ageUnit });
    assert.deepEqual(boundary.regimen.minimumAge, { value: age, unit: ageUnit });
    assert.equal(boundary.usable, true, `${id}: exact threshold`);
    for (const younger of [age - 0.01, null]) {
      const result = evaluate(id, { age: younger, ageUnit });
      assert.equal(result.source.valid, false, `${id}: ${younger}`);
      assert.equal(result.usable, false);
    }
  }
  const youngIverpraz = evaluate('iverpraz-horse-mixed-infestation-table', { age: 4, ageUnit: 'weeks' });
  assert.equal(youngIverpraz.source.valid, true, 'The two-month precaution is not the source contraindication threshold');
  assert.match(youngIverpraz.regimen.notes.join(' '), /2 miesięcy/);
  for (const id of ['flunivis-horse-msk-pyrexia', 'butagran-horse-day-one', 'pyrantel-vet-planet-horse-nematodes']) {
    assert.equal(records.get(id).minimumAge, undefined, id);
  }
});

test('Paramectin and Equimoxin use full source-calibrated divisions with grams derived from active strength', () => {
  const cases = [
    ['paramectin-horse-susceptible-parasites', 100, 0.2, 18.7, 1, 7.49],
    ['paramectin-horse-susceptible-parasites', 500, 0.2, 18.7, 5, 7.49],
    ['paramectin-horse-susceptible-parasites', 700, 0.2, 18.7, 7, 7.49],
    ['equimoxin-horse-susceptible-parasites', 450, 0.4, 18.92, 9, 14.8],
    ['equimoxin-horse-susceptible-parasites', 500, 0.4, 18.92, 10, 14.8],
    ['equimoxin-horse-susceptible-parasites', 700, 0.4, 18.92, 14, 14.8],
  ];
  for (const [id, weight, dose, strength, divisions, packSize] of cases) {
    const { form, source, arithmetic, usable } = evaluate(id, { weight });
    assert.equal(usable, true, `${id}/${weight}`);
    assert.equal(source.dose, dose);
    assert.equal(source.frequency, 1);
    assert.equal(source.fixedDays, 1);
    assert.equal(form.strengthMg, strength);
    assert.equal(form.doseStepUnits, 20 / strength);
    assert.deepEqual(form.packOptions.map(pack => pack.quantity), [packSize]);
    near(arithmetic.singleMg, dose * weight, `${id}: active dose`);
    near(arithmetic.singleUnits, dose * weight / strength, `${id}: product grams`);
    near(arithmetic.singleUnits / form.doseStepUnits, divisions, `${id}: full divisions`);
    assert.equal(arithmetic.packages, 1);
    near(arithmetic.roundingDifferencePercent, 0, `${id}: no device rounding`);
  }
  const gel = forms.get('equimoxin-horse-gel-18-92').form;
  assert.equal(gel.form, 'oralGel');
  assert.equal(gel.unmodelledShelfLifeMonths, 6);
  assert.equal(gel.shelfLifeDays, null);
});

test('unmeasurable Paramectin and Equimoxin doses remain blocked even when their source population matches', () => {
  for (const [id, weight, divisions] of [
    ['paramectin-horse-susceptible-parasites', 450, 4.5],
    ['paramectin-horse-susceptible-parasites', 550, 5.5],
    ['equimoxin-horse-susceptible-parasites', 525, 10.5],
  ]) {
    const result = evaluate(id, { weight });
    assert.equal(result.source.valid, true, id);
    assert.equal(result.arithmetic.valid, false, id);
    assert.equal(result.arithmetic.status, 'critical');
    assert.equal(result.usable, false);
    near(result.arithmetic.singleUnits / result.form.doseStepUnits, divisions, `${id}: unrounded divisions`);
    assert.equal(result.arithmetic.singleUnits, result.arithmetic.theoreticalUnits);
    near(result.arithmetic.roundingDifferencePercent, 0, `${id}: no rounding to another weight`);
    assert.match(result.arithmetic.errors.join(' '), /podziałkom przyrządu/);
  }
});

test('Paramectin catalogue metadata discards the remaining paste instead of pooling it between manual administrations', () => {
  const selected = evaluate('paramectin-horse-susceptible-parasites');
  assert.equal(selected.form.discardRemainderAfterUse, true);
  assert.equal(selected.form.singleUseUnitSize, 7.49);
  assert.equal(selected.form.shelfLifeDays, null);
  assert.equal(selected.arithmetic.singleUseContainers, 1);
  near(selected.arithmetic.unusedSingleUseUnits, 7.49 - 100 / 18.7, 'Discarded remainder in grams');
  assert.equal(selected.arithmetic.unusedSingleUseVolume, null);

  const extended = evaluate('paramectin-horse-susceptible-parasites', { days: 2 });
  assert.equal(extended.source.valid, false, 'The shipped source is a single administration');
  assert.equal(extended.usable, false);
  assert.equal(extended.arithmetic.valid, true, 'Manual arithmetic still accounts for every discarded applicator');
  assert.equal(extended.arithmetic.singleUseContainers, 2);
  assert.equal(extended.arithmetic.packages, 2);
});

test('Pyrantel single-dose regimens use embonate mass and 30 g product syringes, not free pyrantel or syringe ml', () => {
  for (const [id, dose, singleMg, grams, packages] of [
    ['pyrantel-vet-planet-horse-nematodes', 19, 9500, 9500 / 350, 1],
    ['pyrantel-vet-planet-horse-anoplocephala', 38, 19000, 19000 / 350, 2],
  ]) {
    const { form, source, arithmetic, usable } = evaluate(id, { age: null });
    assert.equal(usable, true, id);
    assert.equal(form.strengthMg, 350);
    assert.equal(form.unitLabel, 'g');
    assert.equal(form.doseBasisIngredient, 'embonianu pyrantelu');
    assert.deepEqual(form.activeIngredients, [{ substanceLabel: 'Embonian pyrantelu', strengthMg: 350 }]);
    assert.deepEqual(form.packOptions.map(pack => pack.quantity), [30]);
    assert.equal(form.doseStepUnits, undefined, 'No numeric graduation is invented');
    assert.equal(source.doseMode, 'perKgDose');
    assert.equal(source.dose, dose);
    assert.equal(source.frequency, 1);
    assert.equal(source.fixedDays, 1);
    near(arithmetic.singleMg, singleMg, `${id}: embonate mg`);
    near(arithmetic.singleUnits, grams, `${id}: whole product grams`);
    near(arithmetic.totalUnits, grams, `${id}: one administration`);
    assert.equal(arithmetic.packages, packages);
    const repeated = evaluate(id, { days: 2 });
    assert.equal(repeated.source.valid, false, id);
    assert.equal(repeated.usable, false, id);
  }
});
