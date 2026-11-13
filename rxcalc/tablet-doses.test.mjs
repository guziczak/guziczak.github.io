import test from 'node:test';
import assert from 'node:assert/strict';
import { tabletDoseChoices } from './tablet-doses.js';

const tablet = { form: 'tablet', strengthMg: 500, allowedFractions: [0.5, 1] };
const q8 = { doseMode: 'fixed', doseRange: { min: 250, max: 500 }, frequency: 3, maxSingleMg: 500, maxDailyMg: 1500 };
const q12 = { doseMode: 'fixed', doseRange: { min: 750, max: 1000 }, frequency: 2, maxSingleMg: 1000, maxDailyMg: 2000 };
const allowed = choices => choices.filter(choice => choice.allowed).map(choice => choice.tablets);

test('500 mg tablets offer two, one and half in that order within the selected q8 range', () => {
  assert.deepEqual(tabletDoseChoices(tablet, { source: q8 }), [
    { tablets: 2, value: 1000, mg: 1000, allowed: false, reason: 'Poza zakresem schematu' },
    { tablets: 1, value: 500, mg: 500, allowed: true, reason: '' },
    { tablets: 0.5, value: 250, mg: 250, allowed: true, reason: '' },
  ]);
});

test('a different source range changes which physical amounts are selectable', () => {
  assert.deepEqual(allowed(tabletDoseChoices(tablet, { source: q12 })), [2]);
  assert.deepEqual(allowed(tabletDoseChoices({ ...tablet, strengthMg: 1000 }, { source: q8 })), [0.5]);
});

test('half-tablet use requires explicit numeric permission for the exact formulation', () => {
  for (const allowedFractions of [undefined, null, [], [1], [0.25, 1], ['0.5', 1]]) {
    const choices = tabletDoseChoices({ ...tablet, allowedFractions });
    assert.deepEqual(allowed(choices), [2, 1]);
    assert.equal(choices[2].reason, 'Brak podziału na połowy');
  }
});

test('weight doses, instructions and source-locked amounts do not expose editable tablet shortcuts', () => {
  for (const doseMode of ['perKgDay', 'perKgDose', 'instruction', 'unknown']) {
    assert.deepEqual(tabletDoseChoices(tablet, { doseMode }), []);
  }
  for (const source of [
    { doseMode: 'fixed', dose: 500 },
    { doseMode: 'fixed', dose: 500, doseRange: { min: 250, max: 1000 } },
    { doseMode: 'perKgDose', doseRange: { min: 1, max: 2 } },
    { doseMode: 'units', doseRange: { min: 1, max: 2 } },
    {},
    { doseMode: 'fixed', doseRange: { min: 500, max: 250 } },
    { doseMode: 'fixed', doseRange: { min: 250, max: Infinity } },
  ]) assert.deepEqual(tabletDoseChoices(tablet, { source }), []);
});

test('reference-only forms, non-tablets and missing or invalid strengths cannot create amounts', () => {
  for (const form of [null, undefined, {}, { ...tablet, referenceOnly: true }, { ...tablet, calculationBlocked: true },
    ...['suspension', 'gel', 'spray', 'capsule'].map(form => ({ ...tablet, form })),
    ...[null, undefined, 0, -500, NaN, Infinity, '500'].map(strengthMg => ({ ...tablet, strengthMg })),
  ]) assert.deepEqual(tabletDoseChoices(form), []);
});

test('units mode keeps tablet counts while showing the exact strength rather than trade-name digits', () => {
  const choices = tabletDoseChoices({ ...tablet, label: 'Betaloc ZOK 25', strengthMg: 23.75 }, { doseMode: 'units' });
  assert.deepEqual(choices.map(({ tablets, value, mg }) => ({ tablets, value, mg })), [
    { tablets: 2, value: 2, mg: 47.5 },
    { tablets: 1, value: 1, mg: 23.75 },
    { tablets: 0.5, value: 0.5, mg: 11.875 },
  ]);
});

