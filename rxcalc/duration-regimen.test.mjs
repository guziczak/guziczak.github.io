import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { REGIMENS } from './regimens.js';
import { LIQUID_STARTER_REGIMENS } from './liquid-starters.js';
import { assessDurationRegimen, durationDosePreview } from './duration-regimen.js';

const records = [...HUMAN_REGIMENS, ...REGIMENS, ...LIQUID_STARTER_REGIMENS];
const forms = DRUGS.flatMap(drug => drug.forms);
function options(id, changes = {}) {
  const source = structuredClone(records.find(record => record.id === id));
  const form = structuredClone(forms.find(item => item.id === source.formIds[0]));
  const veterinary = !!source.species;
  const child = source.patientTypes?.length === 1 && source.patientTypes[0] === 'child';
  const context = {
    specialty: veterinary ? 'veterinary' : 'dental',
    formId: form.id, patientType: child ? 'child' : 'adult',
    species: source.species?.[0], age: child || veterinary ? 5 : 35, ageUnit: 'years',
    weight: veterinary ? source.species[0] === 'horse' ? 500 : source.species[0] === 'cat' ? 4 : 12 : child ? 20 : 70,
    renalStatus: 'unknown', crcl: null, foodChainStatus: 'excluded',
    doseMode: source.doseMode, dose: source.dose ?? source.doseRange?.min ?? source.weightBands?.[0]?.units ?? null,
    frequency: source.frequency ?? source.frequencyOptions?.[0] ?? null,
    days: source.fixedDays ?? 5, roundingStep: null, manualMax: null,
    ...changes,
  };
  return { source, form, context, rule: { origin: 'source' } };
}
const augmentin = (changes = {}) => options('dental-augmentin-400-57-child', { dose: 35, ...changes });
const ucsf = (changes = {}) => ({ ...augmentin(changes), reference: { comparisonSingleMg: 450, comparisonFrequency: 2 } });

test('35 mg/kg/day does not inherit green from the UCSF duration range', () => {
  for (const days of [3, 5, 7]) {
    const assessment = assessDurationRegimen(ucsf({ days }));
    assert.equal(assessment.state, 'mismatch');
    assert.match(assessment.reasons.join(' '), /dawka.*UCSF/i);
  }
});

test('numeric UCSF agreement has a distinct reference match without a permanent warning', () => {
  for (const [doseMode, dose] of [['perKgDay', 45], ['perKgDose', 22.5], ['fixed', 450], ['units', 5.625]]) {
    const assessment = assessDurationRegimen(ucsf({ doseMode, dose }));
    assert.equal(assessment.state, 'reference-matched', doseMode);
    assert.deepEqual(assessment.reasons, []);
    assert.notEqual(assessment.state, 'matched', 'Numerical reference agreement is separate from a primary-source match');
  }
});

test('a UCSF reference match still requires complete actual inputs and reference targets', () => {
  for (const patch of [{ dose: null }, { frequency: null }])
    assert.equal(assessDurationRegimen(ucsf({ dose: 45, ...patch })).state, 'incomplete');
  assert.equal(assessDurationRegimen(ucsf({ dose: 45, frequency: 1 })).state, 'mismatch');
  for (const key of ['comparisonSingleMg', 'comparisonFrequency']) {
    const scenario = ucsf({ dose: 45 });
    scenario.reference[key] = null;
    const assessment = assessDurationRegimen(scenario);
    assert.equal(assessment.state, 'review', key);
    assert.match(assessment.reasons.join(' '), /Brak pełnych zweryfikowanych danych/);
  }
});

test('source range accepts both dose endpoints without inventing a lower-bound warning', () => {
  for (const dose of [25, 35, 45]) assert.equal(assessDurationRegimen(augmentin({ dose })).state, 'matched');
  for (const dose of [24.999, 45.001]) assert.equal(assessDurationRegimen(augmentin({ dose })).state, 'mismatch');
});

test('equivalent entered units are converted before strict source comparison', () => {
  for (const [doseMode, dose] of [['fixed', 350], ['perKgDose', 17.5], ['perKgDay', 35], ['units', 4.375]])
    assert.equal(assessDurationRegimen(augmentin({ doseMode, dose })).state, 'matched', doseMode);
  assert.equal(assessDurationRegimen(augmentin({ doseMode: 'units', dose: 7 })).state, 'mismatch');
});

test('changing frequency is not repaired by the same daily mg total', () => {
  const assessment = assessDurationRegimen(augmentin({ dose: 35, frequency: 1 }));
  assert.equal(assessment.state, 'mismatch');
  assert.match(assessment.reasons.join(' '), /podań|często/i);
});

