import test from 'node:test';
import assert from 'node:assert/strict';
import { REGIMENS } from './regimens.js';
import { DRUGS } from './catalogue.js';
import { availableRegimens, resolveRegimen } from './regimen-engine.js';
import { calculate } from './engine.js';

// These integration tests check the shipped source records and preparation
// metadata together. They do not independently verify the medical documents.
const forms = new Map(DRUGS.flatMap(drug => drug.forms.map(form => [form.id, { drug, form }])));
const getRegimen = id => {
  const regimen = REGIMENS.find(item => item.id === id);
  assert.ok(regimen, `Missing source regimen: ${id}`);
  return regimen;
};
const getForm = id => {
  const entry = forms.get(id);
  assert.ok(entry, `Missing catalogue formulation: ${id}`);
  return entry.form;
};

function evaluate(regimenId, formId, overrides = {}) {
  const regimen = getRegimen(regimenId);
  const form = getForm(formId);
  const species = regimen.species[0];
  const firstBand = regimen.weightBands?.[0];
  // The 1 mg/kg Gastazole phase needs a whole source-device division: 400 kg.
  // Its 500 kg arithmetic failure is covered explicitly in equine-regimens.test.mjs.
  const horseWeight = regimen.id === 'gastazole-followup' ? 400 : 500;
  const context = {
    formId,
    species,
    weight: firstBand ? (firstBand.min + firstBand.max) / 2 : species === 'horse' ? horseWeight : species === 'cat' ? 5 : 10,
    age: 2,
    ageUnit: 'years',
    foodChainStatus: 'excluded',
    days: regimen.fixedDays ?? regimen.minDays ?? 1,
    calculationBlocked: form.calculationBlocked === true,
    ...overrides,
  };
  const source = resolveRegimen(regimen, context);
  const arithmetic = calculate({
    ...form,
    patientKind: 'animal',
    species: context.species,
    foodChainStatus: context.foodChainStatus,
    weight: context.weight,
    doseMode: source.doseMode,
    dose: source.dose,
    frequency: source.frequency,
    days: context.days,
    calculationBlocked: context.calculationBlocked,
    packageSize: form.packOptions[0].quantity,
  });
  return { regimen, form, context, source, arithmetic };
}

test('all shipped source records point to existing veterinary formulations and exact target species', () => {
  const expected = [
    ['flunivis-horse-msk-pyrexia', ['flunivis-horse-50-iv'], ['horse']],
    ['butagran-horse-day-one', ['butagran-equi-horse-200'], ['horse']],
    ['butagran-horse-days-two-four', ['butagran-equi-horse-200'], ['horse']],
    ['butagran-horse-daily-continuation', ['butagran-equi-horse-200'], ['horse']],
    ['paramectin-horse-susceptible-parasites', ['paramectin-horse-paste-18-7'], ['horse']],
    ['iverpraz-horse-mixed-infestation-table', ['iverpraz-horse-paste-18-7-140-3'], ['horse']],
    ['equimoxin-horse-susceptible-parasites', ['equimoxin-horse-gel-18-92'], ['horse']],
    ['pyrantel-vet-planet-horse-nematodes', ['pyrantel-vet-planet-horse-paste-350'], ['horse']],
    ['pyrantel-vet-planet-horse-anoplocephala', ['pyrantel-vet-planet-horse-paste-350'], ['horse']],
    ['panacur-paste-nematodes', ['panacur-horse-paste-187-5'], ['horse']],
    ['panacur-paste-parascaris', ['panacur-horse-paste-187-5'], ['horse']],
    ['panacur-susp-larvae-five-days', ['panacur-horse-susp-100'], ['horse']],
    ['gastazole-treatment', ['gastazole-horse-paste-370'], ['horse']],
    ['gastazole-followup', ['gastazole-horse-paste-370'], ['horse']],
    ['ventipulmin-acute', ['ventipulmin-horse-granules'], ['horse']],
    ['ventipulmin-chronic', ['ventipulmin-horse-granules'], ['horse']],
    ['equioxx-horse-osteoarthritis', ['equioxx-horse-57'], ['horse']],
    ['metacam-dog-initial', ['metacam-dog-1-5'], ['dog']],
    ['metacam-dog-maintenance', ['metacam-dog-1-5'], ['dog']],
    ['metacam-cat-acute-initial', ['metacam-cat-0-5'], ['cat']],
    ['metacam-cat-acute-maintenance', ['metacam-cat-0-5'], ['cat']],
    ['metacam-cat-chronic-initial', ['metacam-cat-0-5'], ['cat']],
    ['metacam-cat-chronic-maintenance', ['metacam-cat-0-5'], ['cat']],
    ['metacam-horse-msk', ['metacam-horse-15'], ['horse']],
    ['cardisure-preferred', ['cardisure-1.25', 'cardisure-2.5', 'cardisure-5', 'cardisure-10'], ['dog']],
    ['onsior-cat-acute', ['onsior-cat-6'], ['cat']],
    ['cerenia-vomiting-16', ['cerenia-dog-16'], ['dog']],
    ['cerenia-vomiting-24', ['cerenia-dog-24'], ['dog']],
    ['cerenia-vomiting-60', ['cerenia-dog-60'], ['dog']],
  ];
  assert.equal(REGIMENS.length, expected.length);
  assert.equal(new Set(REGIMENS.map(r => r.id)).size, REGIMENS.length);
  for (const [id, formIds, species] of expected) {
    const regimen = getRegimen(id);
    assert.deepEqual(regimen.formIds, formIds, id);
    assert.deepEqual(regimen.species, species, id);
    for (const formId of formIds) {
      const { drug, form } = forms.get(formId) ?? {};
      assert.ok(form, `${id}: ${formId}`);
      assert.ok(drug.specialties.includes('veterinary'), `${id}: veterinary catalogue`);
      assert.deepEqual(form.targetSpecies, species, `${id}: exact target species`);
      assert.notEqual(form.calculationBlocked, true, id);
      const result = evaluate(id, formId);
      assert.equal(result.source.valid, true, `${id}/${formId}: ${result.source.errors.join(' ')}`);
      assert.equal(result.arithmetic.valid, true, `${id}/${formId}: ${result.arithmetic.errors.join(' ')}`);
      assert.ok(result.arithmetic.singleUnits > 0, `${id}/${formId}`);
      assert.equal(result.arithmetic.status, 'warning', `${id}: arithmetic does not establish clinical clearance`);
    }
  }
});

