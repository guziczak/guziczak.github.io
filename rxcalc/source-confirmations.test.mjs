import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceConfirmationsAfterEdit as afterEdit } from './source-confirmations.js';
import { CARDIO_ANTICOAGULANT_REGIMENS as sources } from './cardio-anticoagulant-regimens.js';

const byId = id => sources.find(source => source.id === `cardio-${id}`);
const all = source => source.selectionRequirements.map(requirement => requirement.id);
const renalFields = ['humanCrCl', 'humanSerumCreatinine', 'renalInputMode', 'renalCreatinineUnit',
  'renalSex', 'renalCalculationWeight', 'renalCalculationReviewed', 'renalStatus', 'renalImpairment', 'weight'];

test('reviewed NVAF indication survives renal or weight entry while renal review clears', () => {
  for (const id of ['eliquis-nvaf-standard', 'eliquis-nvaf-two-criteria', 'eliquis-nvaf-severe-renal',
    'xarelto-nvaf-standard', 'xarelto-nvaf-renal']) {
    const source = byId(id);
    for (const field of renalFields)
      assert.deepEqual(afterEdit(source, all(source), field), ['anticoagulant-nvaf-indication'], `${id}: ${field}`);
  }
});

test('age or age-unit edits clear NVAF indication because its risk factor can be age dependent', () => {
  for (const source of sources) {
    for (const field of ['age', 'humanAgeUnit', 'vetAgeUnit', 'patientType'])
      assert.deepEqual(afterEdit(source, all(source), field), [], `${source.id}: ${field}`);
  }
});

test('only separately reviewed apixaban phase confirmations survive renal changes', () => {
  for (const [id, confirmation] of [
    ['eliquis-vte-initial', 'apixaban-vte-initial-phase'],
    ['eliquis-vte-continuation', 'apixaban-vte-continuation-phase'],
  ]) {
    const source = byId(id);
    for (const field of renalFields) assert.deepEqual(afterEdit(source, all(source), field), [confirmation]);
    const noSeparateRenalScope = { ...source,
      selectionRequirements: source.selectionRequirements.filter(requirement => requirement.id !== 'apixaban-renal-scope') };
    assert.deepEqual(afterEdit(noSeparateRenalScope, [confirmation], 'humanCrCl'), []);
  }
});

test('risk and combined chronology/risk decisions are cleared conservatively', () => {
  for (const id of ['eliquis-vte-extended', 'eliquis-post-hip', 'eliquis-post-knee',
    'xarelto-vte-initial', 'xarelto-vte-continuation', 'xarelto-vte-renal-reduced',
    'xarelto-vte-extended-high-risk']) {
    const source = byId(id);
    for (const field of renalFields) assert.deepEqual(afterEdit(source, all(source), field), [], `${id}: ${field}`);
  }
});

test('unrecognised records, rules, fields and requirements never inherit exemptions', () => {
  const source = byId('eliquis-nvaf-standard');
  for (const invalid of [null, undefined, [], {}, { ...source, id: 'future-nvaf' },
    { ...source, anticoagulantRule: 'future-rule' }, { ...source, selectionRequirements: null }])
    assert.deepEqual(afterEdit(invalid, all(source), 'humanCrCl'), []);
  for (const field of [undefined, null, '', 'source', 'regimenId', 'dose', 'frequency', 'days', 'future-field'])
    assert.deepEqual(afterEdit(source, all(source), field), []);
  const withUnknownCondition = { ...source,
    selectionRequirements: [...source.selectionRequirements, { id: 'future-renal-condition' }] };
  assert.deepEqual(afterEdit(withUnknownCondition, [...all(source), 'future-renal-condition'], 'humanCrCl'),
    ['anticoagulant-nvaf-indication']);
});

test('the helper never auto-confirms, keeps only existing selected IDs, and does not mutate inputs', () => {
  const source = byId('eliquis-nvaf-standard');
  for (const selected of [[], ['apixaban-renal-scope'], ['unrelated'], null, {}, 'anticoagulant-nvaf-indication'])
    assert.deepEqual(afterEdit(source, selected, 'humanCrCl'), []);
  const selected = Object.freeze(['anticoagulant-nvaf-indication', 'apixaban-renal-scope',
    'anticoagulant-nvaf-indication', 1, null]);
  const before = structuredClone(source);
  assert.deepEqual(afterEdit(source, selected, 'humanCrCl'), ['anticoagulant-nvaf-indication']);
  assert.deepEqual(source, before);
  assert.equal(selected.length, 5);
  assert.deepEqual(afterEdit({ ...source, selectionRequirements: [{ id: 'apixaban-renal-scope' }] },
    selected, 'humanCrCl'), []);
});
