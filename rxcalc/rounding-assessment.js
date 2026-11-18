/** One assessment shared by input shortcuts, source checks, bars and export.
 * Evidence for a conversion is NOT clinical approval of a dental regimen.
 * No percentage tolerance is inferred. Only an exact, individually reviewed
 * 11 ml conversion may replace the two duplicated source-target constraints.
 * All independent limits and the original comparison dose are retained.
 */
import { resolveHumanRegimen } from './human-regimen-engine.js';
import { calculate } from './engine.js';
import { ADULT_AUGMENTIN_ROUNDED_SHORTCUT as rule } from './rounded-volume-shortcuts.js';

const positive = n => typeof n === 'number' && Number.isFinite(n) && n > 0;
const present = n => n !== null && n !== undefined && n !== '';
const near = (a,b) => typeof a === 'number' && typeof b === 'number'
  && Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a-b) <= Number.EPSILON*64*Math.max(1,Math.abs(a),Math.abs(b));
const above = (a,b) => a>b && !near(a,b);
const revision = 'case-review-2026-11-16-v1';

/** Fail closed if the source, formulation or its constraint semantics change. */
export function hasScopedRoundingEvidence(form, source) {
  return form?.id === rule.formId && form.form === 'suspension'
    && (!form.routeCode || form.routeCode === 'oral') && form.routeLabel?.toLowerCase() === 'doustnie' && form.unitLabel === 'ml'
    && !form.calculationBlocked && !form.referenceOnly && form.calculationMode !== 'instruction'
    && form.concentrationMg === 400 && form.concentrationMl === 5
    && form.ingredients?.length === 2 && form.ingredients[0].amountMg === 400
    && form.ingredients[0].perMl === 5 && form.ingredients[1].amountMg === 57
    && form.ingredients[1].perMl === 5
    && source?.id === rule.sourceId && source.doseMode === 'fixed'
    && source.dose === 875 && !source.doseRange && source.frequency === 2
    && source.formIds?.length === 1 && source.formIds[0] === form.id
    && source.patientTypes?.length === 1 && source.patientTypes[0] === 'adult'
    && source.maxSingleMg === 875 && source.maxDailyMg === 1750
    && source.roundingConstraintKind === 'source-target'
    && !['maxSingleMgPerKg','maxDailyMgPerKg','maxUnitsPerDose','maxDailyUnits']
      .some(k=>present(source[k]));
}

export function roundingCaseKey({form,source,context={},limits={}}={}) {
  // Include source/form snapshots so later metadata edits also revoke review.
  return JSON.stringify([revision,form,source,context,limits]);
}

/** Returns null for cases without this exact documented conversion. An input
 * shortcut may request a preview, but only the current input can use a review. */
export function assessDoseRounding({form,source,context={},limits={},review=null}={}) {
  if (!hasScopedRoundingEvidence(form,source) || context.patientType !== 'adult'
    || context.patientKind === 'animal' || context.specialty !== 'dental'
    || context.formId !== form.id || context.doseMode !== 'fixed'
    || context.frequency !== 2) return null;
  const step=context.roundingStep;
  if (!near(context.dose,rule.amoxicillinMg)) {
    // The decimal control can reach the same exact conversion while retaining
    // the source dose as the nominal input. No other input or rounded amount is
    // admitted. Keep the original dose and step in the review fingerprint.
    if (context.dose !== rule.referenceMg || !positive(step)) return null;
    const preview=calculate({form:form.form,unitLabel:form.unitLabel,
      doseMode:'fixed',dose:context.dose,roundingStep:step,
      concentrationMg:form.concentrationMg,concentrationMl:form.concentrationMl,
      frequency:2,days:1,packageSize:1});
    if (!preview.valid || !near(preview.singleUnits,rule.ml)
      || !near(preview.singleMg,rule.amoxicillinMg)) return null;
  }
  const errors=[];
  const check=resolveHumanRegimen(source,{...context,dose:875,frequency:2,
    days:source.fixedDays || source.minDays || 1});
  errors.push(...check.errors);
  if (present(context.age)) {
    const years=context.age*({years:1,months:1/12,days:1/365.25}[context.ageUnit]||NaN);
    if (!Number.isFinite(years) || years<18) errors.push('Wariant zaokrąglenia dotyczy wyłącznie dorosłych.');
  }
  if (!positive(context.weight) || context.weight<40 || context.weight>500)
    errors.push('Potwierdź masę dorosłego co najmniej 40 kg.');
  if (present(step) && (!positive(step) || !near(Math.round(11/step)*step,11)))
    errors.push('Krok zaokrąglenia zmienia objętość 11 ml. Reguła nie ma zastosowania.');
  const breach=(values,actual,label)=>{
    for(const value of values.filter(present)) {
      if(!positive(value))errors.push('Nieprawidłowy niezależny limit.');
      else if(above(actual,value))errors.push(label);
    }
  };
  breach([form.maxSingleMg,limits.single],880,'Przekroczony niezależny limit jednorazowy.');
  breach([form.maxDailyMg,limits.daily],1760,'Przekroczony niezależny limit dobowy lub limit lekarza.');
  // A companion ingredient limit is checked independently if explicitly supplied.
  for(const cap of limits.ingredients || []) {
    const i=cap.index;
    if(![0,1].includes(i)){errors.push('Nieprawidłowe przypisanie limitu składnika.');continue;}
    breach([cap.single],i===0?880:125.4,'Przekroczony niezależny limit jednorazowy składnika.');
    breach([cap.daily],i===0?1760:250.8,'Przekroczony niezależny limit dobowy składnika.');
  }
  const key=roundingCaseKey({form,source,context,limits});
  const accepted=errors.length===0 && review?.key===key && review.ruleId===rule.id
    && review.revision===revision && review.scopeConfirmed===true && review.measurementConfirmed===true
    && typeof review.reason==='string' && review.reason.trim().length>=10 && review.reason.length<=500;
  return {ruleId:rule.id,key,revision,state:errors.length?'blocked':accepted?'reviewed':'needs-review',
    severity:errors.length?'critical':accepted?'reviewed':'warning',
    label:errors.length?'Zaokrąglenie niedostępne — sprawdź ograniczenia'
      :accepted?'Zaokrąglenie ocenione indywidualnie':'Zaokrąglenie wymaga indywidualnej oceny',
    errors:[...new Set(errors)],referenceSingleMg:875,referenceDailyMg:1750,
    referenceMl:rule.referenceMl,ml:11,singleMg:880,dailyMg:1760,
    companionSingleMg:125.4,companionDailyMg:250.8,deltaPercent:rule.deltaPercent,
    // Never claim that a case acknowledgement is a clinically validated policy.
    clinicallyValidated:false,reason:accepted?review.reason.trim():null};
}

