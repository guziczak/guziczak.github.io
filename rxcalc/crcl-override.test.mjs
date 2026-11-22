import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { resolveHumanRegimen } from './human-regimen-engine.js';
import { CARDIO_ANTICOAGULANT_REGIMENS, assessAnticoagulantEligibility } from './cardio-anticoagulant-regimens.js';
import { assessRenalInput } from './renal-function.js';
import { assessDurationRegimen } from './duration-regimen.js';
import { LIQUID_STARTER_REGIMENS } from './liquid-starters.js';
import { automaticRoundingStep, assessDoseRounding, roundingCaseKey } from './rounding-assessment.js';

const notice = 'CrCl pominięty — nie sprawdzono zakresu nerkowego schematu.';
const byId = id => {
  const source = HUMAN_REGIMENS.find(record => record.id === id);
  assert.ok(source, id);
  return source;
};
const formFor = source => DRUGS.flatMap(drug => drug.forms).find(form => form.id === source.formIds[0]);
const contextFor = (source, patch = {}) => ({
  patientKind: 'human', formId: source.formIds[0], specialty: source.specialties[0], patientType: 'adult',
  age: 55, ageUnit: 'years', weight: 70, renalStatus: 'unknown', crcl: null, serumCreatinine: 1,
  doseMode: source.doseMode, dose: source.dose ?? source.doseRange?.min,
  frequency: source.frequency, days: source.fixedDays ?? source.minDays ?? 7,
  sourceConfirmations: (source.selectionRequirements || []).map(requirement => requirement.id),
  ...patch,
});

test('only explicit true bypasses required, malformed and out-of-band numeric CrCl', () => {
  const source = byId('cardio-ramipril-hypertension-5-crcl10to60');
  for (const crcl of [undefined, null, '', 0, -1, NaN, Infinity, '40', 9.99, 60, 95]) {
    const input = contextFor(source, { crcl, ignoreCrCl: true });
    const before = structuredClone(input);
    const result = resolveHumanRegimen(source, input);
    assert.equal(result.valid, true, `${String(crcl)}: ${result.errors.join('; ')}`);
    assert.equal(result.crclIgnored, true);
    assert.equal(result.requirements.includes('crcl'), false);
    assert.equal(result.issues.some(issue => issue.field === 'crcl'), false);
    assert.equal(result.warnings.filter(message => message === notice).length, 1);
    assert.equal(result.maxDailyMg, 5);
    assert.equal(result.dose, 5);
    assert.deepEqual(input, before);
    for (const ignoreCrCl of [undefined, false, null, 'true', 1]) {
      const checked = resolveHumanRegimen(source, { ...input, ignoreCrCl });
      assert.equal(checked.valid, false, `${String(crcl)} / ${String(ignoreCrCl)}`);
      assert.equal(checked.crclIgnored, false);
      assert.ok(checked.requirements.includes('crcl'));
    }
  }
});

test('Ospamox ignore preserves the selected dose and both original scheme ceilings', () => {
  const source = byId('dental-ospamox-suspension-ge40-q8');
  const original = structuredClone(source);
  const input = contextFor(source, { dose: 300, crcl: 20, ignoreCrCl: true });
  const ignored = resolveHumanRegimen(source, input);
  assert.equal(ignored.valid, true);
  assert.equal(ignored.dose, 300);
  assert.equal(ignored.frequency, 3);
  assert.equal(ignored.maxSingleMg, 500);
  assert.equal(ignored.maxDailyMg, 1500);
  assert.equal(ignored.crclIgnored, true);
  const evaluated = resolveHumanRegimen(source, { ...input, ignoreCrCl: false });
  assert.equal(evaluated.valid, false);
  assert.equal(evaluated.maxDailyMg, ignored.maxDailyMg);
  for (const patch of [{ dose: 501 }, { frequency: 6 }, { weight: 39 }, { age: -1 },
    { renalStatus: 'impaired' }, { renalStatus: 'invalid' }, { days: 0 }]) {
    const blocked = resolveHumanRegimen(source, { ...input, ...patch }, { allowNumericOverrides: true });
    assert.equal(blocked.valid, false, JSON.stringify(patch));
  }
  assert.deepEqual(source, original);
});

