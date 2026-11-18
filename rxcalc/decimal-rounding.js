/**
 * Decimal-place controls for continuous quantities of a preparation.
 * This module selects an arithmetic step, never a clinically allowed dose.
 * Pass the returned step to the existing calculate() and validation paths so
 * actual mg, course quantity and package counts all use the rounded amount.
 */
export const DECIMAL_PLACES = Object.freeze([0, 1, 2, 3]);

const continuousUnits = Object.freeze({
  suspension: 'ml', solution: 'ml', injection: 'ml',
  oralPaste: 'g', oralPowder: 'g', oralGel: 'g', gel: 'g',
});
const present = value => value !== null && value !== undefined && value !== '';
const precisionValue = value => typeof value === 'number' ? value
  : typeof value === 'string' && /^[0-3]$/.test(value.trim()) ? Number(value.trim()) : NaN;

/** Blank or malformed selections must not silently become zero places. */
export function normalizeDecimalPlaces(value, fallback = 2) {
  const parsed = precisionValue(value);
  if (DECIMAL_PLACES.includes(parsed)) return parsed;
  const defaultValue = precisionValue(fallback);
  return DECIMAL_PLACES.includes(defaultValue) ? defaultValue : 2;
}

/** Discrete units and product-specific device divisions retain their own rules. */
export function supportsDecimalRounding(form, source = null) {
  if (!form || typeof form !== 'object' || Array.isArray(form)
    || form.referenceOnly || form.calculationBlocked
    || form.calculationMode === 'instruction' || source?.doseMode === 'instruction') return false;
  const expected = continuousUnits[form.form];
  if (!expected || typeof form.unitLabel !== 'string'
    || form.unitLabel.trim().toLowerCase() !== expected) return false;
  // Even malformed device metadata must not be hidden by decimal rounding.
  return !present(form.doseStepUnits) && !present(source?.doseStepUnits);
}

/**
 * baselineStep is the caller's numeric/null source or manual arithmetic step.
 * Preserve it exactly when off; malformed baseline data must still reach the
 * engine's validation rather than being silently corrected by this control.
 */
export function effectiveRoundingStep({enabled = false, places = 2,
  form = null, source = null, baselineStep = null} = {}) {
  if (enabled !== true || !supportsDecimalRounding(form, source)) return baselineStep;
  return 10 ** -normalizeDecimalPlaces(places);
}