test('every selectable source record has a traceable document, section, indication and phase', () => {
  const allowedHosts = new Set(['www.vmd.defra.gov.uk', 'vmd.defra.gov.uk', 'rejestrymedyczne.ezdrowie.gov.pl', 'rejestry.ezdrowie.gov.pl', 'www.zoetis.com.pl', 'assets.hpra.ie']);
  for (const regimen of REGIMENS) {
    for (const key of ['label', 'indication', 'phaseLabel', 'sourceLabel', 'sourceSection', 'screening']) {
      assert.equal(typeof regimen[key], 'string', `${regimen.id}: ${key}`);
      assert.ok(regimen[key].trim(), `${regimen.id}: ${key}`);
    }
    const url = new URL(regimen.sourceUrl);
    assert.equal(url.protocol, 'https:', regimen.id);
    assert.ok(allowedHosts.has(url.hostname), `${regimen.id}: official document host`);
    assert.match(regimen.sourceCheckedAt, /^\d{4}-\d{2}-\d{2}$/, regimen.id);
    assert.equal(new Date(regimen.sourceCheckedAt).toISOString().slice(0, 10), regimen.sourceCheckedAt, regimen.id);
    assert.ok(Array.isArray(regimen.notes) && regimen.notes.length > 0, regimen.id);
    assert.ok(regimen.notes.every(note => typeof note === 'string' && note.trim()), regimen.id);
    for (const formId of regimen.formIds) {
      const offered = availableRegimens(REGIMENS, { formId, species: regimen.species[0] });
      assert.ok(offered.some(item => item.id === regimen.id), `${regimen.id}: selectable for ${formId}`);
    }
  }
});

test('source regimens cannot transfer between species or neighbouring formulations', () => {
  const allSourceFormIds = [...new Set(REGIMENS.flatMap(r => r.formIds))];
  for (const regimen of REGIMENS) {
    const wrongSpecies = regimen.species.includes('dog') ? 'cat' : 'dog';
    const wrongForm = allSourceFormIds.find(id => !regimen.formIds.includes(id));
    for (const overrides of [{ species: wrongSpecies }, { formId: wrongForm }]) {
      const context = {
        formId: regimen.formIds[0], species: regimen.species[0],
        weight: 10, age: 2, ageUnit: 'years', days: 1, ...overrides,
      };
      assert.equal(availableRegimens(REGIMENS, context).some(r => r.id === regimen.id), false, regimen.id);
      const resolved = resolveRegimen(regimen, context);
      assert.equal(resolved.valid, false, regimen.id);
      assert.equal(resolved.dose, null, regimen.id);
    }
  }
});

