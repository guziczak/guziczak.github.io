import test from 'node:test';
import assert from 'node:assert/strict';
import { availableDrugs } from './catalogue-selection.js';
import { DRUGS } from './catalogue.js';
import { calculate } from './engine.js';

const fixtures = [
  { id: 'human-dental', specialties: ['dental'], forms: [{ id: 'human-tablet' }] },
  { id: 'human-cardio', specialties: ['cardio'], forms: [{ id: 'human-cardio-tablet' }] },
  { id: 'vet-family', specialties: ['veterinary'], forms: [
    { id: 'dog-strength', targetSpecies: ['dog'] },
    { id: 'cat-strength', targetSpecies: ['cat'] },
    { id: 'shared-strength', targetSpecies: ['dog', 'cat'] },
    { id: 'horse-strength', targetSpecies: ['horse'] },
    { id: 'unspecified-species' },
  ] },
  { id: 'rodent-reference', specialties: ['veterinary'], forms: [
    { id: 'rat-concentrate', targetSpecies: ['rat'], calculationBlocked: true },
  ] },
  { id: 'mixed-metadata', specialties: ['dental', 'veterinary'], forms: [
    { id: 'human-form' },
    { id: 'animal-form', targetSpecies: ['dog'] },
    { id: 'malformed-species', targetSpecies: null },
  ] },
];

test('route filtering keeps only explicit species-matched formulations without reusing another route', () => {
  const horse = availableDrugs(DRUGS, 'veterinary', 'horse');
  const iv = availableDrugs(DRUGS, 'veterinary', 'horse', 'iv');
  const oral = availableDrugs(DRUGS, 'veterinary', 'horse', 'oral');
  assert.deepEqual(iv.map(d => d.id), ['vet-flunivis']);
  assert.equal(iv[0].forms[0].routeLabel, 'dożylnie');
  assert.equal(oral.length + iv.length, horse.length);
  assert.ok(oral.every(d => d.forms.every(f => f.routeCode === 'oral' && f.targetSpecies.includes('horse'))));
  assert.deepEqual(availableDrugs(DRUGS, 'veterinary', 'dog', 'iv'), []);
  for (const route of ['im', 'sc', 'unknown', '', null]) assert.deepEqual(availableDrugs(DRUGS, 'veterinary', 'horse', route), []);
  assert.ok(horse.some(d => d.id === 'vet-flunivis'), 'Filtering leaves the full source catalogue available');
});

test('species selection filters formulations, including strengths under one product', () => {
  const dog = availableDrugs(fixtures, 'veterinary', 'dog');
  assert.deepEqual(dog.map(d => d.id), ['vet-family', 'mixed-metadata']);
  assert.deepEqual(dog[0].forms.map(f => f.id), ['dog-strength', 'shared-strength']);
  assert.deepEqual(dog[1].forms.map(f => f.id), ['animal-form']);
  const cat = availableDrugs(fixtures, 'veterinary', 'cat');
  assert.deepEqual(cat.map(d => d.id), ['vet-family']);
  assert.deepEqual(cat[0].forms.map(f => f.id), ['cat-strength', 'shared-strength']);
  assert.deepEqual(availableDrugs(fixtures, 'veterinary', 'horse')[0].forms.map(f => f.id), ['horse-strength']);
});

test('missing and unknown species never expose an unfiltered veterinary catalogue', () => {
  for (const species of [undefined, null, '', 'rabbit', 'Dog', ['dog'], {}]) {
    assert.deepEqual(availableDrugs(fixtures, 'veterinary', species), []);
  }
  assert.deepEqual(availableDrugs(fixtures, 'veterinary', 'hamster'), []);
});

test('species-compatible reference-only entries retain their calculation block', () => {
  const rat = availableDrugs(fixtures, 'veterinary', 'rat');
  assert.deepEqual(rat.map(d => d.id), ['rodent-reference']);
  assert.equal(rat[0].forms[0].calculationBlocked, true);
  assert.equal(availableDrugs(fixtures, 'veterinary', 'dog').some(d => d.id === 'rodent-reference'), false);
});

test('human specialty filters exclude veterinary-only entries and animal-labelled forms', () => {
  const dental = availableDrugs(fixtures, 'dental', 'dog');
  assert.deepEqual(dental.map(d => d.id), ['human-dental', 'mixed-metadata']);
  assert.deepEqual(dental.flatMap(d => d.forms.map(f => f.id)), ['human-tablet', 'human-form']);
  assert.deepEqual(availableDrugs(fixtures, 'cardio').map(d => d.id), ['human-cardio']);
  assert.equal(availableDrugs(fixtures, 'veterinary', 'dog').some(d => d.id.startsWith('human-')), false);
});

test('filtering frozen metadata does not mutate it and returns fresh entry/form objects', () => {
  const source = structuredClone(fixtures);
  const freeze = value => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  freeze(source);
  const before = JSON.stringify(source);
  const selected = availableDrugs(source, 'veterinary', 'dog');
  assert.equal(JSON.stringify(source), before);
  assert.notEqual(selected[0], source[2]);
  assert.notEqual(selected[0].forms, source[2].forms);
  assert.notEqual(selected[0].forms[0], source[2].forms[0]);
  selected[0].forms[0].id = 'temporary-ui-label';
  assert.equal(source[2].forms[0].id, 'dog-strength');
  assert.equal(availableDrugs(source, 'veterinary', 'cat')[0].forms[0].id, 'cat-strength');
});