test('form, source and caller limits can independently narrow a source range', () => {
  const source = { doseMode: 'fixed', doseRange: { min: 250, max: 1000 } };
  for (const options of [
    { source, maxSingleMg: 400 },
    { source: { ...source, maxSingleMg: 400 } },
  ]) assert.deepEqual(allowed(tabletDoseChoices(tablet, options)), [0.5]);
  assert.deepEqual(allowed(tabletDoseChoices({ ...tablet, maxSingleMg: 400 }, { source })), [0.5]);
  for (const options of [
    { source, frequency: 3, maxDailyMg: 1200 },
    { source: { ...source, frequency: 3, maxDailyMg: 1200 } },
  ]) assert.deepEqual(allowed(tabletDoseChoices(tablet, options)), [0.5]);
  assert.deepEqual(allowed(tabletDoseChoices({ ...tablet, maxDailyMg: 1200 }, { source, frequency: 3 })), [0.5]);
  assert.equal(tabletDoseChoices(tablet, { source, frequency: 3, maxDailyMg: 1200 })[1].reason, 'Ponad limit dobowy');
});

test('changing frequency re-evaluates daily limits without inventing a missing frequency', () => {
  assert.deepEqual(allowed(tabletDoseChoices(tablet, { maxDailyMg: 1500, frequency: 3 })), [1, 0.5]);
  assert.deepEqual(allowed(tabletDoseChoices(tablet, { maxDailyMg: 1500, frequency: 1 })), [2, 1, 0.5]);
  assert.deepEqual(allowed(tabletDoseChoices(tablet, { maxDailyMg: 1500 })), [2, 1, 0.5]);
});

test('unit-mode source ranges and unit ceilings apply to physical tablet counts', () => {
  const source = { doseMode: 'units', doseRange: { min: 0.5, max: 2 }, maxUnitsPerDose: 1, maxDailyUnits: 2 };
  assert.deepEqual(allowed(tabletDoseChoices(tablet, { doseMode: 'units', source, frequency: 3 })), [0.5]);
  const choices = tabletDoseChoices(tablet, { doseMode: 'units', source, frequency: 3 });
  assert.equal(choices[0].reason, 'Ponad limit jednorazowy');
  assert.equal(choices[1].reason, 'Ponad limit dobowy');
});

test('limits at decimal boundaries tolerate arithmetic noise but reject actual excess', () => {
  const form = { ...tablet, strengthMg: 0.1 };
  assert.deepEqual(allowed(tabletDoseChoices(form, { frequency: 3, maxDailyMg: 0.3 })), [1, 0.5]);
  assert.deepEqual(allowed(tabletDoseChoices(form, { frequency: 3, maxDailyMg: 0.299 })), [0.5]);
  const overflow = tabletDoseChoices({ ...tablet, strengthMg: 1e308 }, { frequency: 3, maxDailyMg: 1.7e308 });
  assert.equal(overflow[0].allowed, false);
  assert.equal(overflow[1].reason, 'Ponad limit dobowy');
});

test('explicit invalid limit metadata cannot enable a shortcut', () => {
  for (const maxDailyMg of [0, -1, Infinity, NaN, '1000']) {
    const choices = tabletDoseChoices(tablet, { maxDailyMg, frequency: 3 });
    assert.deepEqual(allowed(choices), []);
    assert.equal(choices[1].reason, 'Nieprawidłowy limit dawki');
  }
});

test('frozen formulation and regimen inputs remain unchanged and outputs are independent', () => {
  const form = Object.freeze({ ...tablet, allowedFractions: Object.freeze([0.5, 1]) });
  const source = Object.freeze({ ...q8, doseRange: Object.freeze({ ...q8.doseRange }) });
  const options = Object.freeze({ source, frequency: 3 });
  const before = JSON.stringify({ form, options });
  const first = tabletDoseChoices(form, options);
  first[1].allowed = false;
  assert.equal(tabletDoseChoices(form, options)[1].allowed, true);
  assert.equal(JSON.stringify({ form, options }), before);
});