test('Metacam initial phases are exactly one day and cannot become seven-day loading-dose courses', () => {
  for (const [id, formId, expectedDose] of [
    ['metacam-dog-initial', 'metacam-dog-1-5', 0.2],
    ['metacam-cat-acute-initial', 'metacam-cat-0-5', 0.2],
    ['metacam-cat-chronic-initial', 'metacam-cat-0-5', 0.1],
  ]) {
    const oneDay = evaluate(id, formId, { days: 1 });
    assert.equal(oneDay.source.fixedDays, 1, id);
    assert.equal(oneDay.source.dose, expectedDose, id);
    assert.equal(oneDay.source.frequency, 1, id);
    assert.equal(oneDay.source.valid, true, id);
    assert.equal(oneDay.arithmetic.valid, true, id);
    assert.equal(oneDay.arithmetic.totalUnits, oneDay.arithmetic.singleUnits, id);

    const sevenDays = evaluate(id, formId, { days: 7 });
    assert.equal(sevenDays.source.valid, false, id);
    assert.match(sevenDays.source.errors.join(' '), /dokładnie 1 dzień/, id);
    // Arithmetic alone knows no clinical phase: callers must require BOTH flags.
    assert.equal(sevenDays.arithmetic.valid, true, id);
    assert.equal(sevenDays.source.valid && sevenDays.arithmetic.valid, false, id);
  }
});

test('Metacam continuation remains separate from the initial dose and has no invented duration', () => {
  for (const [id, formId, expectedDose] of [
    ['metacam-dog-maintenance', 'metacam-dog-1-5', 0.1],
    ['metacam-cat-acute-maintenance', 'metacam-cat-0-5', 0.05],
    ['metacam-cat-chronic-maintenance', 'metacam-cat-0-5', 0.05],
  ]) {
    const result = evaluate(id, formId, { days: null });
    assert.equal(result.source.dose, expectedDose, id);
    assert.equal(result.source.frequency, 1, id);
    assert.equal(result.source.fixedDays, null, id);
    assert.equal(result.source.maxDays, null, id);
    assert.equal(result.source.valid, true, id);
    assert.equal(result.arithmetic.valid, false, id);
    assert.equal(result.arithmetic.totalUnits, null, id);
    assert.equal(evaluate(id, formId, { days: 7 }).arithmetic.valid, true, id);
  }
});

test('Onsior uses the literal 2.5 / 6 / 12 kg tablet table without splitting whole-only tablets', () => {
  for (const [weight, expectedUnits] of [[2.5, 1], [5.999, 1], [6, 2], [12, 2]]) {
    const result = evaluate('onsior-cat-acute', 'onsior-cat-6', { weight, age: 4, ageUnit: 'months', days: 6 });
    assert.equal(result.source.valid, true, `${weight} kg`);
    assert.equal(result.source.doseMode, 'units', `${weight} kg`);
    assert.equal(result.source.dose, expectedUnits, `${weight} kg`);
    assert.equal(result.arithmetic.valid, true, `${weight} kg`);
    assert.equal(result.arithmetic.singleUnits, expectedUnits, `${weight} kg`);
    assert.equal(result.arithmetic.singleMg, expectedUnits * 6, `${weight} kg`);
    assert.equal(result.arithmetic.totalUnits, expectedUnits * 6, `${weight} kg`);
  }
  for (const weight of [2.499, 12.001]) {
    const result = evaluate('onsior-cat-acute', 'onsior-cat-6', { weight });
    assert.equal(result.source.valid, false, `${weight} kg`);
    assert.equal(result.source.dose, null, `${weight} kg`);
    assert.equal(result.arithmetic.valid, false, `${weight} kg`);
    assert.equal(result.arithmetic.singleUnits, null, `${weight} kg`);
  }
});

test('Onsior minimum age and maximum duration are enforced separately from arithmetic', () => {
  assert.equal(evaluate('onsior-cat-acute', 'onsior-cat-6', { age: 4, ageUnit: 'months', days: 6 }).source.valid, true);
  for (const patch of [{ age: 3.99, ageUnit: 'months' }, { days: 7 }, { age: null }]) {
    const result = evaluate('onsior-cat-acute', 'onsior-cat-6', patch);
    assert.equal(result.source.valid, false, JSON.stringify(patch));
    assert.equal(result.source.valid && result.arithmetic.valid, false, JSON.stringify(patch));
  }
});

