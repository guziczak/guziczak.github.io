import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCrClEstimate, renalResultMarkup, updateRenalPanel } from './renal-view.js';

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
  const state = { renalInputMode: 'calculate' };
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
  assert.equal(renalResultMarkup({ ...options, state: { renalInputMode: 'manual' } }), '');
});
