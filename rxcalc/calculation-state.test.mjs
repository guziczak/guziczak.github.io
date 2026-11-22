import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './engine.js';
import { DRUGS } from './catalogue.js';
import { LIQUID_STARTER_REGIMENS } from './liquid-starters.js';
import { RENAL_STATE_DEFAULTS } from './renal-state.js';
import { resolveRoundingRegimen } from './rounding-assessment.js';
import { numericStateValue, humanAgeYearsFor, humanContextFor, roundingStepFor,
  doseLimitsFor, calculationInputFor } from './calculation-state.js';

test('field parsing retains blank, comma, zero and invalid-number distinctions used by validation',()=>{
  for(const value of ['',null,undefined])assert.equal(numericStateValue(value),null);
  assert.equal(numericStateValue(' 70,5 '),70.5);
  assert.equal(numericStateValue('0'),0);
  assert.equal(numericStateValue(' '),0);
  assert.ok(Number.isNaN(numericStateValue('invalid')));
  assert.equal(numericStateValue('Infinity'),Infinity);
  assert.equal(humanAgeYearsFor({age:'',humanAgeUnit:'years'}),null);
  assert.equal(humanAgeYearsFor({age:'420',humanAgeUnit:'months'}),35);
  assert.equal(humanAgeYearsFor({age:'365,25',humanAgeUnit:'days'}),1);
});

test('the shared adapters preserve the existing 11 ml conversion when an optional adult age is completed',()=>{
  const form=DRUGS.find(drug=>drug.id==='amoxicillin-clavulanate').forms.find(item=>item.id==='augmentin-400-57');
  const source=LIQUID_STARTER_REGIMENS.find(item=>item.id==='dental-augmentin-suspension-adult-substitution');
  const base={specialty:'dental',patientType:'adult',age:'',humanAgeUnit:'years',weight:'70',
    renalStatus:'unknown',humanCrCl:'',humanSerumCreatinine:'',...RENAL_STATE_DEFAULTS,
    doseMode:'fixed',dose:'875',frequency:'2',days:'5',roundingMode:'auto',roundingStep:'',
    manualMax:'',sourceConfirmations:[]};
  const pack=form.packOptions[0],quantities=[];
  for(const age of ['', '35']){
    const state=Object.freeze({...base,age}),before=structuredClone(state);
    const context=humanContextFor(state,form,source);
    const step=roundingStepFor(state,form,source,context);
    assert.equal(step,1);
    const limits=doseLimitsFor(form,{age:humanAgeYearsFor(state),weight:70,manualMax:state.manualMax});
    const check=resolveRoundingRegimen({form,source,context:{...context,doseMode:state.doseMode,
      roundingStep:step,roundingMode:state.roundingMode,baselineStep:null,patientKind:'human'},limits});
    assert.equal(check.valid,true,check.errors.join(' '));
    assert.equal(check.rounding.state,'rule');
    const resolvedLimits=doseLimitsFor(form,{age:humanAgeYearsFor(state),weight:70,
      manualMax:state.manualMax,sourceCheck:check});
    const result=calculate(calculationInputFor(state,form,pack,{roundingStep:step,limits:resolvedLimits}));
    assert.equal(result.valid,true,result.errors.join(' '));
    quantities.push([result.singleUnits,result.singleMg,result.dailyMg,result.totalUnits,result.packages]);
    assert.deepEqual(state,before);
  }
  assert.deepEqual(quantities[0],[11,880,1760,110,Math.ceil(110/pack.quantity)]);
  assert.deepEqual(quantities[1],quantities[0]);
  assert.equal(roundingStepFor({...base,age:'17'},form,source),null);
});

test('conditional, source and manual limits retain their precedence, provenance and invalid values',()=>{
  const form={maxDailyMg:2500,maxSingleMg:1000,conditionalLimits:[
    {minAge:18,maxDailyMg:2000,label:'Dorosły'},
    {minWeight:40,maxDailyMg:1600,label:'Masa'},
  ]};
  const sourceCheck={maxDailyMg:1750,maxSingleMg:875,limitLabel:'Schemat'};
  const adult=doseLimitsFor(form,{age:35,weight:70,manualMax:'2500',sourceCheck});
  assert.equal(adult.daily,1750);assert.equal(adult.single,875);
  assert.deepEqual(adult.origins,{daily:['regimen'],single:['regimen']});
  const unknownAge=doseLimitsFor(form,{age:null,weight:70,sourceCheck});
  assert.equal(unknownAge.daily,1600);
  assert.deepEqual(unknownAge.origins.daily,['product']);
  const manual=doseLimitsFor(form,{age:35,weight:70,manualMax:'1500',sourceCheck});
  assert.equal(manual.daily,1500);assert.deepEqual(manual.origins.daily,['manual']);
  assert.ok(Number.isNaN(doseLimitsFor(form,{age:35,weight:70,manualMax:'invalid',sourceCheck}).daily));
});

test('the arithmetic input preserves veterinary units, reference blocks and explicit food-chain metadata',()=>{
  const state={specialty:'veterinary',species:'horse',age:'2',vetAgeUnit:'weeks',weight:'550',
    doseMode:'perKgDose',dose:'1,1',frequency:'1',days:'3',roundingMode:'off',roundingStep:'',
    manualMax:'',foodChainStatus:'excluded'};
  const form={form:'injection',unitLabel:'ml',concentrationMg:50,concentrationMl:1,
    injectionContainerUse:'multiDose',maxWithdrawalsPerVial:20,discardRemainderAfterUse:true,
    requiresFoodChainExclusion:true};
  const input=calculationInputFor(state,form,{quantity:100},{roundingStep:null,limits:{daily:1000,single:800}});
  assert.equal(input.patientKind,'animal');assert.equal(input.species,'horse');
  assert.equal(input.age,2*7/365);assert.equal(input.dose,1.1);
  assert.equal(input.maxDailyMg,1000);assert.equal(input.maxSingleMg,800);
  assert.equal(input.requiresFoodChainExclusion,true);assert.equal(input.foodChainStatus,'excluded');
  assert.equal(input.injectionContainerUse,'multiDose');assert.equal(input.maxWithdrawalsPerVial,20);
  assert.equal(input.discardRemainderAfterUse,true);
  assert.equal(calculationInputFor(state,{...form,referenceOnly:true},{quantity:100}).calculationBlocked,true);
  assert.equal(Object.hasOwn(calculationInputFor(state,{form:'solution'},{quantity:100}),
    'requiresFoodChainExclusion'),false);
});
