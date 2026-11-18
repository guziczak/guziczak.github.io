import { calculate } from './engine.js';
import { resolveHumanRegimen } from './human-regimen-engine.js';
import { resolveRegimen } from './regimen-engine.js';

/** Compare the entered, actually administered quantities with the selected
 * source. This does not choose a course or establish clinical suitability.
 * Duration is assessed separately; neither days nor input values are mutated.
 */
const modes = new Set(['fixed', 'perKgDay', 'perKgDose', 'units']);
const has = value => value !== null && value !== undefined && value !== '';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const positive = value => finite(value) && value > 0;
// Arithmetic tolerance only: engine.js returns quantities at 14 significant
// digits. Allow their floating-point round trip, never a clinical percentage.
const near = (a, b) => finite(a) && finite(b)
  && Math.abs(a - b) <= Number.EPSILON * 256 * Math.max(1, Math.abs(a), Math.abs(b));
const result = (state, reasons = []) => ({ state, reasons: [...new Set(reasons.filter(Boolean))] });
const previewDays = source => source.fixedDays ?? source.minDays ?? 1;

function ageYears(context) {
  if (!finite(context.age)) return null;
  const factor = ({ years: 1, months: 1 / 12, weeks: 7 / 365, days: 1 / 365.25 })[context.ageUnit];
  return factor === undefined ? null : context.age * factor;
}

function conditionalLimit(form, context, age) {
  const tests = [
    ['minAge', age, (a, b) => a >= b], ['minAgeExclusive', age, (a, b) => a > b],
    ['maxAge', age, (a, b) => a <= b],
    ['minWeight', context.weight, (a, b) => a >= b],
    ['minWeightExclusive', context.weight, (a, b) => a > b],
    ['maxWeight', context.weight, (a, b) => a <= b],
  ];
  return (form.conditionalLimits || []).find(rule => tests.every(([key, value, compare]) =>
    !has(rule[key]) || finite(value) && compare(value, rule[key])));
}

function minimumLimit(values) {
  const supplied = values.filter(has);
  // Do not discard an invalid supplied ceiling and thereby relax its check.
  if (supplied.some(value => !positive(value))) return supplied.find(value => !positive(value));
  return supplied.length ? Math.min(...supplied) : null;
}

function missingContext(source, form, context, veterinary, instruction) {
  const reasons = [];
  if (!instruction && !has(context.doseMode)) reasons.push('Wybierz jednostkę wpisanej dawki, aby porównać schemat.');
  if (!instruction && !has(context.dose)) reasons.push('Uzupełnij dawkę, aby porównać cały schemat.');
  if ((!instruction || has(source.frequency) || source.frequencyOptions) && !has(context.frequency))
    reasons.push('Uzupełnij liczbę podań na dobę, aby porównać cały schemat.');
  const weightNeeded = veterinary || ['perKgDose', 'perKgDay'].includes(context.doseMode)
    || ['perKgDose', 'perKgDay'].includes(source.doseMode)
    || ['minWeight', 'maxWeight', 'maxDailyMgPerKg', 'maxSingleMgPerKg'].some(key => has(source[key]));
  if (weightNeeded && !has(context.weight)) reasons.push('Uzupełnij masę ciała, aby porównać schemat.');
  if (!has(context.age) && (source.minimumAge || has(source.minAgeMonths) || has(source.maxAgeMonths) || has(form.minAge)))
    reasons.push('Uzupełnij wiek, aby sprawdzić warunki schematu i preparatu.');
  if (source.requireCrCl && !has(context.crcl)) reasons.push('Uzupełnij CrCl, aby sprawdzić warunki schematu.');
  return reasons;
}

function arithmeticInput(source, form, context, veterinary) {
  const age = ageYears(context), conditional = conditionalLimit(form, context, age);
  const weightedLimit = key => has(source[key]) && positive(context.weight)
    ? source[key] * context.weight : null;
  return {
    ...form,
    patientKind: veterinary ? 'animal' : 'human', species: context.species,
    doseMode: context.doseMode, dose: context.dose, frequency: context.frequency,
    weight: context.weight, age, days: 1, roundingStep: context.roundingStep ?? null,
    // The package is needed by the canonical arithmetic only; its size and
    // shelf life never supply a treatment duration or a recommended endpoint.
    packageSize: context.packageSize ?? form.packOptions?.[0]?.quantity ?? form.singleUseUnitSize ?? 1,
    maxDailyMg: minimumLimit([conditional?.maxDailyMg, form.maxDailyMg, source.maxDailyMg,
      weightedLimit('maxDailyMgPerKg'), context.manualMax]),
    maxSingleMg: minimumLimit([conditional?.maxSingleMg, form.maxSingleMg, source.maxSingleMg,
      weightedLimit('maxSingleMgPerKg')]),
    foodChainStatus: context.foodChainStatus,
    calculationBlocked: !!(form.calculationBlocked || context.calculationBlocked),
  };
}

/** Shared actual-dose preview for both the assessment and its source notice.
 * Missing product/source data cannot be replaced by assumed concentrations.
 */
export function durationDosePreview({ source = null, form = null, context = {} } = {}) {
  if (!source || !form) return null;
  return calculate(arithmeticInput(source, form, context, Array.isArray(source.species)));
}

