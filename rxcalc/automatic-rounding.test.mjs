import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { LIQUID_STARTER_REGIMENS } from './liquid-starters.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { calculate } from './engine.js';
import { ADULT_AUGMENTIN_ROUNDED_SHORTCUT as rule } from './rounded-volume-shortcuts.js';
import { automaticRoundingStep, assessDoseRounding, resolveRoundingRegimen,
  roundingValidationSource, roundingAuditText, createRoundingReview } from './rounding-assessment.js';
import { roundingReviewMarkup } from './rounding-review-view.js';

const form=DRUGS.find(d=>d.id==='amoxicillin-clavulanate').forms.find(f=>f.id==='augmentin-400-57');
const source=LIQUID_STARTER_REGIMENS[0];
const base={form,source,context:{patientKind:'human',formId:form.id,specialty:'dental',
  patientType:'adult',doseMode:'fixed',dose:875,frequency:2,days:7,weight:70,
  age:35,ageUnit:'years',renalStatus:'normal',crcl:90,roundingMode:'auto',roundingStep:1},
  limits:{single:null,daily:null}};
const withContext=change=>({...base,context:{...base.context,...change}});
const computation=options=>{
  const resolved=resolveRoundingRegimen(options);
  return calculate({patientKind:'human',form:form.form,unitLabel:'ml',doseMode:'fixed',
    dose:options.context.dose,frequency:2,days:7,weight:70,concentrationMg:400,
    concentrationMl:5,packageSize:35,roundingStep:options.context.roundingStep,
    maxSingleMg:resolved.maxSingleMg,maxDailyMg:resolved.maxDailyMg});
};

test('Auto selects only the exact documented source/formulation/nominal dose',()=>{
  assert.equal(automaticRoundingStep(base),1);
  for(const dose of [500,874,876,880,1000])assert.equal(automaticRoundingStep(withContext({dose})),null);
  for(const context of [{frequency:3},{patientType:'child'},{doseMode:'perKgDay'},
    {formId:'other'},{specialty:'cardio'},{patientKind:'animal'},{weight:39},{weight:null},
    {age:12},{renalStatus:'impaired'},{crcl:20}])
    assert.equal(automaticRoundingStep(withContext(context)),null,JSON.stringify(context));
  for(const change of [{id:'other'},{concentrationMg:200},{routeCode:'iv'},
    {ingredients:[form.ingredients[0],{amountMg:60,perMl:5}]}])
    assert.equal(automaticRoundingStep({...base,form:{...form,...change}}),null);
  for(const change of [{id:'other'},{roundingConstraintKind:'hard-limit'},
    {doseRange:{min:800,max:900}}])
    assert.equal(automaticRoundingStep({...base,source:{...source,...change}}),null);
});

test('Auto is an informational rule application without fabricated individual review',()=>{
  const assessment=assessDoseRounding(base),resolved=resolveRoundingRegimen(base);
  assert.equal(assessment.state,'rule');assert.equal(assessment.severity,'info');
  assert.equal(assessment.label,'Zaokrąglono według reguły');
  assert.equal(assessment.clinicallyValidated,false);assert.equal(assessment.reason,null);
  assert.equal(assessment.policy.id,rule.id);assert.equal(assessment.policy.revision,rule.policyRevision);
  assert.equal(assessment.policy.evidence.length,2);assert.ok(Object.isFrozen(assessment.policy));
  assert.equal(resolved.valid,true);assert.equal(resolved.dose,875);
  assert.equal(resolved.frequency,2);assert.equal(resolved.maxSingleMg,null);
  assert.equal(resolved.maxDailyMg,null);assert.ok(resolved.notices.some(t=>t.includes('11 ml')));
  assert.ok(!resolved.warnings.some(t=>/Zaokrąglenie|Dawka została zmieniona/.test(t)));
  assert.equal(roundingReviewMarkup(assessment),'');
  assert.match(roundingAuditText(assessment),/Cleveland Clinic.*HSE/);
  assert.equal(createRoundingReview(base,{reason:'Przypadek testowy — brak indywidualnej oceny.',
    scopeConfirmed:true,measurementConfirmed:true}),null);
});

test('Auto, a custom whole-ml step and explicit 880 mg have identical actual quantities',()=>{
  const paths=[base,withContext({roundingMode:'custom'}),
    withContext({roundingMode:'custom',dose:880,roundingStep:null}),
    withContext({roundingMode:'off',dose:880,roundingStep:null})];
  for(const options of paths) {
    const assessment=assessDoseRounding(options),result=computation(options);
    assert.equal(assessment.state,'rule');assert.equal(assessment.severity,'info');
    assert.equal(result.valid,true);assert.equal(result.singleUnits,11);
    assert.equal(result.singleMg,880);assert.equal(result.dailyMg,1760);
    assert.equal(result.totalUnits,154);assert.equal(result.packages,5);
    assert.equal(assessment.companionSingleMg,125.4);
    assert.equal(assessment.companionDailyMg,250.8);
    assert.equal(assessment.policy.id,rule.id);
  }
});

test('Off preserves the theoretical dose and source targets without claiming a conversion',()=>{
  const options=withContext({roundingMode:'off',roundingStep:null});
  assert.equal(assessDoseRounding(options),null);
  const resolved=resolveRoundingRegimen(options),result=computation(options);
  assert.equal(resolved.rounding,undefined);assert.equal(resolved.maxSingleMg,875);
  assert.equal(resolved.maxDailyMg,1750);assert.equal(result.singleUnits,10.9375);
  assert.equal(result.singleMg,875);
});

