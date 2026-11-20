import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { REGIMENS } from './regimens.js';
import { availableHumanRegimens, resolveHumanRegimen } from './human-regimen-engine.js';
import { availableRegimens, resolveRegimen } from './regimen-engine.js';
import { assessAnticoagulantEligibility } from './cardio-anticoagulant-regimens.js';
import { calculate } from './engine.js';
import { FENTANYL_SINGLE_DOSE_SOURCES } from './cardio-fentanyl.js';
import { availableSingleDoseSources, resolveSingleDose } from './single-dose.js';

const entries = DRUGS.flatMap(drug => drug.forms.map(form => ({ drug, form })));
const byForm = new Map(entries.map(entry => [entry.form.id, entry]));
const blocked = form => form.referenceOnly === true || form.calculationBlocked === true;
const active = entries.filter(({ form }) => !blocked(form));
const allRecords = [...HUMAN_REGIMENS, ...REGIMENS, ...FENTANYL_SINGLE_DOSE_SOURCES];

// Deliberate example contexts establish usable coverage, not a treatment choice.
// Every offered record is still selected explicitly and resolved separately.
const humanCases = {
  'augmentin-400-57': { patientType: 'child', age: 8, weight: 25 },
  'dentinox-n-gel': { patientType: 'child', age: 1, weight: 10 },
  'eliquis-2.5': { age: 82, weight: 55, serumCreatinine: 1.6, crcl: 60 },
  'xarelto-15': { crcl: 40, renalStatus: 'impaired' },
};
const animalWeights = {
  'cerenia-dog-16': 5, 'cerenia-dog-24': 10, 'cerenia-dog-60': 30,
  'cardisure-1.25': 5, 'cardisure-2.5': 10, 'cardisure-5': 20, 'cardisure-10': 40,
};
function humanContext(form, specialty) {
  return { formId: form.id, specialty, patientType: 'adult', age: 55, ageUnit: 'years',
    weight: 70, crcl: 80, serumCreatinine: 1, renalStatus: 'unknown',
    ...humanCases[form.id] };
}
function animalContext(form, species) {
  return { formId: form.id, species, weight: animalWeights[form.id] ?? { dog: 30, cat: 4, horse: 500 }[species],
    age: species === 'horse' ? 8 : 5, ageUnit: 'years', foodChainStatus: species === 'horse' ? 'excluded' : 'unknown' };
}
function selectedHumanContext(record, context) {
  return { ...context, dose: record.dose ?? record.doseRange?.min ?? null,
    frequency: record.frequency ?? record.frequencyOptions?.[0] ?? null,
    days: record.fixedDays ?? record.minDays ?? 1,
    sourceConfirmations: (record.selectionRequirements || []).map(item => item.id) };
}

test('the current catalogue has 57 active formulations across all three specialties and four explicit exceptions', () => {
  assert.equal(entries.length, 61);
  assert.equal(active.length, 57);
  assert.deepEqual(Object.fromEntries(['dental', 'cardio', 'veterinary'].map(specialty => [specialty,
    active.filter(({ drug }) => drug.specialties.includes(specialty)).length])),
  { dental: 19, cardio: 16, veterinary: 22 });
  assert.equal(new Set(DRUGS.map(drug => drug.id)).size, DRUGS.length);
  assert.equal(new Set(entries.map(({ form }) => form.id)).size, entries.length);
  assert.equal(new Set(allRecords.map(record => record.id)).size, allRecords.length);
});

test('every active formulation has an available source that resolves for an explicit patient group or target species', () => {
  const failures = [];
  for (const { drug, form } of active) {
    let usable = false;
    const diagnostics = [];
    if (form.calculationMode === 'single-dose') {
      const context = { ...humanContext(form, drug.specialties[0]), packId:form.packOptions[0].id };
      for (const record of availableSingleDoseSources(FENTANYL_SINGLE_DOSE_SOURCES, context)) {
        const result = resolveSingleDose(form, record, { ...context,
          doseMicrograms:record.referenceDoseMicrograms ?? record.minMicrograms,
          sourceConfirmations:record.selectionRequirements.map(item => item.id) });
        if (result.valid) usable = true;
        else diagnostics.push(`${record.id}: ${result.errors.join(' ')}`);
      }
    } else if (drug.specialties.includes('veterinary')) {
      for (const species of form.targetSpecies || []) {
        const context = animalContext(form, species);
        const candidates = availableRegimens(REGIMENS, context);
        for (const record of candidates) {
          const result = resolveRegimen(record, { ...context, days: record.fixedDays ?? record.minDays ?? 1 });
          if (result.valid) usable = true;
          else diagnostics.push(`${record.id}: ${result.errors.join(' ')}`);
        }
      }
    } else {
      for (const specialty of drug.specialties) {
        const context = humanContext(form, specialty);
        const candidates = availableHumanRegimens(HUMAN_REGIMENS, context);
        for (const record of candidates) {
          const selected = selectedHumanContext(record, context);
          const result = resolveHumanRegimen(record, selected);
          const additional = assessAnticoagulantEligibility(record, selected);
          if (result.valid && additional.errors.length === 0) usable = true;
          else diagnostics.push(`${record.id}: ${[...result.errors, ...additional.errors].join(' ')}`);
        }
      }
    }
    if (!usable) failures.push(`${form.id}: ${diagnostics.join(' | ') || 'no available source for declared context'}`);
  }
  assert.deepEqual(failures, []);
});

