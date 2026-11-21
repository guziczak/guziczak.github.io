/**
 * Renal input normalization and an explicitly scoped adult Cockcroft–Gault
 * estimator. `valid` means these inputs can be used as entered/calculated; it
 * does NOT approve a dose, indication, prescription, or overall renal status.
 *
 * Formula: ((140 - age in years) * selected weight in kg) / (72 * SCr in
 * mg/dl), multiplied by 0.85 for female. Both unit paths use this same formula;
 * the rounded SI coefficients 1.23/1.04 are deliberately not mixed with it.
 * No rounding, low-creatinine substitution, weight inference, or eGFR import.
 *
 * The automatic path requires an explicit review of stable renal function and
 * the weight used. Weight selection at extremes of body composition is a
 * clinical decision. An optional clinician-selected weight is used as entered;
 * this module does not infer ideal/adjusted weight. Assessed CrCl remains a
 * separate manual path for cases outside this estimator's scope.
 */
export const RENAL_FUNCTION_SOURCES = Object.freeze({
  checkedAt: '2026-11-21',
  formula: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d63d360a-15ec-44a4-b80d-b2a5cb5759eb',
  unitConversion: 'https://www.niddk.nih.gov/research-funding/research-programs/kidney-clinical-research-epidemiology/laboratory/glomerular-filtration-rate-equations/adults',
  scope: 'https://www.gov.uk/drug-safety-update/prescribing-medicines-in-renal-impairment-using-the-appropriate-estimate-of-renal-function-to-avoid-the-risk-of-adverse-drug-reactions',
  stabilityAndWeight: 'https://sps.nhs.uk/articles/calculating-kidney-function/',
  doacMonitoring: 'https://sps.nhs.uk/monitorings/doacs-direct-oral-anticoagulants-monitoring/',
});

export const CREATININE_UMOL_PER_MG_DL = 88.4;
const CREATININE_UNITS = new Set(['mg/dl', 'umol/l']);
const absent = value => value === undefined || value === null
  || typeof value === 'string' && value.trim() === '';
const positive = value => Number.isFinite(value) && value > 0;

/** Plain decimal input only; no coercion of booleans, arrays, units or eGFR. */
export function parseRenalNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(raw)) return null;
  const parsed = Number(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function decimalRatio(value) {
  // value is already a positive finite Number. Its shortest decimal form is
  // the canonical entered number; an exponent here comes only from Number,
  // never from permissively parsing an exponent/unit in a user's text field.
  const [, whole, fraction = '', exponent = '0'] = String(value)
    .match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/);
  const coefficient = BigInt(whole + fraction);
  const scale = Number(exponent) - fraction.length;
  return scale >= 0 ? [coefficient * 10n ** BigInt(scale), 1n]
    : [coefficient, 10n ** BigInt(-scale)];
}

function ratioToNumber(numerator, denominator) {
  // Round only the exact rational-to-IEEE-754 representation, ties to even.
  // This is not display/clinical rounding: no number of decimal places or
  // threshold tolerance is introduced. Integer division avoids intermediate
  // floating drift in e.g. 1.51 * 88.4 and overflow of large finite ratios.
  let exponent = numerator.toString(2).length - denominator.toString(2).length;
  if (exponent >= 0 ? numerator < denominator << BigInt(exponent)
    : numerator << BigInt(-exponent) < denominator) exponent--;
  if (exponent > 1023) return Infinity;
  const shift = exponent < -1022 ? 1074 : 52 - exponent;
  const scaledNumerator = shift >= 0 ? numerator << BigInt(shift) : numerator;
  const scaledDenominator = shift >= 0 ? denominator : denominator << BigInt(-shift);
  let significand = scaledNumerator / scaledDenominator;
  const remainder = scaledNumerator % scaledDenominator;
  if (remainder * 2n > scaledDenominator
      || remainder * 2n === scaledDenominator && significand % 2n !== 0n) significand++;
  return Number(significand) * 2 ** (exponent < -1022 ? -1074 : exponent - 52);
}

