/** Revalidate a saved prescription when an unknown age is first supplied.
 * This never selects treatment, changes quantities, or approves a new warning.
 * The immutable form/source captured on save keep this independent of whichever
 * medication is currently open in the calculator.
 */
import { calculate } from './engine.js';
import { resolveRoundingRegimen, applyRoundingPresentation } from './rounding-assessment.js';
import { editableHumanSource } from './regimen-edit.js';
import { resolveSingleDose } from './single-dose.js';
import { sourceConfirmationsAfterEdit } from './source-confirmations.js';
import { resolveDurationGuidance, durationResultWarning } from './duration-guidance.js';
import { numericStateValue as num, humanAgeYearsFor, humanContextFor,
  roundingStepFor, doseLimitsFor, calculationInputFor } from './calculation-state.js';

const empty = value => value == null || typeof value === 'string' && !value.trim();
const invalid = () => ({ valid: false, unchanged: false });
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort()
    .filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
const sameData = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));

function evaluate(snapshot) {
  const { form, source = null } = snapshot.validationModel || {};
  if (!form || form.referenceOnly || form.calculationBlocked
      || form.id !== (snapshot.custom ? 'custom' : snapshot.formId)
      || (snapshot.regimenId || null) !== (source?.id || null)) return null;
  const pack = form.packOptions?.find(item => item.id === snapshot.packageId) || form.packOptions?.[0];
  if (!pack) return null;
  if (form.calculationMode === 'single-dose') {
    const context = { formId: form.id, specialty: snapshot.specialty,
      patientType: snapshot.patientType, age: num(snapshot.age), ageUnit: snapshot.humanAgeUnit,
      doseMicrograms: num(snapshot.doseMicrograms), packId: snapshot.packageId,
      sourceConfirmations: snapshot.sourceConfirmations };
    const result = resolveSingleDose(form, source, context);
    if (!result.valid) return null;
    return { calculation: {
      calculationMode: 'single-dose', doseMicrograms: result.doseMicrograms,
      activeDrugMicrograms: result.activeDrugMicrograms, volumeMl: result.volumeMl,
      containersNeeded: result.containersNeeded, containerMl: result.containerMl,
      volumeWasteMl: result.volumeWasteMl, concentrationMicrogramsPerMl: result.concentrationMicrogramsPerMl,
      sourceId: result.sourceId, packId: result.packId, contextKey: result.contextKey,
      containersPerPack: pack.containersPerPack, packageVolumeMl: pack.quantity,
    }, roundingPolicy: null, doseLimits: null, warnings: result.warnings };
  }
  const context = humanContextFor(snapshot, form, source);
  const limitContext = { age: humanAgeYearsFor(snapshot), weight: num(snapshot.weight), manualMax: snapshot.manualMax };
  const independent = doseLimitsFor(form, limitContext);
  const step = roundingStepFor(snapshot, form, source, context);
  const options = { form, source, limits: independent, review: null,
    context: { ...context, doseMode: snapshot.doseMode, roundingStep: step,
      roundingMode: snapshot.roundingMode, baselineStep: num(snapshot.roundingStep), patientKind: 'human' } };
  const instruction = form.calculationMode === 'instruction' || source?.doseMode === 'instruction';
  const sourceCheck = source ? resolveRoundingRegimen(options,
    { allowNumericOverrides: !instruction && editableHumanSource(source) }) : null;
  if (sourceCheck && !sourceCheck.valid) return null;
  const guidance = resolveDurationGuidance({ form, source, context: {
    ...context, specialty: snapshot.specialty, doseMode: snapshot.doseMode,
    roundingStep: step, manualMax: num(snapshot.manualMax), roundingMode: snapshot.roundingMode,
    patientKind: 'human', roundingLimits: independent, custom: snapshot.custom,
    calculationBlocked: !!form.calculationBlocked,
  } });
  const durationWarning = durationResultWarning(snapshot.days, guidance);
  if (instruction) {
    const count = num(snapshot.instructionPacks);
    if (!sourceCheck?.valid || count !== null && (!Number.isInteger(count) || count <= 0 || count > 10000)) return null;
    return { calculation: { packageSize: pack.quantity }, roundingPolicy: null, doseLimits: null,
      warnings: [...sourceCheck.warnings, ...(durationWarning ? [durationWarning] : [])] };
  }
  const limits = doseLimitsFor(form, { ...limitContext, sourceCheck });
  const input = calculationInputFor(snapshot, form, pack, { roundingStep: step, limits });
  const result = applyRoundingPresentation(calculate(input), sourceCheck?.rounding || null);
  if (!result.valid || sourceCheck?.maxUnitsPerDose != null && result.singleUnits > sourceCheck.maxUnitsPerDose + 1e-9
      || sourceCheck?.maxDailyUnits != null && result.dailyUnits > sourceCheck.maxDailyUnits + 1e-9
      || snapshot.custom && !snapshot.customName?.trim()
      || form.form === 'injection' && !snapshot.extraInstructions?.trim()) return null;
  return { calculation: {
    singleUnits: result.singleUnits, singleMg: result.singleMg, dailyMg: result.dailyMg,
    totalUnits: result.totalUnits, packages: result.packages, packageSize: pack.quantity,
  }, roundingPolicy: sourceCheck?.rounding?.state === 'rule' ? sourceCheck.rounding.policy : null,
  doseLimits: { single: limits.single, daily: limits.daily,
    unitsPerDose: sourceCheck?.maxUnitsPerDose ?? null, dailyUnits: sourceCheck?.maxDailyUnits ?? null },
  warnings: [...result.warnings, ...(sourceCheck?.warnings || []), ...(durationWarning ? [durationWarning] : [])] };
}

export function revalidatePrescriptionAge(candidate, { previousItem } = {}) {
  try {
    const previous = previousItem?.snapshot;
    if (!previous || !candidate || previous.demo || candidate.demo
        || previous.specialty === 'veterinary' || candidate.specialty === 'veterinary'
        || !empty(previous.age) || empty(candidate.age) || !Number.isFinite(num(candidate.age))
        || num(candidate.age) < 0 || !['years', 'months', 'days'].includes(candidate.humanAgeUnit)) return invalid();
    // Even outside the cart helper, this adapter cannot authorize a medication
    // edit, a change of patient group, or replacement of another patient field.
    const restored = { ...candidate };
    for (const key of ['age', 'humanAgeUnit']) {
      if (Object.hasOwn(previous, key)) restored[key] = previous[key];
      else delete restored[key];
    }
    if (!sameData(restored, previous)) return invalid();
    const before = evaluate(previous);
    if (!before || !sameData(before.calculation, previous.calculation)
        || !sameData(before.roundingPolicy, previous.roundingPolicy ?? null)) return invalid();
    const source = candidate.validationModel?.source;
    const after = evaluate({ ...candidate,
      sourceConfirmations: sourceConfirmationsAfterEdit(source, candidate.sourceConfirmations, 'age'),
    });
    if (!after) return invalid();
    const unchanged = sameData(before.calculation, after.calculation)
      && sameData(before.roundingPolicy, after.roundingPolicy)
      // PRN export can include the effective daily ceiling even when the chosen
      // quantity stays below both ceilings. Preserve the reviewed text exactly.
      && sameData(before.doseLimits, after.doseLimits)
      && after.warnings.every(message => before.warnings.includes(message));
    return { valid: true, unchanged };
  } catch {
    return invalid();
  }
}
