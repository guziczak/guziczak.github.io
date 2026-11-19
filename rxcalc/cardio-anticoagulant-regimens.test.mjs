import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARDIO_ANTICOAGULANT_REGIMENS as records,
  assessAnticoagulantEligibility as assess,
} from './cardio-anticoagulant-regimens.js';
import { availableHumanRegimens, resolveHumanRegimen } from './human-regimen-engine.js';
import { DRUGS } from './catalogue.js';
import { calculate } from './engine.js';

const byId = id => records.find(record => record.id === `cardio-${id}`);
const formById = id => DRUGS.flatMap(drug => drug.forms).find(form => form.id === id);
const contextFor = (record, overrides = {}) => ({
  formId: record.formIds[0], specialty: 'cardio', patientType: 'adult',
  age: 70, ageUnit: 'years', weight: 75, serumCreatinine: 1.1,
  crcl: 80, renalStatus: 'unknown', dose: record.dose, frequency: record.frequency,
  days: record.fixedDays ?? record.minDays ?? 30,
  sourceConfirmations: record.selectionRequirements.map(requirement => requirement.id),
  ...overrides,
});
const eligibleContext = record => contextFor(record,
  record.anticoagulantRule === 'apixaban-nvaf-two-criteria'
    ? { age: 80, weight: 60, crcl: 45 }
    : record.anticoagulantRule === 'apixaban-nvaf-severe-renal'
      ? { crcl: 25 }
      : ['rivaroxaban-nvaf-renal', 'rivaroxaban-vte-reduced'].includes(record.anticoagulantRule)
        ? { crcl: 45 } : {});

