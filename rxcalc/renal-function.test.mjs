import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRenalInput, convertCreatinine, parseRenalNumber } from './renal-function.js';

const base = Object.freeze({
  mode: 'calculate', age: 68, ageUnit: 'years', weight: 72,
  serumCreatinine: 1, creatinineUnit: 'mg/dl', sex: 'male',
  renalStable: true, weightReviewed: true,
});
const assess = overrides => assessRenalInput({ ...base, ...overrides });
const close = (actual, expected, tolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const has = (result, field, kind) => result.issues.some(issue => issue.field === field && issue.kind === kind);

test('canonical CG numerical oracles use mg/dl, kg, years and explicit sex', () => {
  // DailyMed's Cockcroft–Gault formula: 72 * (140 - 68) / (72 * 1) = 72;
  // the female multiplier gives 61.2. Independent fixed expected values.
  const male = assess({});
  assert.equal(male.crcl, 72);
  assert.equal(male.valid, true);
  assert.equal(male.method, 'cockcroft-gault');
  assert.equal(male.weightKind, 'actual');
  assert.equal(male.weightUsedKg, 72);
  close(assess({ sex: 'female' }).crcl, 61.2);
  assert.equal(assess({ serumCreatinine: 2 }).crcl, 36);
  assert.equal(assess({ age: 104 }).crcl, 36);
});

test('published SPS example agrees with approximately 37 ml/min', () => {
  // SPS Calculating kidney function: man, 80 years, 60 kg, SCr 120 µmol/L.
  // Canonical mg/dl equation with NIDDK conversion gives 36 5/6 ml/min.
  const result = assess({ age: 80, weight: 60, serumCreatinine: 120, creatinineUnit: 'umol/l' });
  close(result.crcl, 36.833333333333336);
  assert.equal(Math.round(result.crcl), 37);
});

test('equivalent units preserve the same physical creatinine and CG result', () => {
  const mg = assess({ serumCreatinine: '1,5', weight: 60, age: 80 });
  const si = assess({ serumCreatinine: '132,6', creatinineUnit: 'umol/l', weight: 60, age: 80 });
  assert.equal(si.serumCreatinineMgDl, 1.5);
  close(si.crcl, mg.crcl);
  close(mg.crcl, 33.333333333333336);
  assert.equal(convertCreatinine(1.5, 'mg/dl', 'umol/l'), 132.6);
  assert.equal(convertCreatinine(132.6, 'umol/l', 'mg/dl'), 1.5);
  assert.equal(convertCreatinine(1.4999, 'mg/dl', 'mg/dl'), 1.4999);
});

test('unit changes never guess a unit from the magnitude', () => {
  const mg = assess({ serumCreatinine: 88.4 });
  const si = assess({ serumCreatinine: 88.4, creatinineUnit: 'umol/l' });
  close(mg.serumCreatinineMgDl, 88.4);
  close(si.serumCreatinineMgDl, 1);
  close(si.crcl / mg.crcl, 88.4);
  for (const unit of [undefined, '', 'mg/L', 'mmol/l', 'µmol/l', 'egfr', true]) {
    const result = assess({ creatinineUnit: unit });
    assert.equal(result.valid, false, String(unit));
    assert.equal(result.crcl, null);
    assert.equal(result.serumCreatinineMgDl, null);
    assert.ok(result.issues.some(issue => issue.field === 'creatinineUnit'));
  }
});

test('decimal-rational conversion prevents floating drift in common and precise entered values', () => {
  for (const [mg, si] of [[1.51, 133.484], [1.4999, 132.59116], [1.234567, 109.1357228],
    [0.7, 61.88], [1.5, 132.6]]) {
    assert.equal(convertCreatinine(mg, 'mg/dl', 'umol/l'), si);
    assert.equal(convertCreatinine(si, 'umol/l', 'mg/dl'), mg);
  }
  assert.equal(convertCreatinine(133, 'umol/l', 'mg/dl'), 1.504524886877828);
  assert.equal(convertCreatinine(1.504524886877828, 'mg/dl', 'umol/l'), 133);
  // Exact ratio conversion avoids a false intermediate overflow/underflow.
  assert.equal(convertCreatinine(1e308, 'umol/l', 'mg/dl'), 1.1312217194570135e306);
  assert.equal(convertCreatinine(1e-320, 'mg/dl', 'umol/l'), 8.84e-319);
});

test('threshold decisions retain precision and do not consume display rounding', () => {
  const below = assess({ age: 80, weight: 36, serumCreatinine: 1.00001 });
  const exact = assess({ age: 80, weight: 36, serumCreatinine: 1 });
  const above = assess({ age: 80, weight: 36, serumCreatinine: 0.99999 });
  assert.ok(below.crcl < 30);
  assert.equal(exact.crcl, 30);
  assert.ok(above.crcl > 30);
  assert.equal(below.crcl.toFixed(1), '30.0');
  assert.equal(above.crcl.toFixed(1), '30.0');
  assert.equal(assess({ serumCreatinine: 1.4999 }).serumCreatinineMgDl < 1.5, true);
  assert.equal(assess({ serumCreatinine: 1.5 }).serumCreatinineMgDl >= 1.5, true);
  assert.equal(assess({ serumCreatinine: 132.599999, creatinineUnit: 'umol/l' }).serumCreatinineMgDl < 1.5, true);
  assert.equal(assess({ serumCreatinine: 132.6, creatinineUnit: 'umol/l' }).serumCreatinineMgDl >= 1.5, true);
  assert.equal(assess({ serumCreatinine: 132.600001, creatinineUnit: 'umol/l' }).serumCreatinineMgDl > 1.5, true);
  assert.equal(assessRenalInput({ mode: 'manual', crcl: '29,99999' }).crcl < 30, true);
});

test('clinician-selected calculation weight does not overwrite actual weight', () => {
  const result = assess({ weight: 120, calculationWeight: 72 });
  assert.equal(result.valid, true);
  assert.equal(result.actualWeightKg, 120);
  assert.equal(result.weightUsedKg, 72);
  assert.equal(result.weightKind, 'clinician-selected');
  assert.equal(result.crcl, 72);
  assert.equal(assess({ weight: 120 }).crcl, 120);
  for (const calculationWeight of [0, -1, 'not a weight', Infinity, 501]) {
    const invalid = assess({ calculationWeight });
    assert.equal(invalid.crcl, null);
    assert.equal(invalid.valid, false);
    assert.ok(has(invalid, 'calculationWeight', 'invalid'));
  }
  const missingActual = assess({ weight: '', calculationWeight: 72 });
  assert.equal(missingActual.crcl, null);
  assert.ok(has(missingActual, 'weight', 'missing'));
});

test('automatic path requires explicit review and does not accept truthy substitutes', () => {
  for (const renalStable of [undefined, null, '', false, 'true', 1]) {
    const result = assess({ renalStable });
    assert.equal(result.valid, false);
    assert.equal(result.crcl, null);
    assert.ok(result.issues.some(issue => issue.field === 'renalStable'));
  }
  assert.ok(has(assess({ renalStable: false }), 'renalStable', 'out-of-scope'));
  for (const weightReviewed of [undefined, null, '', false, 'true', 1]) {
    const result = assess({ weightReviewed });
    assert.equal(result.valid, false);
    assert.equal(result.crcl, null);
    assert.ok(result.issues.some(issue => issue.field === 'weightReviewed'));
  }
});

test('automatic estimator is adult-only and handles age units explicitly', () => {
  assert.equal(assess({ age: 816, ageUnit: 'months' }).crcl, 72);
  assert.equal(assess({ age: 18 }).valid, true);
  assert.equal(assess({ age: 216, ageUnit: 'months' }).valid, true);
  for (const age of [17.999, 1]) {
    const result = assess({ age });
    assert.equal(result.crcl, null);
    assert.ok(has(result, 'age', 'out-of-scope'));
  }
  for (const age of [0, -1, 140, 150, Infinity, NaN, '68 years']) {
    const result = assess({ age });
    assert.equal(result.crcl, null);
    assert.ok(has(result, 'age', 'invalid'));
  }
  for (const ageUnit of [undefined, '', 'weeks', 12]) {
    const result = assess({ ageUnit });
    assert.equal(result.crcl, null);
    assert.ok(result.issues.some(issue => issue.field === 'ageUnit'));
  }
  const days = assess({ age: 24837, ageUnit: 'days' });
  assert.equal(days.crcl, null);
  assert.ok(has(days, 'ageUnit', 'out-of-scope'));
});

test('missing, invalid and ambiguous inputs cannot silently become calculation values', () => {
  for (const field of ['age', 'weight', 'serumCreatinine', 'sex']) {
    for (const value of ['', ' ', null, undefined]) {
      const result = assess({ [field]: value });
      assert.equal(result.crcl, null, `${field}: ${String(value)}`);
      assert.ok(has(result, field, 'missing'));
    }
  }
  for (const value of [true, false, [], [1], {}, '1 mg/dl', '1,2.3', '1 000', '1e2', '0x10', Infinity, NaN]) {
    const result = assess({ serumCreatinine: value });
    assert.equal(result.crcl, null, String(value));
    assert.ok(has(result, 'serumCreatinine', 'invalid'));
  }
  for (const value of [0, -1, '0', '-0,5']) assert.equal(assess({ serumCreatinine: value }).crcl, null);
  for (const sex of ['unknown', 'M', true, 1]) {
    const result = assess({ sex });
    assert.equal(result.crcl, null);
    assert.ok(has(result, 'sex', 'invalid'));
  }
});

test('manual assessed CrCl does not require or infer inputs for automatic estimation', () => {
  const result = assessRenalInput({ mode: 'manual', crcl: '42,5' });
  assert.equal(result.valid, true);
  assert.equal(result.crcl, 42.5);
  assert.equal(result.method, 'assessed-crcl');
  assert.equal(result.serumCreatinineMgDl, null);
  assert.equal(result.weightUsedKg, null);
  assert.deepEqual(result.issues, []);
  const filled = assessRenalInput({ mode: 'manual', crcl: 42.5, serumCreatinine: 88.4, creatinineUnit: 'umol/l' });
  assert.equal(filled.crcl, 42.5);
  assert.equal(filled.serumCreatinineMgDl, 1);
  // Hidden fields from a previous automatic mode must not affect an assessed value.
  assert.equal(assessRenalInput({ mode: 'manual', crcl: 42.5, renalStable: false, sex: '', calculationWeight: -1 }).valid, true);
});

test('manual path distinguishes absent optional creatinine from invalid entered creatinine', () => {
  const absent = assessRenalInput({ mode: 'manual', crcl: 50, serumCreatinine: '', creatinineUnit: 'mg/dl' });
  assert.equal(absent.valid, true);
  const invalid = assessRenalInput({ mode: 'manual', crcl: 50, serumCreatinine: 'n/a', creatinineUnit: 'mg/dl' });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.crcl, 50);
  assert.equal(invalid.serumCreatinineMgDl, null);
  assert.ok(has(invalid, 'serumCreatinine', 'invalid'));
  const missingUnit = assessRenalInput({ mode: 'manual', crcl: 50, serumCreatinine: 1 });
  assert.equal(missingUnit.valid, false);
  assert.ok(has(missingUnit, 'creatinineUnit', 'missing'));
});