test('missing dose, frequency and unit remain incomplete rather than using source defaults', () => {
  for (const key of ['dose', 'frequency', 'doseMode']) {
    for (const value of [null, undefined, '']) {
      assert.equal(assessDurationRegimen(augmentin({ [key]: value })).state, 'incomplete', key);
    }
  }
  for (const patch of [{ dose: NaN }, { dose: 0 }, { frequency: 1.5 }, { doseMode: 'unknown' }])
    assert.equal(assessDurationRegimen(augmentin(patch)).state, 'mismatch');
});

test('assessment is pure and never replaces, chooses or validates the selected number of days', () => {
  const original = ucsf({ dose: 45, days: null });
  const snapshot = structuredClone(original);
  const expected = assessDurationRegimen(original);
  assert.deepEqual(original, snapshot);
  for (const days of ['', null, 0, 1, 3, 7, 15, 'invalid', NaN]) {
    const candidate = { ...original, context: { ...original.context, days } };
    assert.deepEqual(assessDurationRegimen(candidate), expected);
    assert.ok(Object.is(candidate.context.days, days));
  }
  const frozen = augmentin();
  Object.freeze(frozen.context); Object.freeze(frozen.source); Object.freeze(frozen.form);
  assert.equal(assessDurationRegimen(frozen).state, 'matched');
});

test('actual rounded dose, not the unrounded input, is compared with UCSF', () => {
  assert.equal(assessDurationRegimen(ucsf({ dose: 45, roundingStep: 0.1 })).state, 'mismatch');
  const exact = assessDurationRegimen(ucsf({ dose: 45, roundingStep: 0.125 }));
  assert.equal(exact.state, 'reference-matched');
  assert.deepEqual(exact.reasons, []);
  // A rounded dose may still be within the original dose range; no new
  // percentage tolerance or automatic clinical acceptance is introduced.
  assert.equal(assessDurationRegimen(augmentin({ dose: 45, roundingStep: 0.1 })).state, 'matched');
});

test('the shared dose preview exposes the same rounded amount as the assessment', () => {
  const scenario = ucsf({ dose: 45, roundingStep: 0.1, days: 7 });
  const preview = durationDosePreview(scenario);
  assert.equal(preview.valid, true);
  assert.equal(preview.singleUnits, 5.6);
  assert.equal(preview.singleMg, 448);
  assert.equal(preview.dailyMg, 896);
  assert.equal(preview.totalUnits, 11.2);
  assert.equal(scenario.context.days, 7);
  assert.equal(durationDosePreview({}), null);
});

test('rounding above a source range endpoint or to a zero amount cannot match', () => {
  assert.equal(assessDurationRegimen(augmentin({ dose: 45, roundingStep: 0.25 })).state, 'mismatch');
  assert.equal(assessDurationRegimen(augmentin({ dose: 25, roundingStep: 10 })).state, 'mismatch');
});

test('the UCSF per-dose cap is compared against the actual amount', () => {
  const scenario = ucsf({ weight: 39, dose: 45 });
  scenario.reference.comparisonSingleMg = 875;
  assert.equal(assessDurationRegimen(scenario).state, 'mismatch');
  scenario.context.dose = 875 * 2 / 39;
  assert.equal(assessDurationRegimen(scenario).state, 'reference-matched');
  assert.deepEqual(assessDurationRegimen(scenario).reasons, []);
});

test('SDCEP cannot acquire complete-regimen agreement from a ChPL dose match', () => {
  const scenario = options('dental-ospamox-suspension-ge40-q8', { dose: 500 });
  scenario.rule.origin = 'external';
  assert.equal(assessDurationRegimen(scenario).state, 'review');
  assert.match(assessDurationRegimen(scenario).reasons.join(' '), /Zakres SDCEP.*dawkowania i warunków/);
  scenario.context.dose = 600;
  assert.equal(assessDurationRegimen(scenario).state, 'mismatch');
});

test('a genuine three-day source stage remains matchable and cannot reuse the initial dose', () => {
  const scenario = options('butagran-horse-days-two-four');
  assert.equal(scenario.source.fixedDays, 3);
  assert.equal(assessDurationRegimen(scenario).state, 'matched');
  scenario.context.dose = 4.4;
  assert.equal(assessDurationRegimen(scenario).state, 'mismatch');
  scenario.context.dose = 2.2; scenario.context.frequency = 1;
  assert.equal(assessDurationRegimen(scenario).state, 'mismatch');
});

test('both ends of a source duration range retain the same valid dosing assessment', () => {
  const scenario = options('ventipulmin-acute');
  for (const days of [10, 14]) assert.equal(assessDurationRegimen({
    ...scenario, context: { ...scenario.context, days },
  }).state, 'matched');
});

test('veterinary table doses are compared with the row for the actual weight', () => {
  const scenario = options('onsior-cat-acute');
  assert.equal(assessDurationRegimen(scenario).state, 'matched');
  scenario.context.weight = 7;
  assert.equal(assessDurationRegimen(scenario).state, 'mismatch');
  scenario.context.dose = 2;
  assert.equal(assessDurationRegimen(scenario).state, 'matched');
});