test('entries without eligible forms are omitted rather than falling back to a first form', () => {
  const malformed = [null, {}, { specialties: ['veterinary'] },
    { id: 'empty', specialties: ['veterinary'], forms: [] },
    { id: 'bad-form', specialties: ['veterinary'], forms: [null, {}, { targetSpecies: 'dog' }] },
    { id: 'human-only', specialties: ['dental'], forms: [{ targetSpecies: ['dog'] }] },
  ];
  assert.deepEqual(availableDrugs(malformed, 'veterinary', 'dog'), []);
  assert.deepEqual(availableDrugs(null, 'veterinary', 'dog'), []);
  assert.deepEqual(availableDrugs(fixtures, ''), []);
});

test('catalogued Metacam strengths remain attached to their exact target species', () => {
  for (const [species, formId, concentration] of [
    ['dog', 'metacam-dog-1-5', 1.5],
    ['cat', 'metacam-cat-0-5', 0.5],
    ['horse', 'metacam-horse-15', 15],
  ]) {
    const product = availableDrugs(DRUGS, 'veterinary', species).find(d => d.id === 'vet-metacam');
    assert.ok(product, species);
    assert.deepEqual(product.forms.map(f => f.id), [formId], species);
    assert.equal(product.forms[0].concentrationMg, concentration, species);
    assert.equal(product.forms[0].concentrationMl, 1, species);
  }
  for (const species of ['hamster', 'rat']) {
    assert.equal(availableDrugs(DRUGS, 'veterinary', species).some(d => d.id === 'vet-metacam'), false, species);
  }
});

test('catalogued Enrobactin stock concentration is reference-only in both dose and unit modes', () => {
  for (const species of ['hamster', 'rat']) {
    const form = availableDrugs(DRUGS, 'veterinary', species).find(d => d.id === 'vet-enrobactin')?.forms[0];
    assert.ok(form, species);
    assert.equal(form.referenceConcentrationMg, 25);
    assert.equal(form.referenceConcentrationMl, 1);
    assert.equal(form.concentrationMg, null);
    assert.equal(form.concentrationMl, null);
    assert.equal(form.calculationBlocked, true);
    for (const doseMode of ['perKgDose', 'units']) {
      const result = calculate({
        ...form, patientKind: 'animal', species, weight: 0.3,
        doseMode, dose: 1, frequency: 1, days: 1, packageSize: form.packOptions[0].quantity,
      });
      assert.equal(result.valid, false, `${species}: ${doseMode}`);
      assert.equal(result.singleUnits, null);
      assert.equal(result.packages, null);
      assert.match(result.errors.join(' '), /wymaga przygotowania/);
    }
  }
});

test('no veterinary catalogue formulation supplies an automatic clinical regimen', () => {
  const forms = DRUGS.filter(d => d.specialties.includes('veterinary')).flatMap(d => d.forms);
  assert.ok(forms.length > 0);
  for (const form of forms) {
    for (const key of ['defaultDose', 'defaultFrequency', 'defaultDays']) {
      assert.equal(form[key], null, `${form.id}: ${key}`);
    }
  }
});

test('Cardisure 1.25 mg allows halves while the other catalogued strengths allow quarters', () => {
  const product = availableDrugs(DRUGS, 'veterinary', 'dog').find(d => d.id === 'vet-cardisure');
  assert.ok(product);
  for (const form of product.forms) {
    const lowStrength = form.strengthMg === 1.25;
    assert.deepEqual(form.allowedFractions, lowStrength ? [1, 0.5] : [1, 0.25, 0.5, 0.75], form.id);
    const input = {
      ...form, patientKind: 'animal', species: 'dog', weight: 10,
      doseMode: 'units', dose: 0.25, frequency: 1, days: 1,
      packageSize: form.packOptions[0].quantity,
    };
    assert.equal(calculate(input).valid, !lowStrength, form.id);
    assert.equal(calculate({...input, dose: 0.5}).valid, true, form.id);
  }
});

test('Cerenia conversion uses 16 mg of maropitant rather than the citrate salt mass', () => {
  const form = availableDrugs(DRUGS, 'veterinary', 'dog').find(d => d.id === 'vet-cerenia')?.forms[0];
  assert.ok(form);
  assert.equal(form.strengthMg, 16);
  assert.notEqual(form.strengthMg, 23.18);
  const result = calculate({
    ...form, patientKind: 'animal', species: 'dog', weight: 10,
    doseMode: 'fixed', dose: 8, frequency: 1, days: 1,
    packageSize: form.packOptions[0].quantity,
  });
  assert.equal(result.valid, true);
  assert.equal(result.singleUnits, 0.5);
  assert.equal(result.singleMg, 8);
  assert.equal(availableDrugs(DRUGS, 'veterinary', 'cat').some(d => d.id === 'vet-cerenia'), false);
});
