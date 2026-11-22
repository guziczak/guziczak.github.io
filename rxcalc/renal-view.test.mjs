import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCrClEstimate, renalPanelMarkup, renalResultMarkup, updateRenalPanel } from './renal-view.js';

const numericDisplay = text => Number(text.replace(/^≈\s*/, '').replace(',', '.'));

test('CrCl formatting keeps both sides of renal thresholds visibly distinct', () => {
  for (const threshold of [15, 30, 50]) {
    for (const value of [threshold - 0.001, threshold + 0.001,
      threshold - 0.00000000001, threshold + 0.00000000001]) {
      const formatted = formatCrClEstimate(value, [15, 30, 50]);
      const shown = numericDisplay(formatted);
      assert.equal(shown < threshold, value < threshold, `${value}: ${formatted}`);
      assert.equal(shown > threshold, value > threshold, `${value}: ${formatted}`);
    }
    assert.equal(formatCrClEstimate(threshold, [15, 30, 50]), String(threshold));
  }
  assert.equal(formatCrClEstimate(29.999, [30]), '29,999');
  assert.equal(formatCrClEstimate(30.001, [30]), '30,001');
});

test('small positive CrCl never appears as zero and ordinary rounded estimates are marked approximate', () => {
  assert.equal(formatCrClEstimate(0.001, [15, 30, 50]), '0,001');
  assert.ok(numericDisplay(formatCrClEstimate(1e-12, [15, 30, 50])) > 0);
  assert.equal(formatCrClEstimate(36.833333333333336, [15, 30, 50]), '≈ 36,83');
  assert.equal(formatCrClEstimate(72, [15, 30, 50]), '72');
  for (const value of [null, undefined, NaN, Infinity, 0, -1, '30'])
    assert.equal(formatCrClEstimate(value, [15, 30, 50]), '—');
});

test('initial and live result rendering preserve threshold-aware text and full value detail', () => {
  const state = { ignoreCrCl: false, renalInputMode: 'calculate' };
  const assessment = { crcl: 29.999, valid: true, weightUsedKg: 72, weightKind: 'actual', issues: [] };
  const options = { state, assessment, thresholds: [15, 30, 50] };
  const markup = renalResultMarkup(options);
  assert.match(markup, /title="29,999 ml\/min"/);
  assert.match(markup, />29,999 <small>ml\/min<\/small>/);
  const output = { innerHTML: '' };
  const root = { querySelector: selector => selector === '#renal-panel' ? {}
    : selector === '#renal-result' ? output : null };
  updateRenalPanel(root, options);
  assert.equal(output.innerHTML, markup);
  updateRenalPanel(root, { ...options, assessment: { ...assessment, crcl: 30.001 } });
  assert.match(output.innerHTML, />30,001 <small>ml\/min<\/small>/);
  assert.equal(renalResultMarkup({ ...options, state: { ignoreCrCl: false, renalInputMode: 'manual' } }), '');
});

test('ignoring CrCl hides manual and calculated inputs without showing a stale estimate', () => {
  const assessment = { crcl: 29.999, valid: true, weightUsedKg: 72, weightKind: 'actual', issues: [] };
  for (const renalInputMode of ['manual', 'calculate']) {
    const state = { ignoreCrCl: true, renalInputMode, humanCrCl: '25', humanSerumCreatinine: '1,8',
      renalCreatinineUnit: 'mg/dl', renalSex: 'female', renalCalculationWeight: '65', renalCalculationReviewed: true };
    const before = structuredClone(state);
    const markup = renalPanelMarkup({ state, assessment, required: true });
    assert.match(markup, /id="ignoreCrCl"[^>]*aria-label="Ignoruj CrCl"[^>]*checked/);
    assert.match(markup, /<span>Ignoruj<\/span>/);
    assert.match(markup, /CrCl pominięty/);
    assert.doesNotMatch(markup, /id="(?:humanCrCl|humanSerumCreatinine|renalSex|renalCalculationWeight|renalCalculationReviewed)"/);
    assert.doesNotMatch(markup, /class="renal-modes"|class="renal-estimate"|29,999/);
    assert.deepEqual(state, before);
  }
});

test('a state without an ignore preference uses the checked application default', () => {
  const markup = renalPanelMarkup({ state: { renalInputMode: 'manual', humanCrCl: '60' }, assessment: {} });
  assert.match(markup, /id="ignoreCrCl"[^>]*checked/);
  assert.match(markup, /CrCl pominięty/);
  assert.doesNotMatch(markup, /id="humanCrCl"/);
});