/** Preserve the physical value on unit changes. A null result is not a zero. */
export function convertCreatinine(value, fromUnit, toUnit) {
  const parsed = parseRenalNumber(value);
  if (!positive(parsed) || !CREATININE_UNITS.has(fromUnit) || !CREATININE_UNITS.has(toUnit)) return null;
  if (fromUnit === toUnit) return parsed;
  const [numerator, denominator] = decimalRatio(parsed);
  const converted = fromUnit === 'mg/dl' ? ratioToNumber(numerator * 884n, denominator * 10n)
    : ratioToNumber(numerator * 10n, denominator * 884n);
  return positive(converted) ? converted : null;
}

/**
 * @param {object} input
 * @param {'manual'|'calculate'} input.mode
 * @param {number|string} [input.crcl] Clinically assessed CrCl in ml/min.
 * @param {number|string} [input.serumCreatinine]
 * @param {'mg/dl'|'umol/l'} [input.creatinineUnit]
 * @param {number|string} [input.age]
 * @param {'years'|'months'|'days'} [input.ageUnit] Adult estimates accept years
 *   or months; days require re-entry in years/months, not an assumed year length.
 * @param {number|string} [input.weight] Actual patient weight in kg.
 * @param {'female'|'male'} [input.sex] Explicit sex coefficient for the formula.
 * @param {number|string} [input.calculationWeight] Optional clinician-selected
 *   weight in kg, distinct from actual patient weight and other dose criteria.
 * @param {boolean} [input.renalStable] True only after clinical review.
 * @param {boolean} [input.weightReviewed] True only after review of used weight.
 */
