import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from './engine.js';
import {resolveHumanRegimen} from './human-regimen-engine.js';

// Synthetic records exercise arithmetic/validation semantics, not clinical guidance.
const source = {
  id:'dose-limit-test', formIds:['test-form'], specialties:['dental'],
  indication:'Syntetyczny schemat testowy', sourceUrl:'https://example.org/source',
  sourceLabel:'Źródło testowe', sourceSection:'4.2', sourceCheckedAt:'2026-11-22',
  doseMode:'fixed', dose:875, frequency:2, maxSingleMg:875, maxDailyMg:1750,
};
const context = {formId:'test-form', specialty:'dental', patientType:'adult',
  dose:1000, frequency:2, days:7};
const input = {form:'suspension', doseMode:'fixed', dose:1000, frequency:2, days:7,
  concentrationMg:400, concentrationMl:5, packageSize:70, unitLabel:'ml',
  maxSingleMg:875, maxDailyMg:1750};
const resolve = (record=source, values=context) => resolveHumanRegimen(record,values,{allowNumericOverrides:true});

test('numeric dose-limit issues retain original errors and distinguish validator basis',()=>{
  const arithmetic=calculate(input),regimen=resolve();
  for(const [result,basis] of [[arithmetic,'administered'],[regimen,'requested']]){
    assert.equal(result.valid,false);
    assert.equal(result.doseLimitIssues.length,2);
    assert.deepEqual(result.doseLimitIssues.map(({code,scope,basis:actualBasis,actualMg,limitMg,message})=>({
      code,scope,basis:actualBasis,actualMg,limitMg,messageInErrors:result.errors.includes(message),
    })),[
      {code:'single-dose-limit',scope:'single',basis,actualMg:1000,limitMg:875,messageInErrors:true},
      {code:'daily-dose-limit',scope:'daily',basis,actualMg:2000,limitMg:1750,messageInErrors:true},
    ]);
  }
  assert.equal(arithmetic.status,'critical');
  assert.deepEqual(arithmetic.errors,[
    'Dawka jednorazowa 1000 mg przekracza wprowadzony limit 875 mg.',
    'Dawka dobowa 2000 mg przekracza wprowadzony limit 1750 mg.',
  ]);
  assert.deepEqual(regimen.errors,[
    'Dawka jednorazowa przekracza limit wybranego schematu.',
    'Dawka dobowa przekracza limit wybranego schematu.',
  ]);
});

test('administered issues use the actual rounded dose, even when the requested dose meets limits',()=>{
  const record={...source,dose:490,maxSingleMg:495,maxDailyMg:990};
  const arithmetic=calculate({...input,dose:490,concentrationMg:100,concentrationMl:1,
    roundingStep:1,maxSingleMg:495,maxDailyMg:990});
  const regimen=resolve(record,{...context,dose:490});
  assert.equal(regimen.valid,true);
  assert.deepEqual(regimen.doseLimitIssues,[]);
  assert.equal(arithmetic.valid,false);
  assert.equal(arithmetic.singleMg,500);
  assert.deepEqual(arithmetic.doseLimitIssues.map(issue=>issue.actualMg),[500,1000]);
});

test('requested issues remain when rounding moves the administered dose below the limits',()=>{
  const record={...source,dose:500,maxSingleMg:505,maxDailyMg:1010};
  const arithmetic=calculate({...input,dose:510,concentrationMg:100,concentrationMl:1,
    roundingStep:1,maxSingleMg:505,maxDailyMg:1010});
  const regimen=resolve(record,{...context,dose:510});
  assert.equal(arithmetic.valid,true);
  assert.equal(arithmetic.singleMg,500);
  assert.deepEqual(arithmetic.doseLimitIssues,[]);
  assert.equal(regimen.valid,false);
  assert.deepEqual(regimen.doseLimitIssues.map(issue=>issue.actualMg),[510,1020]);
});

test('early invalid results expose no invented dose-limit issues',()=>{
  assert.deepEqual(calculate().doseLimitIssues,[]);
  assert.deepEqual(resolveHumanRegimen(null,{}).doseLimitIssues,[]);
});