test('unchecking ignore restores retained manual values and the selected calculation mode', () => {
  const assessment = { crcl: 29.999, valid: true, weightUsedKg: 65, weightKind: 'clinician-selected', issues: [] };
  const state = { ignoreCrCl: true, renalInputMode: 'manual', humanCrCl: '25', humanSerumCreatinine: '1,8',
    renalCreatinineUnit: 'mg/dl', renalSex: 'female', renalCalculationWeight: '65', renalCalculationReviewed: true };
  renalPanelMarkup({ state, assessment, required: true });
  const manual = renalPanelMarkup({ state: { ...state, ignoreCrCl: false }, assessment, required: true });
  assert.match(manual, /id="ignoreCrCl"[^>]*>/);
  assert.doesNotMatch(manual, /id="ignoreCrCl"[^>]*checked/);
  assert.match(manual, /id="humanCrCl"[^>]*value="25"[^>]*required/);
  assert.doesNotMatch(manual, /CrCl pominięty/);
  const calculated = renalPanelMarkup({ state: { ...state, ignoreCrCl: false, renalInputMode: 'calculate' },
    assessment, thresholds: [30], required: true });
  assert.match(calculated, /data-value="calculate" aria-pressed="true"/);
  assert.match(calculated, /id="humanSerumCreatinine"[^>]*value="1,8"[^>]*required/);
  assert.match(calculated, /value="female" selected/);
  assert.match(calculated, /id="renalCalculationWeight"[^>]*value="65"/);
  assert.match(calculated, /id="renalCalculationReviewed"[^>]*checked/);
  assert.match(calculated, />29,999 <small>ml\/min<\/small>/);
});

test('ignoring CrCl keeps independent apixaban creatinine available with only its own requirement', () => {
  const state = { ignoreCrCl: true, renalInputMode: 'calculate', humanSerumCreatinine: '132,6',
    renalCreatinineUnit: 'umol/l' };
  for (const requiresCreatinine of [true, false]) {
    const criteria = { requiresCreatinine, reduction: requiresCreatinine ? null : true,
      creatinine: null, minimumCount: requiresCreatinine ? 1 : 2 };
    const markup = renalPanelMarkup({ state, assessment: {}, criteria, required: true });
    const field = markup.match(/<input id="humanSerumCreatinine"[^>]*>/)?.[0];
    assert.ok(field);
    assert.equal(/\brequired\b/.test(field), requiresCreatinine);
    assert.match(field, /value="132,6"/);
    assert.match(markup, /value="umol\/l" selected/);
    assert.match(markup, /Reguła 2 z 3:/);
    assert.doesNotMatch(markup, /CrCl jest oceniany osobno|id="renalSex"|id="humanCrCl"/);
  }
});

test('live ignored view clears an estimate and updates independent creatinine requirements', () => {
  const nodes = {
    '#renal-panel': {}, '#ignoreCrCl': { checked: false },
    '#renal-result': { innerHTML: '<strong>72 ml/min</strong>' },
    '#humanSerumCreatinine': { required: true }, '#renal-creatinine-label': { textContent: '' },
    '#renal-criteria': { hidden: true, textContent: '' },
  };
  const root = { querySelector: selector => nodes[selector] || null };
  const options = { state: { ignoreCrCl: true, renalInputMode: 'calculate' },
    assessment: { crcl: 72, valid: true },
    criteria: { requiresCreatinine: false, reduction: true, creatinine: null, minimumCount: 2 } };
  updateRenalPanel(root, options);
  assert.equal(nodes['#ignoreCrCl'].checked, true);
  assert.match(nodes['#renal-result'].innerHTML, /CrCl pominięty/);
  assert.doesNotMatch(nodes['#renal-result'].innerHTML, /72|renal-estimate/);
  assert.equal(nodes['#humanSerumCreatinine'].required, false);
  assert.match(nodes['#renal-creatinine-label'].textContent, /opcjonalnie/);
  assert.doesNotMatch(nodes['#renal-criteria'].textContent, /CrCl jest oceniany/);
  updateRenalPanel(root, { ...options, criteria: { ...options.criteria, requiresCreatinine: true, reduction: null } });
  assert.equal(nodes['#humanSerumCreatinine'].required, true);
  assert.doesNotMatch(nodes['#renal-creatinine-label'].textContent, /opcjonalnie/);
});
