/**
 * Decide which patient inputs the progressive form must keep immediately visible.
 * Visibility is not clinical validation: the calculation and regimen engines
 * remain responsible for eligibility, limits and blocking incomplete results.
 */
const entered = value => value !== '' && value !== null && value !== undefined;
const AGE_CONDITIONS = ['minAge', 'minAgeExclusive', 'maxAge', 'maxAgeExclusive'];
const WEIGHT_CONDITIONS = ['minWeight', 'minWeightExclusive', 'maxWeight', 'maxWeightExclusive'];
const hasCondition = (form, keys) => Array.isArray(form?.conditionalLimits)
  && form.conditionalLimits.some(rule => keys.some(key => rule?.[key] != null));

export function patientFieldsFor({
  specialty, patientType, doseMode, age, weight, species, form = {}, source = null,
} = {}) {
  const veterinary = specialty === 'veterinary';
  const child = !veterinary && patientType === 'child';
  return {
    age: entered(age) || form?.minAge != null
      || (veterinary ? source?.minimumAge != null : child || hasCondition(form, AGE_CONDITIONS)),
    weight: entered(weight) || veterinary || child
      || ['perKgDay', 'perKgDose'].includes(doseMode) || hasCondition(form, WEIGHT_CONDITIONS),
    foodChain: veterinary && species === 'horse'
      && (form?.requiresFoodChainExclusion === true || source?.requiresFoodChainExclusion === true),
  };
}
