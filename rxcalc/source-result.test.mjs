import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './engine.js';
import { ingredientDailyDose } from './daily-dose.js';
import { DRUGS } from './catalogue.js';
import { NYSTATIN_REGIMENS } from './nystatin-regimens.js';
import { resolveHumanRegimen } from './human-regimen-engine.js';
import { applySourceComparisonPresentation as present } from './source-result.js';
import { dailyDoseMarkup } from './dose-safety-view.js';
const drug=DRUGS.find(d=>d.id==='nystatin'),form=drug.forms[0];
const source=NYSTATIN_REGIMENS.find(r=>r.id==='nystatin-adult-oral');
const input={form:'suspension',unitLabel:'ml',doseMode:'units',dose:1,frequency:4,days:7,packageSize:28};
const sourceCheck=resolveHumanRegimen(source,{formId:form.id,specialty:'dental',patientType:'adult',age:35,ageUnit:'years',dose:1,frequency:4,days:7});
const note=ingredientDailyDose({form,drug,input,source,sourceCheck});
const options={source,sourceCheck,note};

test('an eligible matching IU comparison replaces irrelevant mg/maximum warnings with specific neutral context',()=>{
  const arithmetic=calculate(input),before=structuredClone(arithmetic);
  const shown=present(arithmetic,options);
  assert.deepEqual(arithmetic,before);
  assert.equal(shown.valid,true);
  assert.equal(shown.warnings.length,0);
  assert.equal(shown.notices.length,2);
  assert.ok(shown.notices.every(item=>item.sourceComparison===true));
  assert.equal(shown.sourceComparison.daily,400000);
  assert.equal(shown.sourceComparison.unit,'j.m.');
  assert.equal(shown.sourceComparison.ratio,1);
  assert.equal(shown.maxRatio,null);
  assert.equal(shown.singleMg,null);
});

test('manual, ineligible, changed, missing or stale comparisons preserve warnings',()=>{
  const arithmetic=calculate(input);
  for(const change of [{source:null},{sourceCheck:{valid:false}},{modified:true},{note:null},
    {note:{...note,dailyUnits:8}},{note:{...note,comparisonEligibility:{valid:false}}}])
    assert.strictEqual(present(arithmetic,{...options,...change}),arithmetic);
  const excessive=calculate({...input,dose:2});
  const excessiveNote=ingredientDailyDose({form,drug,input:{...input,dose:2},source,sourceCheck});
  assert.strictEqual(present(excessive,{...options,note:excessiveNote}),excessive);
});

test('a matching reference cannot remove clinical errors or unrelated warnings',()=>{
  const arithmetic=calculate(input);
  for(const change of [{valid:false},{errors:['Inny limit przekroczony']},{status:'critical'}]){
    const blocked={...arithmetic,...change};
    assert.strictEqual(present(blocked,options),blocked);
  }
  const warning={...arithmetic,warnings:[...arithmetic.warnings,'Oceń inne leki.']};
  const shown=present(warning,options);
  assert.deepEqual(shown.warnings,['Oceń inne leki.']);
  assert.equal(shown.status,'warning');
});

test('unchecked source conditions show a neutral pending state without a dose percentage',()=>{
  const html=dailyDoseMarkup({note,input,source,
    eligibility:{valid:false,errors:['Potwierdź warunki wybranego schematu: 2 do sprawdzenia.']}});
  assert.ok(html.includes('daily-dose-guidance'));
  assert.ok(!html.includes('class="dose-safety-notice"'));
  assert.ok(!html.includes('class="dose-scheme-current'));
});