test('independent measuring divisions and cross-stage dose differences prevent agreement', () => {
  const scenario = options('gastazole-followup');
  // At 500 kg the continuation amount is not a full applicator division.
  assert.equal(assessDurationRegimen(scenario).state, 'mismatch');
  assert.match(assessDurationRegimen(scenario).reasons.join(' '), /podziałk/);
  scenario.context.weight = 400;
  assert.equal(assessDurationRegimen(scenario).state, 'matched');
  scenario.context.dose = 4;
  assert.equal(assessDurationRegimen(scenario).state, 'mismatch');
});

test('canonical tablet divisibility is still checked after unit conversion', () => {
  const scenario = options('dental-ospamox-tablet-ge40-q8', { dose: 250 });
  scenario.form = structuredClone(forms.find(form => form.id === 'ospamox-tablet-1000'));
  scenario.context.formId = scenario.form.id;
  assert.equal(assessDurationRegimen(scenario).state, 'mismatch');
  assert.match(assessDurationRegimen(scenario).reasons.join(' '), /podzielności/);
  scenario.context.dose = 500;
  assert.equal(assessDurationRegimen(scenario).state, 'matched');
});

test('a manual ceiling can tighten a product limit but cannot relax it', () => {
  assert.equal(assessDurationRegimen(augmentin({ manualMax: 600 })).state, 'mismatch');
  assert.equal(assessDurationRegimen(augmentin({ manualMax: 700 })).state, 'matched');
  const scenario = augmentin({ manualMax: 10000 });
  scenario.form.maxDailyMg = 600;
  assert.equal(assessDurationRegimen(scenario).state, 'mismatch');
  scenario.form.maxDailyMg = null; scenario.form.maxSingleMg = 300;
  assert.equal(assessDurationRegimen(scenario).state, 'mismatch');
  for (const manualMax of [0, -1, NaN, Infinity])
    assert.equal(assessDurationRegimen(augmentin({ manualMax })).state, 'mismatch');
});

test('product age and conditional limits are independent of source dose agreement', () => {
  const scenario = augmentin({ age: 60, ageUnit: 'months' });
  scenario.form.minAge = 6;
  assert.equal(assessDurationRegimen(scenario).state, 'mismatch');
  scenario.form.minAge = 4;
  assert.equal(assessDurationRegimen(scenario).state, 'matched');
  scenario.form.conditionalLimits = [{ minAge: 5, maxDailyMg: 600 }];
  assert.equal(assessDurationRegimen(scenario).state, 'mismatch');
  scenario.form.conditionalLimits = [{ minAgeExclusive: 5, maxDailyMg: 600 }];
  assert.equal(assessDurationRegimen(scenario).state, 'matched');
});

test('instruction sources do not require an invented numeric dose but keep frequency checks', () => {
  const scenario = options('metronidazole-periodontal', { dose: null, doseMode: null });
  assert.equal(assessDurationRegimen(scenario).state, 'matched');
  scenario.context.frequency = null;
  assert.equal(assessDurationRegimen(scenario).state, 'incomplete');
  scenario.context.frequency = 3;
  assert.equal(assessDurationRegimen(scenario).state, 'mismatch');
});

test('instruction mode does not bypass independent product age or mg limits', () => {
  const scenario = options('metronidazole-periodontal', { dose: null, doseMode: null });
  scenario.form.minAge = 40;
  assert.equal(assessDurationRegimen(scenario).state, 'mismatch');
  scenario.form.minAge = 18; scenario.context.manualMax = 100;
  assert.equal(assessDurationRegimen(scenario).state, 'review');
  scenario.context.manualMax = null; scenario.form.maxSingleMg = 20;
  assert.equal(assessDurationRegimen(scenario).state, 'review');
});

test('missing data, custom mode and inapplicable formulation never report a match', () => {
  assert.equal(assessDurationRegimen({}).state, 'incomplete');
  assert.equal(assessDurationRegimen(augmentin({ custom: true })).state, 'review');
  assert.equal(assessDurationRegimen(augmentin({ weight: null })).state, 'incomplete');
  assert.equal(assessDurationRegimen(augmentin({ formId: 'other' })).state, 'mismatch');
  assert.equal(assessDurationRegimen(augmentin({ specialty: 'veterinary' })).state, 'mismatch');
  assert.equal(assessDurationRegimen(augmentin({ renalStatus: 'impaired' })).state, 'mismatch');
});

test('only floating-point noise is accepted for a fixed source dose', () => {
  const scenario = options('metacam-dog-initial');
  scenario.context.dose = 0.2 + Number.EPSILON;
  assert.equal(assessDurationRegimen(scenario).state, 'matched');
  scenario.context.dose = 0.200001;
  assert.equal(assessDurationRegimen(scenario).state, 'mismatch');
});