export function assessRenalInput(input = {}) {
  const result = {
    mode: null, method: null, crcl: null, serumCreatinineMgDl: null,
    ageYears: null, actualWeightKg: null, weightUsedKg: null, weightKind: null,
    valid: false, issues: [],
  };
  const issue = (code, field, kind, message) => result.issues.push({ code, field, kind, message });
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    issue('renal-input-invalid', 'mode', 'invalid', 'Podaj poprawne dane oceny czynności nerek.');
    return result;
  }
  if (!['manual', 'calculate'].includes(input.mode)) {
    issue(absent(input.mode) ? 'renal-mode-required' : 'renal-mode-invalid', 'mode',
      absent(input.mode) ? 'missing' : 'invalid', 'Wybierz sposób podania CrCl.');
    return result;
  }
  result.mode = input.mode;
  result.method = input.mode === 'manual' ? 'assessed-crcl' : 'cockcroft-gault';

  const calculate = input.mode === 'calculate';
  const hasCreatinine = !absent(input.serumCreatinine);
  const creatinine = parseRenalNumber(input.serumCreatinine);
  if (!hasCreatinine) {
    if (calculate) issue('creatinine-required', 'serumCreatinine', 'missing', 'Uzupełnij kreatyninę w surowicy.');
  } else if (!positive(creatinine)) {
    issue('creatinine-invalid', 'serumCreatinine', 'invalid', 'Podaj dodatnią, skończoną wartość kreatyniny.');
  }
  if (!CREATININE_UNITS.has(input.creatinineUnit)
      && (calculate || hasCreatinine || !absent(input.creatinineUnit))) {
    issue(absent(input.creatinineUnit) ? 'creatinine-unit-required' : 'creatinine-unit-invalid',
      'creatinineUnit', absent(input.creatinineUnit) ? 'missing' : 'invalid',
      'Wybierz jednostkę kreatyniny: mg/dl lub µmol/l.');
  } else if (hasCreatinine && positive(creatinine)) {
    result.serumCreatinineMgDl = convertCreatinine(creatinine, input.creatinineUnit, 'mg/dl');
    if (result.serumCreatinineMgDl === null)
      issue('creatinine-conversion-invalid', 'serumCreatinine', 'invalid', 'Wartość kreatyniny nie pozwala na poprawne przeliczenie jednostek.');
  }

  // Manual CrCl and optional creatinine are independent inputs. Keep a valid
  // assessed CrCl even if a separately entered creatinine needs correction;
  // issues/valid still report that correction and never silently drop it.
  if (!calculate) {
    const crcl = parseRenalNumber(input.crcl);
    if (absent(input.crcl)) issue('crcl-required', 'crcl', 'missing', 'Uzupełnij oceniony CrCl w ml/min.');
    else if (!positive(crcl)) issue('crcl-invalid', 'crcl', 'invalid', 'Podaj dodatni, skończony CrCl w ml/min.');
    else result.crcl = crcl;
    result.valid = result.issues.length === 0;
    return result;
  }

  const age = parseRenalNumber(input.age);
  if (absent(input.age)) issue('age-required', 'age', 'missing', 'Uzupełnij wiek do obliczenia CrCl.');
  else if (!positive(age)) issue('age-invalid', 'age', 'invalid', 'Podaj prawidłowy wiek do obliczenia CrCl.');
  if (!['years', 'months', 'days'].includes(input.ageUnit)) {
    issue(absent(input.ageUnit) ? 'age-unit-required' : 'age-unit-invalid', 'ageUnit',
      absent(input.ageUnit) ? 'missing' : 'invalid', 'Wybierz jednostkę wieku.');
  } else if (input.ageUnit === 'days') {
    issue('age-days-unsupported', 'ageUnit', 'out-of-scope', 'Do obliczenia CrCl dorosłego podaj wiek w latach lub miesiącach.');
  } else if (positive(age)) {
    result.ageYears = input.ageUnit === 'months' ? age / 12 : age;
    if (result.ageYears < 18) issue('age-adult-only', 'age', 'out-of-scope', 'Ten wzór CrCl jest dostępny wyłącznie dla dorosłych.');
    else if (result.ageYears >= 140) issue('age-invalid', 'age', 'invalid', 'Podaj prawidłowy wiek do obliczenia CrCl.');
  }

  const actualWeight = parseRenalNumber(input.weight);
  if (absent(input.weight)) issue('weight-required', 'weight', 'missing', 'Uzupełnij rzeczywistą masę ciała w kg.');
  else if (!positive(actualWeight) || actualWeight > 500)
    issue('weight-invalid', 'weight', 'invalid', 'Podaj prawidłową rzeczywistą masę ciała w kg (do 500 kg).');
  else result.actualWeightKg = actualWeight;

  if (absent(input.calculationWeight)) {
    result.weightUsedKg = result.actualWeightKg;
    result.weightKind = 'actual';
  } else {
    result.weightKind = 'clinician-selected';
    const calculationWeight = parseRenalNumber(input.calculationWeight);
    if (!positive(calculationWeight) || calculationWeight > 500)
      issue('calculation-weight-invalid', 'calculationWeight', 'invalid', 'Podaj prawidłową masę wybraną do wzoru w kg (do 500 kg).');
    else result.weightUsedKg = calculationWeight;
  }
  if (!['female', 'male'].includes(input.sex))
    issue(absent(input.sex) ? 'sex-required' : 'sex-invalid', 'sex',
      absent(input.sex) ? 'missing' : 'invalid', 'Wybierz płeć używaną we wzorze Cockcrofta–Gaulta.');

  if (input.renalStable === false)
    issue('renal-function-unstable', 'renalStable', 'out-of-scope', 'Przy niestabilnej czynności nerek nie stosuj tego oszacowania CrCl; potrzebna jest odrębna ocena kliniczna.');
  else if (input.renalStable !== true)
    issue(absent(input.renalStable) ? 'renal-stability-required' : 'renal-stability-invalid', 'renalStable',
      absent(input.renalStable) ? 'missing' : 'invalid', 'Potwierdź stabilność czynności nerek dla tego oszacowania.');
  if (input.weightReviewed !== true)
    issue(absent(input.weightReviewed) || input.weightReviewed === false ? 'calculation-weight-review-required' : 'calculation-weight-review-invalid',
      'weightReviewed', absent(input.weightReviewed) || input.weightReviewed === false ? 'missing' : 'invalid',
      'Potwierdź przydatność wybranej masy do wzoru Cockcrofta–Gaulta.');

  if (!result.issues.length) {
    const crcl = ((140 - result.ageYears) * result.weightUsedKg)
      / (72 * result.serumCreatinineMgDl) * (input.sex === 'female' ? 0.85 : 1);
    if (positive(crcl)) result.crcl = crcl;
    else issue('crcl-calculation-invalid', 'serumCreatinine', 'invalid', 'Te dane nie pozwalają uzyskać poprawnego oszacowania CrCl.');
  }
  result.valid = result.issues.length === 0 && result.crcl !== null;
  return result;
}