/** Sole exception boundary: detach only the exact source-target duplicates.
 * This never changes the original source record or any independent constraint. */
export function roundingValidationSource(source, assessment) {
  return assessment && ['needs-review','reviewed'].includes(assessment.state)
    && assessment.ruleId===rule.id && source?.id===rule.sourceId
    && source.roundingConstraintKind==='source-target' && source.dose===875
    && source.maxSingleMg===875 && source.maxDailyMg===1750
    ? {...source,maxSingleMg:null,maxDailyMg:null,
      limitLabel:'875 mg na podanie i 1750 mg/dobę to odniesienie tego schematu, nie osobny pułap toksyczności.'}
    : source;
}

export function resolveRoundingRegimen(options, resolverOptions={allowNumericOverrides:true}) {
  const assessment=assessDoseRounding(options);
  const source=roundingValidationSource(options.source,assessment);
  const context=resolverOptions.previewDuration?{...options.context,days:source?.fixedDays||source?.minDays||1}:options.context;
  const result=resolveHumanRegimen(source,context,resolverOptions);
  if(assessment) {
    result.rounding=assessment;
    if(assessment.state==='blocked')result.errors.push(...assessment.errors);
    if(assessment.state==='needs-review')result.errors.push('Zaokrąglenie 11 ml wymaga indywidualnej oceny przed kopiowaniem.');
    if(assessment.state==='reviewed') {
      result.warnings=result.warnings.filter(t=>!t.startsWith('Dawka została zmieniona względem źródła.'));
      result.warnings.push('Indywidualnie ocenione zaokrąglenie: 11 ml, 880 mg + 125,4 mg na podanie. Nie jest to automatycznie zatwierdzony schemat z polskiej ChPL.');
    }
    result.errors=[...new Set(result.errors)];
    result.valid=result.errors.length===0;
  }
  return result;
}

/** Deliberate clinician acknowledgement; no default, persistence, or global %.
 * A reason and both attestations are mandatory; incomplete duration/patient
 * context and independent ceiling violations cannot be overridden here. */
export function createRoundingReview(options,{reason='',scopeConfirmed=false,measurementConfirmed=false}={}) {
  const a=assessDoseRounding({...options,review:null});
  if(!a || a.state!=='needs-review' || scopeConfirmed!==true || measurementConfirmed!==true
    || typeof reason!=='string' || reason.trim().length<10 || reason.length>500)return null;
  const baseline=resolveHumanRegimen(roundingValidationSource(options.source,a),options.context,{allowNumericOverrides:true});
  if(!baseline.valid)return null;
  return Object.freeze({key:a.key,ruleId:a.ruleId,revision:a.revision,reason:reason.trim(),
    scopeConfirmed:true,measurementConfirmed:true});
}

export function roundingAuditText(assessment) {
  if(assessment?.state!=='reviewed')return '';
  return `Ocena zaokrąglenia do dokumentacji: 875 mg (10,9375 ml) → 880 mg (11 ml) amoksycyliny na podanie; +0,57%. Kwas klawulanowy: 125,4 mg na podanie. Indywidualna decyzja lekarza, nie automatyczna walidacja schematu. Uzasadnienie: ${assessment.reason}`;
}
