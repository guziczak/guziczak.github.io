import test from 'node:test';
import assert from 'node:assert/strict';
import { DENTAL_TOPICAL_DRUGS } from './dental-topicals.js';
import { PERIODONTAL_FORM_PATCHES, PERIODONTAL_SOURCE_REGIMENS } from './periodontal-source-regimens.js';
import { availableHumanRegimens, resolveHumanRegimen } from './human-regimen-engine.js';
import { instructionDosingText } from './dental-output.js';

const regimen = PERIODONTAL_SOURCE_REGIMENS[0];
const context = {
  formId: 'ligosan-periodontal-gel', specialty: 'dental',
  patientType: 'adult', age: 18, ageUnit: 'years',
};

test('the RPL-backed professional instruction resolves without a fictional daily course', () => {
  assert.equal(availableHumanRegimens(PERIODONTAL_SOURCE_REGIMENS, context).length, 1);
  const result = resolveHumanRegimen(regimen, context);
  assert.equal(result.valid, true, result.errors.join('; '));
  assert.deepEqual(result.requirements, ['age']);
  for (const key of ['dose', 'frequency', 'fixedDays', 'minDays', 'maxDays', 'maxDailyMg', 'maxSingleMg']) {
    assert.equal(result[key], null, `${key} must not be fabricated`);
  }
  const text = instructionDosingText({ source: regimen, frequency: result.frequency, days: result.fixedDays });
  assert.match(text, /Przez 7 dni po aplikacji/);
  assert.doesNotMatch(text, /Czas stosowania:|razy na dobę|260 mg|36,4 mg/);
});

test('the professional source is unavailable outside its exact adult periodontal formulation', () => {
  assert.equal(resolveHumanRegimen(regimen, { ...context, age: 17.99 }).valid, false);
  assert.equal(resolveHumanRegimen(regimen, { ...context, age: null }).valid, false);
  assert.equal(resolveHumanRegimen(regimen, { ...context, patientType: 'child', age: 18 }).valid, false);
  assert.equal(resolveHumanRegimen(regimen, { ...context, formId: 'chlosite-1' }).valid, false);
  assert.equal(resolveHumanRegimen(regimen, { ...context, calculationBlocked: true }).valid, false);
  assert.equal(regimen.professionalUse, true);
  assert.match(regimen.indication, /≥5 mm/);
  assert.match(regimen.screening, /karmienie piersią/);
  assert.match(regimen.screening, /antybiotykoterapia ogólnoustrojowa/);
});

test('activating the source instruction preserves qualitative dosing and metadata-only package counts', () => {
  assert.equal(PERIODONTAL_FORM_PATCHES.length, 1);
  const patch = PERIODONTAL_FORM_PATCHES[0];
  const drug = DENTAL_TOPICAL_DRUGS.find(item => item.id === patch.drugId);
  const original = drug.forms.find(form => form.id === patch.formId);
  const form = { ...original, ...patch.changes };
  assert.equal(form.referenceOnly, false);
  assert.equal(form.calculationMode, 'instruction');
  assert.equal(form.productKind, 'medicine');
  assert.equal(form.professionalUse, true);
  assert.equal(form.sourceDocumentDate, null);
  assert.match(form.sourceUrl, /rejestry\.ezdrowie\.gov\.pl\/api\/rpl\/medicinal-products\/32531\/characteristic$/);
  for (const key of ['strengthMg', 'concentrationMg', 'concentrationMl', 'defaultDose', 'defaultFrequency', 'defaultDays', 'maxDailyMg']) {
    assert.equal(form[key], null, `${key} is not a gel amount for one pocket`);
  }
  assert.deepEqual(form.packOptions.map(pack => pack.quantity), [1, 1, 1, 1, 1]);
  assert.equal(regimen.dose, undefined);
  assert.equal(regimen.doseRange, undefined);
  assert.equal(regimen.reviewAfterDays, undefined);
  assert.equal(regimen.sourceCheckedAt, '2026-11-19');
  assert.equal(regimen.clinicalReviewStatus, 'not-clinically-validated');
});

test('reference Chlo-Site and withdrawn Dentomycin are not activated by a periodontal patch', () => {
  for (const formId of ['chlosite-025', 'chlosite-1', 'dentomycin-gel-ie']) {
    assert.equal(PERIODONTAL_FORM_PATCHES.some(patch => patch.formId === formId), false);
    assert.equal(PERIODONTAL_SOURCE_REGIMENS.some(source => source.formIds.includes(formId)), false);
    assert.equal(DENTAL_TOPICAL_DRUGS.flatMap(drug => drug.forms).find(form => form.id === formId).referenceOnly, true);
  }
});