test('four existing strengths have fourteen explicitly scoped, sourced adult choices', () => {
  assert.equal(records.length, 14);
  assert.equal(new Set(records.map(record => record.id)).size, 14);
  assert.deepEqual(new Set(records.flatMap(record => record.formIds)),
    new Set(['eliquis-2.5', 'eliquis-5', 'xarelto-15', 'xarelto-20']));
  for (const record of records) {
    const context = eligibleContext(record);
    assert.equal(availableHumanRegimens([record], context).length, 1, record.id);
    assert.equal(availableHumanRegimens([record], { ...context, patientType: 'child' }).length, 0, record.id);
    assert.equal(availableHumanRegimens([record], { ...context, specialty: 'dental' }).length, 0, record.id);
    assert.equal(availableHumanRegimens([record], { ...context, formId: 'unreviewed-strength' }).length, 0, record.id);
    assert.equal(record.doseMode, 'fixed');
    assert.equal(record.lockSourceValues, true);
    assert.equal(record.requireCrCl, true);
    assert.equal(record.minAgeMonths, 216);
    assert.equal(record.sourceCheckedAt, '2026-11-19');
    assert.match(record.sourceUrl, /^https:\/\/www\.ema\.europa\.eu\/en\/documents\/product-information\//);
    assert.ok(record.sourceSection.includes('4.2') || record.sourceSection === '4.1–4.4');
    assert.ok(record.selectionRequirements.length > 0);
    assert.equal(new Set(record.selectionRequirements.map(item => item.id)).size, record.selectionRequirements.length);
    assert.ok(record.selectionRequirements.every(item => item.label && item.detail && item.sourceUrl && item.sourceSection && item.sourceCheckedAt));
    assert.ok(record.notes.length >= 2);
    assert.deepEqual(assess(record, context).errors, [], record.id);
    const resolved = resolveHumanRegimen(record, context);
    assert.equal(resolved.valid, true, `${record.id}: ${resolved.errors.join('; ')}`);
    assert.equal(resolved.dose, record.dose);
    assert.equal(resolved.frequency, record.frequency);
  }
});

test('source dose, phase and whole-tablet arithmetic are not transferred between indications', () => {
  // Independent expectations transcribed from EMA section 4.2. No dose is
  // inferred from another record or from a generic substance maximum.
  const expected = [
    ['eliquis-nvaf-standard', 5, 2, 'eliquis-5', 1],
    ['eliquis-nvaf-two-criteria', 2.5, 2, 'eliquis-2.5', 1],
    ['eliquis-nvaf-severe-renal', 2.5, 2, 'eliquis-2.5', 1],
    ['eliquis-vte-initial', 10, 2, 'eliquis-5', 2],
    ['eliquis-vte-continuation', 5, 2, 'eliquis-5', 1],
    ['eliquis-vte-extended', 2.5, 2, 'eliquis-2.5', 1],
    ['eliquis-post-hip', 2.5, 2, 'eliquis-2.5', 1],
    ['eliquis-post-knee', 2.5, 2, 'eliquis-2.5', 1],
    ['xarelto-nvaf-standard', 20, 1, 'xarelto-20', 1],
    ['xarelto-nvaf-renal', 15, 1, 'xarelto-15', 1],
    ['xarelto-vte-initial', 15, 2, 'xarelto-15', 1],
    ['xarelto-vte-continuation', 20, 1, 'xarelto-20', 1],
    ['xarelto-vte-renal-reduced', 15, 1, 'xarelto-15', 1],
    ['xarelto-vte-extended-high-risk', 20, 1, 'xarelto-20', 1],
  ];
  for (const [id, dose, frequency, formId, tablets] of expected) {
    const record = byId(id), form = formById(formId), context = eligibleContext(record);
    assert.deepEqual([record.dose, record.frequency, record.formIds], [dose, frequency, [formId]], id);
    const result = calculate({
      ...form, ...context, patientKind: 'human', doseMode: 'fixed',
      packageSize: form.packOptions[0].quantity,
      maxDailyMg: record.maxDailyMg ?? null,
    });
    assert.equal(result.valid, true, `${id}: ${result.errors.join('; ')}`);
    assert.equal(result.singleUnits, tablets, id);
    assert.equal(result.dailyMg, dose * frequency, id);
  }
});

test('apixaban NVAF uses all three independent reduction criteria at inclusive boundaries', () => {
  const standard = byId('eliquis-nvaf-standard');
  const reduced = byId('eliquis-nvaf-two-criteria');
  for (const [age, weight, serumCreatinine, reduction] of [
    [79.99, 60.01, 1.49, false],
    [80, 60.01, 1.49, false],
    [79.99, 60, 1.49, false],
    [79.99, 60.01, 1.5, false],
    [80, 60, 1.49, true],
    [80, 60.01, 1.5, true],
    [79.99, 60, 1.5, true],
    [80, 60, 1.5, true],
  ]) {
    const input = { age, weight, serumCreatinine, crcl: 50 };
    assert.equal(assess(standard, contextFor(standard, input)).errors.length === 0, !reduction, JSON.stringify(input));
    assert.equal(assess(reduced, contextFor(reduced, input)).errors.length === 0, reduction, JSON.stringify(input));
  }
  for (const record of [standard, reduced]) {
    for (const field of ['age', 'weight', 'serumCreatinine']) {
      for (const value of [undefined, null, '', NaN, Infinity, -1, '80']) {
        assert.ok(assess(record, { ...eligibleContext(record), [field]: value }).errors.length, `${record.id} ${field} ${value}`);
      }
    }
    assert.ok(assess(record, { ...eligibleContext(record), age: 80 * 365, ageUnit: 'days' })
      .errors.some(message => message.includes('niejednoznaczny')));
  }
  assert.deepEqual(assess(reduced, contextFor(reduced, { age: 960, ageUnit: 'months', weight: 60 })).errors, []);
});

test('renal bands are half-open at 30 and 50 and never substitute eGFR or a normal-status flag for CrCl', () => {
  for (const [id, accepted, rejected] of [
    ['eliquis-nvaf-standard', [30, 50, 80], [14.999, 15, 29.999]],
    ['eliquis-nvaf-two-criteria', [30, 50, 80], [14.999, 15, 29.999]],
    ['eliquis-nvaf-severe-renal', [15, 29, 29.999], [14.999, 30, 50]],
    ['xarelto-nvaf-standard', [50, 80], [14.999, 15, 49.999]],
    ['xarelto-nvaf-renal', [15, 30, 49.999], [14.999, 50, 80]],
    ['xarelto-vte-renal-reduced', [15, 30, 49.999], [14.999, 50, 80]],
  ]) {
    const record = byId(id), context = eligibleContext(record);
    for (const crcl of accepted) assert.deepEqual(assess(record, { ...context, crcl }).errors, [], `${id}: ${crcl}`);
    for (const crcl of rejected) assert.ok(assess(record, { ...context, crcl }).errors.length, `${id}: ${crcl}`);
  }
  for (const record of records) {
    for (const crcl of [undefined, null, '', '60', NaN, Infinity, -1, 0, 14.999]) {
      const context = { ...eligibleContext(record), crcl, egfr: 90, renalStatus: 'normal' };
      assert.ok(assess(record, context).errors.length, `${record.id}: ${crcl}`);
    }
  }
});

test('NVAF age/weight/creatinine reduction does not lower VTE or postoperative doses', () => {
  for (const id of ['eliquis-vte-initial', 'eliquis-vte-continuation', 'eliquis-vte-extended', 'eliquis-post-hip', 'eliquis-post-knee']) {
    const record = byId(id);
    const context = contextFor(record, { age: 85, weight: 50, serumCreatinine: 2, crcl: 20 });
    const checked = assess(record, context);
    assert.deepEqual(checked.errors, [], id);
    assert.ok(checked.warnings.some(message => message.includes('15–<30')), id);
    assert.equal(checked.requirements.includes('serumCreatinine'), false, id);
    const resolved = resolveHumanRegimen(record, context);
    assert.equal(resolved.dose, record.dose, id);
    assert.equal(resolved.frequency, record.frequency, id);
  }
  const renalNvaf = byId('eliquis-nvaf-severe-renal');
  assert.deepEqual(assess(renalNvaf, contextFor(renalNvaf,
    { crcl: 20, age: 50, weight: 80, serumCreatinine: undefined })).errors, []);
});

test('rivaroxaban VTE renal reduction stays separate from NVAF and initial twice-daily treatment', () => {
  const initial = byId('xarelto-vte-initial'), reduced = byId('xarelto-vte-renal-reduced');
  assert.deepEqual(assess(initial, contextFor(initial, { crcl: 20 })).errors, []);
  assert.ok(assess(initial, contextFor(initial, { crcl: 20, frequency: 1 })).errors.length);
  assert.equal(initial.frequency, 2);
  assert.equal(reduced.frequency, 1);
  assert.ok(reduced.selectionRequirements.some(item => item.id === 'rivaroxaban-vte-bleeding-over-recurrence'));
  assert.ok(assess(reduced, eligibleContext(reduced)).warnings.some(message => message.includes('nie została zbadana klinicznie')));
  const extended = byId('xarelto-vte-extended-high-risk');
  assert.ok(extended.selectionRequirements.some(item => item.id === 'anticoagulant-vte-six-months'));
  assert.ok(extended.selectionRequirements.some(item => item.id === 'rivaroxaban-vte-high-recurrence-risk'));
  assert.ok(extended.notes.some(note => note.includes('10 mg raz/dobę')));
});

test('full initial phases and postoperative ranges remain exact; months are not forged into supply-day minima', () => {
  for (const [id, fixedDays] of [['eliquis-vte-initial', 7], ['xarelto-vte-initial', 21]]) {
    const record = byId(id), context = eligibleContext(record);
    assert.equal(record.fixedDays, fixedDays);
    for (const days of [fixedDays - 1, fixedDays + 1, 90])
      assert.equal(resolveHumanRegimen(record, { ...context, days }).valid, false, `${id}: ${days}`);
  }
  for (const [id, min, max] of [['eliquis-post-hip', 32, 38], ['eliquis-post-knee', 10, 14]]) {
    const record = byId(id), context = eligibleContext(record);
    assert.equal(resolveHumanRegimen(record, { ...context, days: min }).valid, true);
    assert.equal(resolveHumanRegimen(record, { ...context, days: max }).valid, true);
    assert.equal(resolveHumanRegimen(record, { ...context, days: min - 1 }).valid, false);
    assert.equal(resolveHumanRegimen(record, { ...context, days: max + 1 }).valid, false);
  }
  for (const id of ['eliquis-vte-continuation', 'eliquis-vte-extended', 'xarelto-vte-continuation',
    'xarelto-vte-renal-reduced', 'xarelto-vte-extended-high-risk']) {
    const record = byId(id);
    assert.equal(record.minDays, undefined, id);
    assert.equal(record.fixedDays, undefined, id);
    assert.equal(record.maxDays, undefined, id);
  }
});

test('only explicit source maxima are published as numeric ceilings, scoped to the chosen indication', () => {
  const ceilings = records.filter(record => record.maxDailyMg != null)
    .map(record => [record.id, record.maxDailyMg]);
  assert.deepEqual(ceilings, [
    ['cardio-eliquis-vte-initial', 20],
    ['cardio-eliquis-vte-continuation', 10],
    ['cardio-eliquis-vte-extended', 5],
    ['cardio-xarelto-nvaf-standard', 20],
  ]);
  for (const record of records.filter(record => record.maxDailyMg != null)) assert.ok(record.limitLabel);
  assert.ok(records.every(record => record.maxSingleMg == null));
  assert.ok(records.filter(record => record.id.includes('xarelto')).every(record => record.administration.includes('z posiłkiem')));
});

test('fixed source schedules cannot silently become different anticoagulant phases', () => {
  for (const record of records) {
    const context = eligibleContext(record);
    assert.ok(assess(record, { ...context, dose: record.dose * 2 }).errors.length, record.id);
    assert.ok(assess(record, { ...context, frequency: record.frequency === 1 ? 2 : 1 }).errors.length, record.id);
    const before = structuredClone(context);
    assess(record, context);
    assert.deepEqual(context, before, record.id);
  }
  assert.deepEqual(assess({}, {}), { errors: [], warnings: [], requirements: [] });
  assert.ok(assess({ anticoagulantRule: 'unreviewed-variant' }, {}).errors.length);
  assert.ok(assess(byId('eliquis-vte-initial'), null).errors.length);
});

test('integrated resolver requires explicit source-specific confirmations and preserves locked phase doses', () => {
  for (const record of records) {
    const context = eligibleContext(record);
    assert.equal(resolveHumanRegimen(record, { ...context, sourceConfirmations: [] }).valid, false, record.id);
    assert.equal(resolveHumanRegimen(record, { ...context, sourceConfirmations: ['unrelated-confirmation'] }).valid, false, record.id);
    assert.equal(resolveHumanRegimen(record, { ...context, dose: record.dose * 2 }, { allowNumericOverrides: true }).valid, false, record.id);
  }
});