test('ignore never relabels irrelevant sources or relaxes malformed source metadata', () => {
  const source = byId('dental-dalacin-c-300-over14-tid');
  const result = resolveHumanRegimen(source, contextFor(source, { dose: 300, ignoreCrCl: true }));
  assert.equal(result.valid, true, result.errors.join('; '));
  assert.equal(result.crclIgnored, false);
  assert.equal(result.warnings.includes(notice), false);
  const ramipril = byId('cardio-ramipril-hypertension-5-crcl10to60');
  for (const patch of [{ minCrCl: 70 }, { maxCrCl: NaN }, { requireCrCl: 'true' }])
    assert.equal(resolveHumanRegimen({ ...ramipril, ...patch }, contextFor(ramipril, { ignoreCrCl: true })).valid, false);
});

test('all anticoagulant rules skip numeric renal bands once while preserving fixed doses', () => {
  for (const source of CARDIO_ANTICOAGULANT_REGIMENS) {
    const criteria = source.anticoagulantRule === 'apixaban-nvaf-two-criteria' ? { age: 80, weight: 60 } : {};
    for (const crcl of [null, 0, NaN, 10, 25, 40, 80]) {
      const input = contextFor(source, { ...criteria, crcl, ignoreCrCl: true });
      const specialist = assessAnticoagulantEligibility(source, input);
      assert.deepEqual(specialist.errors, [], source.id);
      assert.equal(specialist.crclIgnored, true);
      assert.equal(specialist.requirements.includes('crcl'), false);
      assert.equal(specialist.warnings.includes(notice), false, 'The general resolver owns the single notice');
      const result = resolveHumanRegimen(source, input);
      assert.equal(result.valid, true, `${source.id}: ${result.errors.join('; ')}`);
      assert.equal(result.warnings.filter(message => message === notice).length, 1);
      assert.equal(result.dose, source.dose);
      assert.equal(result.frequency, source.frequency);
      assert.equal(resolveHumanRegimen(source, { ...input, dose: source.dose * 2 }, { allowNumericOverrides: true }).valid, false);
    }
  }
});

test('ignoring CrCl retains apixaban age, mass and independent serum-creatinine criteria', () => {
  const standard = byId('cardio-eliquis-nvaf-standard');
  const reduced = byId('cardio-eliquis-nvaf-two-criteria');
  for (const [source, patch, valid] of [
    [standard, { age: 70, weight: 75, serumCreatinine: null }, true],
    [reduced, { age: 80, weight: 60, serumCreatinine: null }, true],
    [standard, { age: 80, weight: 70, serumCreatinine: null }, false],
    [standard, { age: 80, weight: 70, serumCreatinine: 1.49 }, true],
    [standard, { age: 80, weight: 70, serumCreatinine: 1.5 }, false],
    [reduced, { age: 70, weight: 75, serumCreatinine: 1.5 }, false],
    [standard, { age: 17 }, false],
    [standard, { weight: 0 }, false],
    [standard, { serumCreatinine: 0 }, false],
  ]) {
    const result = resolveHumanRegimen(source, contextFor(source, { ignoreCrCl: true, ...patch }));
    assert.equal(result.valid, valid, `${source.id}: ${JSON.stringify(patch)} ${result.errors.join('; ')}`);
  }
  const missing = resolveHumanRegimen(standard, contextFor(standard, {
    age: 80, serumCreatinine: null, ignoreCrCl: true,
  }));
  assert.ok(missing.requirements.includes('serumCreatinine'));
  assert.ok(missing.issues.some(issue => issue.field === 'serumCreatinine' && issue.kind === 'missing'));
});

test('renal source confirmations and dialysis scope are never silently confirmed by ignore', () => {
  const source = byId('cardio-eliquis-nvaf-standard');
  const input = contextFor(source, { ignoreCrCl: true });
  const withoutRenalConfirmation = {
    ...input, sourceConfirmations: input.sourceConfirmations.filter(id => id !== 'apixaban-renal-scope'),
  };
  const before = structuredClone(withoutRenalConfirmation);
  const result = resolveHumanRegimen(source, withoutRenalConfirmation);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some(issue => issue.code === 'missing-source-confirmations'));
  assert.deepEqual(withoutRenalConfirmation, before);
});