test('manual CrCl is not imported from eGFR and must be explicitly finite and positive', () => {
  const absent = assessRenalInput({ mode: 'manual', egfr: 60, serumCreatinine: 1, creatinineUnit: 'mg/dl' });
  assert.equal(absent.crcl, null);
  assert.ok(has(absent, 'crcl', 'missing'));
  for (const crcl of [0, -1, Infinity, NaN, '60 ml/min', '60 mL/min/1.73m2', [], true]) {
    const result = assessRenalInput({ mode: 'manual', crcl });
    assert.equal(result.valid, false);
    assert.equal(result.crcl, null);
    assert.ok(has(result, 'crcl', 'invalid'));
  }
});

test('tiny/huge arithmetic cannot return a non-finite or zero estimate as valid', () => {
  for (const serumCreatinine of [1e-320, Number.MAX_VALUE]) {
    const result = assess({ serumCreatinine });
    assert.equal(result.valid, false);
    assert.equal(result.crcl, null);
    assert.ok(result.issues.length > 0);
  }
  assert.equal(convertCreatinine(Number.MAX_VALUE, 'mg/dl', 'umol/l'), null);
  assert.equal(convertCreatinine(Number.MIN_VALUE, 'umol/l', 'mg/dl'), null);
});

test('parsing and normalization are strict, pure, and preserve decimals', () => {
  assert.equal(parseRenalNumber(' 1,23456789 '), 1.23456789);
  assert.equal(parseRenalNumber('.5'), 0.5);
  assert.equal(parseRenalNumber('+.5'), 0.5);
  assert.equal(parseRenalNumber('1.'), null);
  assert.equal(parseRenalNumber(''), null);
  assert.equal(parseRenalNumber(true), null);
  const frozen = Object.freeze({ ...base, calculationWeight: 60 });
  const result = assessRenalInput(frozen);
  assert.equal(frozen.weight, 72);
  assert.equal(frozen.calculationWeight, 60);
  assert.equal(result.crcl, 60);
  for (const value of [null, false, 1, [], 'input']) {
    const invalid = assessRenalInput(value);
    assert.equal(invalid.valid, false);
    assert.equal(invalid.crcl, null);
  }
  assert.ok(has(assessRenalInput({}), 'mode', 'missing'));
  assert.ok(has(assessRenalInput({ mode: 'guess' }), 'mode', 'invalid'));
});
