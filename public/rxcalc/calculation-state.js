/** Pure adapters shared by the live calculator and saved-snapshot validation.
 * They assemble inputs only: existing source/rounding/arithmetic validators
 * retain all decisions, and no patient or medication state is changed here.
 */
import { renalRegimenContext } from './renal-state.js';
import { automaticRoundingStep } from './rounding-assessment.js';
import { effectiveRoundingStep } from './decimal-rounding.js';
import { limitOriginsFor } from './source-result.js';

export const numericStateValue = value => value === '' || value === null || value === undefined
  ? null : Number(String(value).trim().replace(',', '.'));
const num = numericStateValue;
const veterinary = state => state.specialty === 'veterinary';

export function humanAgeYearsFor(state) {
  return num(state.age) === null ? null
    : num(state.age) * ({years:1,months:1/12,days:1/365.25}[state.humanAgeUnit] || 1);
}

export function humanContextFor(state, form, source) {
  return {formId:form?.id, specialty:state.specialty, patientType:state.patientType,
    age:num(state.age), ageUnit:state.humanAgeUnit, weight:num(state.weight), days:num(state.days),
    dose:num(state.dose), frequency:num(state.frequency), renalStatus:state.renalStatus,
    ...renalRegimenContext(state,source), sourceConfirmations:state.sourceConfirmations};
}

export function roundingStepFor(state, form, source, context = humanContextFor(state,form,source)) {
  if(state.roundingMode === 'auto') return automaticRoundingStep({form,source,
    context:{...context,doseMode:state.doseMode,patientKind:veterinary(state)?'animal':'human'}})
    ?? num(state.roundingStep);
  return effectiveRoundingStep({enabled:state.roundingMode === 'custom',places:state.roundingPlaces,
    form,source,baselineStep:num(state.roundingStep)});
}

/** Age and weight are typed numbers/null; manualMax is the unchanged field
 * value. A malformed manual limit must still reach arithmetic validation. */
export function doseLimitsFor(form, {age, weight, manualMax, sourceCheck} = {}) {
  const rule=(form.conditionalLimits || []).find(record => {
    const tests=[['minAge','age',value=>age>=value],['minAgeExclusive','age',value=>age>value],
      ['maxAge','age',value=>age<=value],['minWeight','weight',value=>weight>=value],
      ['minWeightExclusive','weight',value=>weight>value],['maxWeight','weight',value=>weight<=value]];
    return tests.every(([key,parameter,test]) => record[key] == null
      || (Number.isFinite(parameter === 'age' ? age : weight) && test(record[key])));
  });
  const strictest = values => values.filter(value => Number.isFinite(value) && value > 0).length
    ? Math.min(...values.filter(value => Number.isFinite(value) && value > 0)) : null;
  const fromSource=strictest([rule?.maxDailyMg,form.maxDailyMg,sourceCheck?.maxDailyMg]);
  const manual=num(manualMax);
  const daily=manual === null ? fromSource : fromSource === null ? manual : Math.min(manual,fromSource);
  const single=strictest([rule?.maxSingleMg,form.maxSingleMg,sourceCheck?.maxSingleMg]);
  return {daily,single,
    label:manual !== null ? 'Limit wprowadzony przez lekarza (nie wyższy od dostępnego limitu źródłowego)'
      : sourceCheck?.limitLabel || rule?.label || 'Limit z danych preparatu',
    origins:{daily:limitOriginsFor(daily,{manual,regimen:sourceCheck?.maxDailyMg,
      product:form.maxDailyMg,conditional:rule?.maxDailyMg}),
    single:limitOriginsFor(single,{regimen:sourceCheck?.maxSingleMg,
      product:form.maxSingleMg,conditional:rule?.maxSingleMg})}};
}

/** Source-aware callers supply resolved limits and the selected rounding step.
 * Without them, defaults retain the independent product/manual constraints.
 */
export function calculationInputFor(state, form, pack, {
  roundingStep = roundingStepFor(state,form,null),
  limits = doseLimitsFor(form,{age:veterinary(state)?num(state.age):humanAgeYearsFor(state),
    weight:num(state.weight),manualMax:state.manualMax}),
} = {}) {
  const animal=veterinary(state);
  return {patientKind:animal?'animal':'human',
    calculationBlocked:!!(form?.referenceOnly || form?.calculationBlocked),
    calculationMode:form.calculationMode,species:animal?state.species:undefined,
    form:form.form,doseMode:state.doseMode,dose:num(state.dose),weight:num(state.weight),
    age:animal && num(state.age) !== null
      ? num(state.age) * ({years:1,months:1/12,weeks:7/365,days:1/365}[state.vetAgeUnit] || 1)
      : humanAgeYearsFor(state),
    frequency:num(state.frequency),days:num(state.days),strengthMg:form.strengthMg??null,
    concentrationMg:form.concentrationMg??null,concentrationMl:form.concentrationMl??null,
    unitLabel:form.unitLabel,packageSize:pack.quantity,roundingStep,
    allowedFractions:form.allowedFractions??null,maxDailyMg:limits.daily,maxSingleMg:limits.single,
    minAge:form.minAge??null,shelfLifeDays:form.shelfLifeDays??null,dropsPerMl:form.dropsPerMl??null,
    singleUseUnitSize:form.singleUseUnitSize??null,doseBasisIngredient:form.doseBasisIngredient,
    doseStepUnits:form.doseStepUnits??null,foodChainStatus:state.foodChainStatus,
    injectionContainerUse:form.injectionContainerUse,maxWithdrawalsPerVial:form.maxWithdrawalsPerVial,
    discardRemainderAfterUse:form.discardRemainderAfterUse,
    ...(Object.hasOwn(form,'requiresFoodChainExclusion')
      ? {requiresFoodChainExclusion:form.requiresFoodChainExclusion} : {})};
}