test('incomplete CG inputs do not block ignored CrCl or invent an independent creatinine requirement', () => {
  const calculation = assessRenalInput({ mode: 'calculate', age: 55, ageUnit: 'years', weight: 70,
    serumCreatinine: '', creatinineUnit: 'mg/dl', sex: '', renalStable: false, weightReviewed: false });
  assert.ok(calculation.issues.length >= 4);
  for (const id of ['dental-ospamox-suspension-ge40-q8', 'cardio-eliquis-nvaf-standard']) {
    const source = byId(id);
    const input = contextFor(source, { ignoreCrCl: true, serumCreatinine: null, renalIssues: calculation.issues });
    const result = resolveHumanRegimen(source, input);
    assert.equal(result.valid, true, `${id}: ${result.errors.join('; ')}`);
    assert.equal(result.requirements.includes('serumCreatinine'), false);
    assert.deepEqual(result.issues, []);
    assert.equal(resolveHumanRegimen(source, { ...input, ignoreCrCl: false }).valid, false);
  }
  const standard = byId('cardio-eliquis-nvaf-standard');
  const needsCreatinine = resolveHumanRegimen(standard, contextFor(standard, {
    age: 80, ignoreCrCl: true, serumCreatinine: null, renalIssues: calculation.issues,
  }));
  assert.equal(needsCreatinine.valid, false);
  assert.deepEqual(needsCreatinine.issues.map(issue => issue.field), ['serumCreatinine']);
});

test('ignored CG retains independently invalid creatinine and unit errors for NVAF', () => {
  const standard = byId('cardio-eliquis-nvaf-standard');
  for (const [patch, field] of [[{ serumCreatinine: 'bad' }, 'serumCreatinine'],
    [{ creatinineUnit: 'invalid' }, 'creatinineUnit']]) {
    const calculation = assessRenalInput({ mode: 'calculate', age: 55, ageUnit: 'years', weight: 70,
      serumCreatinine: '1', creatinineUnit: 'mg/dl', ...patch });
    const result = resolveHumanRegimen(standard, contextFor(standard, {
      ignoreCrCl: true, serumCreatinine: calculation.serumCreatinineMgDl, renalIssues: calculation.issues,
    }));
    assert.equal(result.valid, false);
    assert.deepEqual(result.issues.map(issue => issue.field), [field]);
  }
  const failedCrCl = resolveHumanRegimen(standard, contextFor(standard, {
    ignoreCrCl: true,
    renalIssues: [{ code: 'crcl-calculation-invalid', field: 'serumCreatinine', kind: 'invalid',
      message: 'Te dane nie pozwalają uzyskać poprawnego oszacowania CrCl.' }],
  }));
  assert.equal(failedCrCl.valid, true);
});

test('duration comparison honors ignore while retaining independent dose limits', () => {
  const source = byId('cardio-ramipril-hypertension-5-crcl10to60');
  const options = { source, form: formFor(source), context: contextFor(source), rule: { origin: 'source' } };
  assert.equal(assessDurationRegimen(options).state, 'incomplete');
  const ignored = { ...options, context: { ...options.context, ignoreCrCl: true } };
  assert.equal(assessDurationRegimen(ignored).state, 'matched');
  assert.equal(assessDurationRegimen({ ...ignored, context: { ...ignored.context, dose: 10 } }).state, 'mismatch');
});

test('rounding passes the explicit override through and retains stricter independent caps', () => {
  const source = LIQUID_STARTER_REGIMENS.find(record => record.id === 'dental-augmentin-suspension-adult-substitution');
  const options = { source, form: formFor(source), context: contextFor(source, {
    crcl: 20, ignoreCrCl: false, roundingMode: 'auto', roundingStep: 1,
  }), limits: { single: null, daily: null } };
  assert.equal(automaticRoundingStep(options), null);
  const ignored = { ...options, context: { ...options.context, ignoreCrCl: true } };
  assert.equal(automaticRoundingStep(ignored), 1);
  assert.equal(assessDoseRounding(ignored).state, 'rule');
  assert.notEqual(roundingCaseKey(options), roundingCaseKey(ignored));
  assert.equal(assessDoseRounding({ ...ignored, limits: { daily: 1500 } }).state, 'blocked');
  assert.equal(assessDoseRounding({ ...ignored, context: { ...ignored.context, renalStatus: 'impaired' } }).state, 'blocked');
});
