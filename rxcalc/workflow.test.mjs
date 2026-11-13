import test from 'node:test';
import assert from 'node:assert/strict';
import { patientFieldsFor } from './workflow.js';
import { DRUGS } from './catalogue.js';
import { REGIMENS } from './regimens.js';

const formById = id => {
  const form = DRUGS.flatMap(drug => drug.forms).find(item => item.id === id);
  assert.ok(form, `Catalogue form ${id} must exist`);
  return form;
};
const sourceById = id => {
  const source = REGIMENS.find(item => item.id === id);
  assert.ok(source, `Source regimen ${id} must exist`);
  return source;
};
const horse = { specialty: 'veterinary', species: 'horse', age: '', weight: '' };
const adult = { specialty: 'dental', patientType: 'adult', age: '', weight: '', doseMode: 'fixed' };

test('Equioxx unit dosing keeps body weight visible for its source range and manual mode', () => {
  const form = formById('equioxx-horse-57');
  const source = sourceById('equioxx-horse-osteoarthritis');
  assert.equal(source.doseMode, 'units');
  assert.ok(source.minWeight > 0 && source.maxWeight > source.minWeight);
  assert.equal(patientFieldsFor({ ...horse, form, source, doseMode: source.doseMode }).weight, true);
  assert.equal(patientFieldsFor({ ...horse, form, source: null, doseMode: 'units' }).weight, true);
});

test('a chosen Metacam source reveals the required age while empty optional age stays deferred', () => {
  const form = formById('metacam-horse-15');
  const source = sourceById('metacam-horse-msk');
  assert.equal(patientFieldsFor({ ...horse, form, source }).age, true);
  assert.deepEqual(patientFieldsFor({ ...horse, form, source: null }), {
    age: false, weight: true, foodChain: false,
  });
});

test('weight-band tablets retain both source age and weight inputs', () => {
  const form = formById('onsior-cat-6');
  const source = sourceById('onsior-cat-acute');
  assert.equal(source.doseMode, 'units');
  assert.ok(source.weightBands.length);
  assert.deepEqual(patientFieldsFor({
    specialty: 'veterinary', species: 'cat', doseMode: 'units', form, source, age: '', weight: '',
  }), { age: true, weight: true, foodChain: false });
});

test('horse exclusion inputs survive switching source regimens to manual dosing', () => {
  const cases = [
    ['butagran-equi-horse-200', 'butagran-horse-day-one'],
    ['equimoxin-horse-gel-18-92', 'equimoxin-horse-susceptible-parasites'],
    ['pyrantel-vet-planet-horse-paste-350', 'pyrantel-vet-planet-horse-nematodes'],
  ];
  for (const [formId, sourceId] of cases) {
    const form = formById(formId), source = sourceById(sourceId);
    assert.equal(patientFieldsFor({ ...horse, form, source, doseMode: source.doseMode }).foodChain, true, sourceId);
    assert.equal(patientFieldsFor({ ...horse, form, source: null, doseMode: 'units' }).foodChain, true, formId);
  }
});

test('source exclusion also reveals the field, scoped exclusively to horses', () => {
  const source = sourceById('pyrantel-vet-planet-horse-nematodes');
  assert.equal(patientFieldsFor({ ...horse, form: {}, source }).foodChain, true);
  assert.equal(patientFieldsFor({ ...horse, species: 'dog', form: {}, source }).foodChain, false);
  assert.equal(patientFieldsFor({ ...adult, species: 'horse', form: {}, source }).foodChain, false);
});

test('human product age checks and conditional mass limits remain discoverable at fixed doses', () => {
  const ibuprofen = formById('ibuprom-200');
  assert.equal(patientFieldsFor({ ...adult, form: ibuprofen }).age, true);
  const paracetamol = formById('metafen-paracetamol-500');
  for (const doseMode of ['fixed', 'units']) {
    assert.deepEqual(patientFieldsFor({ ...adult, form: paracetamol, doseMode }), {
      age: true, weight: true, foodChain: false,
    });
  }
});

test('per-kilogram dosing reveals human weight and pediatric context keeps age and weight visible', () => {
  const form = formById('augmentin-400-57');
  assert.equal(patientFieldsFor({ ...adult, form, doseMode: 'perKgDay' }).weight, true);
  assert.equal(patientFieldsFor({ ...adult, form, doseMode: 'perKgDose' }).weight, true);
  assert.deepEqual(patientFieldsFor({ ...adult, form, patientType: 'child' }), {
    age: true, weight: true, foodChain: false,
  });
});

test('previously entered invalid and zero values keep an editable field after context changes', () => {
  const form = formById('eliquis-5');
  for (const value of ['niepoprawne', '-1', ' ', '0', 0, NaN]) {
    assert.equal(patientFieldsFor({ ...adult, specialty: 'cardio', form, age: value }).age, true);
    assert.equal(patientFieldsFor({ ...adult, specialty: 'cardio', form, weight: value }).weight, true);
  }
  assert.equal(patientFieldsFor({ ...horse, age: '-1', form: formById('metacam-horse-15'), source: null }).age, true);
});

test('cardiology alone introduces no renal-dose requirement or unrelated patient inputs', () => {
  const result = patientFieldsFor({ ...adult, specialty: 'cardio', form: formById('eliquis-5') });
  assert.deepEqual(result, { age: false, weight: false, foodChain: false });
  assert.deepEqual(Object.keys(result).sort(), ['age', 'foodChain', 'weight']);
});