test('all source assignments reference real active formulations and match their specialty or exact target species', () => {
  for (const record of allRecords) {
    assert.ok(record.id && record.label && record.indication, record.id);
    assert.ok(record.formIds.length > 0, record.id);
    assert.equal(new Set(record.formIds).size, record.formIds.length, record.id);
    assert.match(record.sourceUrl, /^https:\/\/[^\s]+$/, record.id);
    assert.ok(record.sourceLabel && record.sourceSection, record.id);
    assert.match(record.sourceCheckedAt, /^\d{4}-\d{2}-\d{2}$/, record.id);
    for (const formId of record.formIds) {
      const entry = byForm.get(formId);
      assert.ok(entry, `${record.id}: unknown formulation ${formId}`);
      assert.equal(blocked(entry.form), false, `${record.id}: source attached to reference-only formulation ${formId}`);
      if (record.species) {
        assert.ok(entry.drug.specialties.includes('veterinary'), `${record.id}/${formId}`);
        for (const species of record.species) {
          assert.ok(entry.form.targetSpecies.includes(species), `${record.id}/${formId}: wrong species ${species}`);
          assert.ok(availableRegimens([record], { formId, species }).length === 1, `${record.id}: invalid source metadata`);
        }
      } else {
        assert.ok(Array.isArray(record.specialties) && record.specialties.length > 0, record.id);
        for (const specialty of record.specialties) {
          assert.ok(entry.drug.specialties.includes(specialty), `${record.id}/${formId}: wrong specialty ${specialty}`);
          for (const patientType of record.patientTypes || ['adult', 'child']) {
            const available = record.calculationMode === 'single-dose' ? availableSingleDoseSources : availableHumanRegimens;
            assert.equal(available([record], { formId, specialty, patientType }).length, 1,
              `${record.id}/${formId}: invalid source metadata or patient scope`);
          }
        }
      }
    }
  }
});

test('four documented reference exceptions remain unavailable and cannot yield arithmetic through unit mode', () => {
  const reasons = {
    'enrobactin-rodents-25': /koncentrat|rozcieńczeni|przygotowani/i,
    'chlosite-025': /Brak zweryfikowanej polskiej instrukcji/i,
    'chlosite-1': /Brak zweryfikowanej polskiej instrukcji/i,
    'dentomycin-gel-ie': /niebędący w obrocie|archiwalnej/i,
  };
  const excluded = entries.filter(({ form }) => blocked(form));
  assert.deepEqual(excluded.map(({ form }) => form.id).sort(), Object.keys(reasons).sort());
  for (const { drug, form } of excluded) {
    assert.match([form.calculationNote, ...(form.notes || [])].filter(Boolean).join(' '), reasons[form.id], form.id);
    assert.ok(form.sourceUrl, form.id);
    assert.ok(!allRecords.some(record => record.formIds.includes(form.id)), form.id);
    const scope = { formId: form.id, calculationBlocked: blocked(form) };
    assert.deepEqual(availableHumanRegimens(HUMAN_REGIMENS, { ...scope, specialty: drug.specialties[0], patientType: 'adult' }), []);
    for (const species of form.targetSpecies || ['horse']) {
      assert.deepEqual(availableRegimens(REGIMENS, { ...scope, species }), []);
    }
    // The calculator receives the combined reference/preparation gate used by
    // the app. Even complete direct-unit inputs must not bypass that gate.
    const result = calculate({ ...form, calculationBlocked: blocked(form), form: form.form,
      doseMode: 'units', dose: 1, frequency: 1, days: 1, packageSize: 100 });
    assert.equal(result.valid, false, form.id);
    assert.equal(result.singleUnits, null, form.id);
    assert.equal(result.packages, null, form.id);
  }
});

test('an empty context or an absent explicit source never chooses a regimen or returns a dose', () => {
  assert.deepEqual(availableHumanRegimens(HUMAN_REGIMENS, {}), []);
  assert.deepEqual(availableRegimens(REGIMENS, {}), []);
  assert.deepEqual(availableSingleDoseSources(FENTANYL_SINGLE_DOSE_SOURCES, {}), []);
  for (const record of FENTANYL_SINGLE_DOSE_SOURCES) {
    const result = resolveSingleDose(byForm.get(record.formIds[0]).form, record, {});
    assert.equal(result.valid, false, record.id);
    assert.equal(result.doseMicrograms, null, record.id);
    assert.equal(result.volumeMl, null, record.id);
  }
  for (const record of HUMAN_REGIMENS) {
    const result = resolveHumanRegimen(record, {});
    assert.equal(result.valid, false, record.id);
    assert.equal(result.dose, null, record.id);
    assert.equal(result.frequency, null, record.id);
  }
  for (const record of REGIMENS) {
    const result = resolveRegimen(record, {});
    assert.equal(result.valid, false, record.id);
    assert.equal(result.dose, null, record.id);
    assert.equal(result.frequency, null, record.id);
  }
  for (const result of [resolveHumanRegimen(null, humanContext(byForm.get('atoris-20').form, 'cardio')),
    resolveRegimen(null, animalContext(byForm.get('metacam-dog-1-5').form, 'dog'))]) {
    assert.equal(result.valid, false);
    assert.equal(result.dose, null);
    assert.equal(result.frequency, null);
  }
});