test('Cerenia tables select only their documented tablet strength and literal endpoint doses', () => {
  const cases = [
    [16, [[3, 0.5], [4, 0.5], [4.1, 1], [8, 1]]],
    [24, [[8.1, 1], [12, 1], [12.1, 2], [24, 2]]],
    [60, [[24.1, 1], [30, 1], [30.1, 2], [60, 2]]],
  ];
  for (const [strength, rows] of cases) {
    const formId = `cerenia-dog-${strength}`;
    const id = `cerenia-vomiting-${strength}`;
    assert.deepEqual(availableRegimens(REGIMENS, { formId, species: 'dog' }).map(r => r.id), [id]);
    for (const [weight, expectedUnits] of rows) {
      const result = evaluate(id, formId, { weight, age: 8, ageUnit: 'weeks', days: 1 });
      assert.equal(result.source.valid, true, `${strength} mg / ${weight} kg`);
      assert.equal(result.source.dose, expectedUnits, `${strength} mg / ${weight} kg`);
      assert.equal(result.arithmetic.valid, true, `${strength} mg / ${weight} kg`);
      assert.equal(result.arithmetic.singleUnits, expectedUnits, `${strength} mg / ${weight} kg`);
      assert.equal(result.arithmetic.singleMg, expectedUnits * strength, `${strength} mg / ${weight} kg`);
    }
  }
});

test('Cerenia table gaps and weights outside a selected strength do not round to nearby bands', () => {
  for (const [strength, weights] of [
    [16, [2.999, 4.05, 8.05, 8.1, 24]],
    [24, [8, 8.05, 12.05, 24.05, 24.1]],
    [60, [24, 24.05, 30.05, 60.001]],
  ]) {
    for (const weight of weights) {
      const result = evaluate(`cerenia-vomiting-${strength}`, `cerenia-dog-${strength}`, { weight });
      assert.equal(result.source.valid, false, `${strength} mg / ${weight} kg`);
      assert.equal(result.source.dose, null, `${strength} mg / ${weight} kg`);
      assert.equal(result.arithmetic.singleUnits, null, `${strength} mg / ${weight} kg`);
    }
  }
});

test('Cerenia uses the documented eight-week age and fourteen-day source limits', () => {
  for (const strength of [16, 24, 60]) {
    const id = `cerenia-vomiting-${strength}`, formId = `cerenia-dog-${strength}`;
    const boundary = evaluate(id, formId, { age: 8, ageUnit: 'weeks', days: 14 });
    assert.equal(boundary.source.valid, true, id);
    assert.equal(boundary.source.maxDays, 14, id);
    assert.equal(boundary.source.fixedDays, null, id);
    for (const patch of [{ age: 7.99, ageUnit: 'weeks' }, { days: 15 }]) {
      assert.equal(evaluate(id, formId, patch).source.valid, false, `${id}: ${JSON.stringify(patch)}`);
    }
  }
});

test('Cardisure preferred source dose means 0.25 mg/kg PER DOSE twice daily for every strength', () => {
  for (const [strength, expectedUnits] of [[1.25, 2], [2.5, 1], [5, 0.5], [10, 0.25]]) {
    const result = evaluate('cardisure-preferred', `cardisure-${strength}`, { weight: 10, days: 7, age: null });
    assert.equal(result.source.valid, true, `${strength} mg`);
    assert.equal(result.source.doseMode, 'perKgDose', `${strength} mg`);
    assert.equal(result.source.dose, 0.25, `${strength} mg`);
    assert.equal(result.source.frequency, 2, `${strength} mg`);
    assert.equal(result.arithmetic.valid, true, `${strength} mg`);
    assert.equal(result.arithmetic.singleMg, 2.5, `${strength} mg`);
    assert.equal(result.arithmetic.dailyMg, 5, `${strength} mg`);
    assert.equal(result.arithmetic.singleUnits, expectedUnits, `${strength} mg`);
    assert.equal(result.arithmetic.totalUnits, expectedUnits * 2 * 7, `${strength} mg`);
  }
});