test('Independent caps never silently turn Auto off or inherit the source-target exception',()=>{
  for(const limits of [{single:875},{daily:1750},{daily:1500},{single:0},{daily:NaN},
    {ingredients:[{index:1,single:125}]},{ingredients:[{index:1,daily:250}]}]) {
    const options={...base,limits};
    assert.equal(automaticRoundingStep(options),1,'Candidate must reach explicit validation');
    const assessment=assessDoseRounding(options),resolved=resolveRoundingRegimen(options);
    assert.equal(assessment.state,'blocked');assert.equal(assessment.severity,'critical');
    assert.equal(roundingValidationSource(source,assessment),source);
    assert.equal(resolved.valid,false);assert.ok(assessment.errors.length>0);
    assert.equal(resolved.maxSingleMg,875);assert.equal(resolved.maxDailyMg,1750);
  }
  for(const change of [{maxSingleMg:875},{maxDailyMg:1750}]) {
    const options={...base,form:{...form,...change}};
    assert.equal(automaticRoundingStep(options),1);
    assert.equal(assessDoseRounding(options).state,'blocked');
  }
});

test('Compatible independent caps remain unchanged and permit the exact candidate',()=>{
  const options={...base,limits:{single:900,daily:1800,ingredients:[{index:1,single:126,daily:252}]}};
  const before=structuredClone(options.limits);
  assert.equal(assessDoseRounding(options).state,'rule');
  assert.deepEqual(options.limits,before);
});

test('Device divisions are preserved and incompatible or invalid devices block 11 ml',()=>{
  for(const target of ['form','source','context'])for(const doseStepUnits of [.1,.5,1]) {
    const options={...base,[target]:{...base[target],doseStepUnits}};
    assert.equal(assessDoseRounding(options).state,'rule');
    assert.equal(options[target].doseStepUnits,doseStepUnits);
  }
  for(const target of ['form','source','context'])for(const doseStepUnits of [.3,2,0,-1,NaN]) {
    const options={...base,[target]:{...base[target],doseStepUnits}};
    assert.equal(automaticRoundingStep(options),1);
    const assessment=assessDoseRounding(options);
    assert.equal(assessment.state,'blocked');assert.equal(assessment.severity,'critical');
    assert.ok(assessment.errors.some(t=>t.includes('podziałkom')));
    assert.equal(resolveRoundingRegimen(options).valid,false);
  }
});

test('Changing patient or renal conditions cannot use the named policy to bypass restrictions',()=>{
  for(const change of [{weight:null},{weight:39},{weight:501},{age:12},{age:170},
    {age:NaN},{renalStatus:'impaired'},{crcl:20},{crcl:30},{crcl:-1}]) {
    const options=withContext(change),assessment=assessDoseRounding(options);
    assert.equal(assessment.state,'blocked',JSON.stringify(change));
    assert.equal(assessment.severity,'critical');assert.equal(resolveRoundingRegimen(options).valid,false);
  }
});

test('No global percentage tolerance is inferred, including very small departures',()=>{
  for(const roundingStep of [.1,.01,.001]) {
    const options=withContext({roundingMode:'custom',roundingStep});
    assert.equal(assessDoseRounding(options),null);
    assert.equal(resolveRoundingRegimen(options).maxSingleMg,875);
  }
  for(const dose of [874,876,879,880.1,885])
    assert.equal(assessDoseRounding(withContext({dose,roundingStep:1})),null);
  const child=HUMAN_REGIMENS.find(r=>r.id==='dental-augmentin-400-57-child');
  const options={...base,source:child,context:{...base.context,patientType:'child',
    age:8,weight:24,doseMode:'perKgDay',dose:45}};
  assert.equal(automaticRoundingStep(options),null);assert.equal(assessDoseRounding(options),null);
});

test('Rule application preserves independent duration errors and warnings',()=>{
  const missing=resolveRoundingRegimen(withContext({days:null}));
  assert.equal(missing.rounding.state,'rule');assert.equal(missing.valid,false);
  assert.ok(missing.errors.some(t=>t.includes('czas stosowania')));
  const late=resolveRoundingRegimen(withContext({days:15}));
  assert.ok(late.warnings.some(t=>t.includes('ponownej oceny')));
  const fixed={...base,source:{...source,fixedDays:7},context:{...base.context,days:8}};
  assert.equal(resolveRoundingRegimen(fixed).valid,false);
  assert.ok(resolveRoundingRegimen(fixed).errors.some(t=>t.includes('dokładnie 7 dni')));
});

test('Legacy callers still require a real individual review and retain the original revision',()=>{
  const legacy=withContext({roundingMode:undefined});
  const assessment=assessDoseRounding(legacy);
  assert.equal(assessment.state,'needs-review');assert.equal(assessment.severity,'warning');
  assert.equal(assessment.policy,undefined);assert.equal(resolveRoundingRegimen(legacy).valid,false);
  const review=createRoundingReview(legacy,{reason:'Ocena indywidualna wyłącznie do testu.',
    scopeConfirmed:true,measurementConfirmed:true});
  assert.ok(review);assert.equal(review.revision,'case-review-2026-11-16-v1');
  assert.equal(assessDoseRounding({...legacy,review}).state,'reviewed');
});

test('Rule evaluation never mutates nominal input, source, constraints or metadata',()=>{
  const options=structuredClone(base),before=JSON.stringify(options);
  automaticRoundingStep(options);assessDoseRounding(options);resolveRoundingRegimen(options);
  assert.equal(JSON.stringify(options),before);
  assert.equal(source.dose,875);assert.equal(source.maxSingleMg,875);assert.equal(source.maxDailyMg,1750);
});
