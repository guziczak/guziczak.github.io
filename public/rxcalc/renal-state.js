import { assessRenalInput, convertCreatinine } from './renal-function.js';

export const RENAL_STATE_DEFAULTS = Object.freeze({
  ignoreCrCl: true,
  renalInputMode: 'manual', renalCreatinineUnit: 'mg/dl', renalSex: '',
  renalCalculationWeight: '', renalCalculationReviewed: false,
  renalCreatinineSource: null,
});
export const RENAL_STATE_FIELDS = Object.freeze(Object.keys(RENAL_STATE_DEFAULTS));

export function isCrClIgnored(state = {}) {
  return (state.ignoreCrCl ?? RENAL_STATE_DEFAULTS.ignoreCrCl) === true;
}

/** Unit-only changes retain the original laboratory input. Repeated conversion
 * of the displayed Number can otherwise move a value across a clinical cutoff.
 * The display guard also rejects a retained source after a direct input edit.
 */
export function renalCreatinineInput(state = {}) {
  const retained = state.renalCreatinineSource;
  if (retained && typeof retained === 'object' && !Array.isArray(retained)
      && retained.displayUnit === state.renalCreatinineUnit
      && retained.displayValue === String(state.humanSerumCreatinine ?? '')
      && convertCreatinine(retained.value, retained.unit, 'mg/dl') !== null) {
    return { value: retained.value, unit: retained.unit, retained: true };
  }
  return { value: state.humanSerumCreatinine, unit: state.renalCreatinineUnit ?? 'mg/dl', retained: false };
}

function decimalText(value) {
  const raw = String(value);
  if (!/[eE]/.test(raw)) return raw.replace('.', ',');
  const [mantissa, exponent] = raw.toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const digits = whole + fraction, position = whole.length + Number(exponent);
  const text = position <= 0 ? `0.${'0'.repeat(-position)}${digits}`
    : position >= digits.length ? digits + '0'.repeat(position - digits.length)
    : `${digits.slice(0, position)}.${digits.slice(position)}`;
  return text.replace('.', ',');
}

/** Pure state patch: call on a unit selection, never on a laboratory text edit. */
export function renalCreatinineUnitChange(state = {}, unit) {
  if (!['mg/dl', 'umol/l'].includes(unit)) return {};
  const original = renalCreatinineInput(state);
  const converted = convertCreatinine(original.value, original.unit, unit);
  if (converted === null) return { renalCreatinineUnit: unit, renalCreatinineSource: null };
  const display = unit === original.unit ? String(original.value) : decimalText(converted);
  return { renalCreatinineUnit: unit, humanSerumCreatinine: display,
    renalCreatinineSource: { value: original.value, unit: original.unit, displayValue: display, displayUnit: unit } };
}

export function renalAssessmentForState(state = {}) {
  const creatinine = renalCreatinineInput(state);
  return assessRenalInput({
    mode: state.renalInputMode ?? 'manual', crcl: state.humanCrCl,
    serumCreatinine: creatinine.value,
    creatinineUnit: creatinine.unit,
    age: state.age, ageUnit: state.humanAgeUnit ?? 'years', weight: state.weight,
    sex: state.renalSex, calculationWeight: state.renalCalculationWeight,
    renalStable: state.renalCalculationReviewed === true ? true : undefined,
    weightReviewed: state.renalCalculationReviewed === true ? true : undefined,
  });
}

/** Clinical rules consume the normalized value and explicit failed inputs.
 * Optional unentered values stay unknown. No stale manual value is substituted
 * while the user is working in calculation mode.
 */
export function renalRegimenContext(state, source) {
  const relevant = !!(source?.renalPolicy || source?.minCrCl != null || source?.maxCrCl != null || source?.requireCrCl);
  if (!relevant) return { crcl: null, serumCreatinine: null, renalIssues: [] };
  const usesCreatinine = source?.patientFields?.includes('serumCreatinine') === true;
  if (isCrClIgnored(state)) {
    // Serum creatinine may independently determine an NVAF dose criterion.
    // Validate that laboratory input without requiring the unused CG formula.
    const creatinine = renalCreatinineInput(state);
    const assessment = assessRenalInput({ mode: 'manual',
      serumCreatinine: creatinine.value, creatinineUnit: creatinine.unit });
    return { ignoreCrCl: true, crcl: null,
      serumCreatinine: usesCreatinine ? assessment.serumCreatinineMgDl : null,
      renalIssues: usesCreatinine ? assessment.issues.filter(item =>
        ['serumCreatinine', 'creatinineUnit'].includes(item.field)) : [] };
  }
  const assessment = renalAssessmentForState(state);
  const calculate = state.renalInputMode === 'calculate';
  const issues = assessment.issues.filter(item => {
    if (calculate) return true;
    if (item.field === 'crcl') return item.kind !== 'missing' || source.requireCrCl === true;
    return usesCreatinine;
  });
  return { crcl: assessment.crcl,
    serumCreatinine: usesCreatinine ? assessment.serumCreatinineMgDl : null,
    renalIssues: issues };
}