function doseInSourceUnits(source, actual, context) {
  switch (source.doseMode) {
    case 'fixed': return actual.singleMg;
    case 'perKgDose': return positive(context.weight) && positive(actual.singleMg)
      ? actual.singleMg / context.weight : null;
    case 'perKgDay': return positive(context.weight) && positive(actual.dailyMg)
      ? actual.dailyMg / context.weight : null;
    case 'units': return actual.singleUnits;
    default: return null;
  }
}

function snapToSource(value, source) {
  const boundary = [source.dose, source.doseRange?.min, source.doseRange?.max]
    .find(candidate => near(value, candidate));
  return boundary ?? value;
}

function externalAssessment(rule, reference, actual, context) {
  if (reference) {
    if (!positive(reference.comparisonSingleMg) || !positive(reference.comparisonFrequency))
      return result('review', ['Brak pełnych zweryfikowanych danych dawkowania dla zewnętrznego odniesienia do czasu.']);
    const differences = [];
    if (!near(actual?.singleMg, reference.comparisonSingleMg))
      differences.push('Rzeczywista dawka na podanie, po przeliczeniu i zaokrągleniu, różni się od dawki odniesienia UCSF.');
    if (context.frequency !== reference.comparisonFrequency)
      differences.push('Liczba podań na dobę różni się od schematu odniesienia UCSF.');
    if (differences.length) return result('mismatch', differences);
    // Numeric agreement is informational. The reference's clinical scope stays
    // in its source details; it is not a detected discrepancy or result warning.
    return result('reference-matched');
  }
  if (rule?.origin === 'external')
    return result('review', ['Zakres SDCEP dotyczy określonego dawkowania i warunków zastosowania. Ich zgodność z wpisanym schematem wymaga odrębnej oceny.']);
  return result('matched');
}

export function assessDurationRegimen({ source = null, form = null, context = {}, rule = null, reference = null } = {}) {
  if (!source || !form) return result('incomplete', ['Wybierz schemat i postać preparatu, aby ocenić zgodność dawkowania.']);
  if (context.custom || form.referenceOnly || form.calculationBlocked || context.calculationBlocked)
    return result('review', ['Dla tej postaci lub trybu nie potwierdzono zgodności całego schematu.']);
  if (!source.formIds?.includes(form.id) || has(context.formId) && context.formId !== form.id)
    return result('mismatch', ['Schemat nie odpowiada wybranej postaci preparatu.']);
  const veterinary = Array.isArray(source.species), instruction = source.doseMode === 'instruction';
  if (veterinary !== (context.specialty === 'veterinary'))
    return result('mismatch', ['Schemat nie odpowiada wybranemu profilowi pacjenta.']);
  if (veterinary && Array.isArray(form.targetSpecies) && !form.targetSpecies.includes(context.species))
    return result('mismatch', ['Wybrana postać preparatu nie jest przypisana do tego gatunku.']);
  const missing = missingContext(source, form, context, veterinary, instruction);
  if (missing.length) return result('incomplete', missing);

  const validationContext = { ...context, formId: form.id, days: previewDays(source) };
  if (instruction) {
    const checked = resolveHumanRegimen(source, validationContext);
    if (!checked.valid) return result('mismatch', checked.errors);
    const age = ageYears(context), conditional = conditionalLimit(form, context, age);
    if (has(form.minAge) && (!finite(form.minAge) || !finite(age) || age < form.minAge))
      return result('mismatch', ['Wiek nie spełnia ograniczenia wybranej postaci preparatu.']);
    if ([context.manualMax, form.maxDailyMg, form.maxSingleMg, conditional?.maxDailyMg,
      conditional?.maxSingleMg].some(has))
      return result('review', ['Schemat opisowy nie podaje dawki liczbowej pozwalającej sprawdzić limit dawkowania w mg.']);
    return externalAssessment(rule, reference, null, context);
  }
  if (!modes.has(context.doseMode)) return result('mismatch', ['Wybierz poprawny sposób przeliczenia wpisanej dawki.']);
  if (!positive(context.dose)) return result('mismatch', ['Podaj dodatnią, skończoną dawkę.']);
  if (!Number.isSafeInteger(context.frequency) || context.frequency < 1 || context.frequency > 48)
    return result('mismatch', ['Podaj całkowitą liczbę podań na dobę od 1 do 48.']);

  const actual = durationDosePreview({ source, form, context });
  if (!actual.valid) return result('mismatch', actual.errors);
  const sourceDose = doseInSourceUnits(source, actual, context);
  if (!positive(sourceDose)) return result('incomplete', ['Brak wiarygodnego przelicznika rzeczywistej dawki na jednostkę wybranego schematu.']);

  if (veterinary) {
    const checked = resolveRegimen(source, validationContext);
    if (!checked.valid) return result('mismatch', checked.errors);
    const differences = [];
    if (!near(sourceDose, checked.dose)) differences.push('Rzeczywista dawka różni się od dawki wybranego schematu lub etapu.');
    if (context.frequency !== checked.frequency) differences.push('Liczba podań różni się od wybranego schematu lub etapu.');
    if (differences.length) return result('mismatch', differences);
  } else {
    const checked = resolveHumanRegimen(source, {
      ...validationContext, doseMode: source.doseMode, dose: snapToSource(sourceDose, source),
    });
    if (!checked.valid) return result('mismatch', checked.errors);
  }
  return externalAssessment(rule, reference, actual, context);
}