test('Cardisure source eligibility cannot bypass tablet divisibility or silently round a dose', () => {
  for (const [strength, weight, expectedUnits] of [
    [1.25, 1.25, 0.25], // This strength supports halves, not quarters.
    [2.5, 1.25, 0.125],
    [5, 2.5, 0.125],
    [10, 5, 0.125],
  ]) {
    const result = evaluate('cardisure-preferred', `cardisure-${strength}`, { weight });
    assert.equal(result.source.valid, true, `${strength} mg`);
    assert.equal(result.arithmetic.valid, false, `${strength} mg`);
    assert.equal(result.arithmetic.status, 'critical', `${strength} mg`);
    assert.equal(result.arithmetic.theoreticalUnits, expectedUnits, `${strength} mg`);
    assert.equal(result.arithmetic.singleUnits, expectedUnits, `${strength} mg: no automatic rounding`);
    assert.equal(result.arithmetic.roundingDifferencePercent, 0, `${strength} mg`);
    assert.match(result.arithmetic.errors.join(' '), /podzielności produktu/, `${strength} mg`);
    assert.equal(result.source.valid && result.arithmetic.valid, false, `${strength} mg`);
  }
  const representable = evaluate('cardisure-preferred', 'cardisure-2.5', { weight: 2.5 });
  assert.equal(representable.arithmetic.valid, true);
  assert.equal(representable.arithmetic.singleUnits, 0.25);
});

test('Enrobactin remains reference-only and has no selectable or calculable source regimen', () => {
  const form = getForm('enrobactin-rodents-25');
  assert.equal(form.calculationBlocked, true);
  assert.equal(REGIMENS.some(r => r.formIds.includes(form.id)), false);
  assert.equal(REGIMENS.some(r => r.species.includes('hamster') || r.species.includes('rat')), false);
  for (const species of ['hamster', 'rat']) {
    const context = { formId: form.id, species, weight: 0.3, age: 1, ageUnit: 'years', days: 1, calculationBlocked: form.calculationBlocked };
    assert.deepEqual(availableRegimens(REGIMENS, context), [], species);
    for (const regimen of REGIMENS) {
      const source = resolveRegimen(regimen, context);
      assert.equal(source.valid, false, `${species}/${regimen.id}`);
      assert.equal(source.dose, null, `${species}/${regimen.id}`);
    }
    const arithmetic = calculate({ ...form, patientKind: 'animal', species, weight: 0.3, doseMode: 'units', dose: 1, frequency: 1, days: 1, packageSize: 10 });
    assert.equal(arithmetic.valid, false, species);
    assert.equal(arithmetic.singleUnits, null, species);
    assert.equal(arithmetic.packages, null, species);
  }
});

test('blank duration is never borrowed from source metadata or catalogue defaults for any regimen', () => {
  for (const regimen of REGIMENS) {
    for (const blankDays of [null, undefined]) {
      const result = evaluate(regimen.id, regimen.formIds[0], { days: blankDays });
      assert.equal(result.context.days, blankDays, regimen.id);
      assert.equal(result.form.defaultDays, null, regimen.id);
      assert.equal(result.source.valid, true, `${regimen.id}: source candidate is available`);
      assert.equal(Object.hasOwn(result.source, 'days'), false, regimen.id);
      assert.equal(result.source.fixedDays, regimen.fixedDays ?? null, regimen.id);
      assert.equal(result.arithmetic.valid, false, `${regimen.id}: arithmetic requires a chosen duration`);
      assert.match(result.arithmetic.errors.join(' '), /czas stosowania w dniach/, regimen.id);
      assert.equal(result.arithmetic.totalUnits, null, regimen.id);
      assert.equal(result.arithmetic.packages, null, regimen.id);
    }
  }
});

test('horse source dose converts using the 15 mg/ml preparation and stops after its source duration limit', () => {
  const result = evaluate('metacam-horse-msk', 'metacam-horse-15', { weight: 500, days: 14 });
  assert.equal(result.source.valid, true);
  assert.equal(result.source.dose, 0.6);
  assert.equal(result.source.frequency, 1);
  assert.equal(result.source.maxDays, 14);
  assert.equal(result.arithmetic.valid, true);
  assert.equal(result.arithmetic.singleMg, 300);
  assert.equal(result.arithmetic.singleUnits, 20);
  assert.equal(result.arithmetic.totalUnits, 280);
  assert.equal(result.arithmetic.packages, 3);
  assert.equal(evaluate('metacam-horse-msk', 'metacam-horse-15', { days: 15 }).source.valid, false);
});
