import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { availableHumanRegimens,resolveHumanRegimen } from './human-regimen-engine.js';
import { calculate } from './engine.js';
import { ingredientDailyDose } from './daily-dose.js';
import { sourceInitialValues,sourceEditState } from './regimen-edit.js';
import { liquidDoseChoices as evaluateLiquidChoices,liquidDoseChoicesMarkup,supportsLiquidChoices } from './liquid-doses.js';
import { LIQUID_STARTER_REGIMENS,liquidStarterMarkup } from './liquid-starters.js';
const liquidDoseChoices=(form,options={})=>evaluateLiquidChoices(form,{...options,adaptive:false});
const drug=DRUGS.find(d=>d.id==='amoxicillin-clavulanate');
const form=drug.forms.find(f=>f.id==='augmentin-400-57');
const starter=LIQUID_STARTER_REGIMENS[0];
const source=HUMAN_REGIMENS.find(r=>r.id==='dental-augmentin-400-57-child');
const context={formId:form.id,specialty:'dental',patientType:'adult',weight:70,age:35,ageUnit:'years',days:7,renalStatus:'unknown',dose:875,frequency:2};
const choices=(options={})=>liquidDoseChoices(form,options);
const input={patientKind:'human',form:'suspension',doseMode:'fixed',dose:875,frequency:2,days:1,weight:70,concentrationMg:400,concentrationMl:5,unitLabel:'ml',packageSize:35};

test('three volume shortcuts use the exact product concentration, with no automatic selection',()=>{
  const list=choices();assert.deepEqual(list.map(c=>[c.ml,c.mg,c.value,c.allowed]),[[2.5,200,200,true],[5,400,400,true],[10,800,800,true]]);
  const html=liquidDoseChoicesMarkup(list,{basis:'amoksycyliny'});
  assert.equal((html.match(/aria-pressed="false"/g)||[]).length,3);
  assert.ok(html.includes('nie zalecane dawki'));assert.ok(html.includes('amoksycyliny'));
});
test('ml mode writes ml, not mg, while retaining ingredient labels',()=>{
  assert.deepEqual(choices({doseMode:'units'}).map(c=>c.value),[2.5,5,10]);
  assert.deepEqual(choices({doseMode:'units'}).map(c=>c.mg),[200,400,800]);
});
test('other exact concentrations do not inherit Augmentin amounts',()=>{
  for(const [concentrationMg,expected] of [[250,[125,250,500]],[500,[250,500,1000]]])
    assert.deepEqual(liquidDoseChoices({...form,concentrationMg}).map(c=>c.mg),expected);
});
test('weight-based modes convert a single volume using actual weight and frequency',()=>{
  assert.deepEqual(choices({doseMode:'perKgDay',weight:20,frequency:2}).map(c=>c.value),[20,40,80]);
  assert.deepEqual(choices({doseMode:'perKgDose',weight:20,frequency:3}).map(c=>c.value),[10,20,40]);
});
test('missing weight or frequency never becomes an assumed patient or zero dose',()=>{
  for(const weight of [null,undefined,0,-1,NaN,Infinity,501,'20'])
    assert.ok(choices({doseMode:'perKgDay',weight,frequency:2}).every(c=>!c.allowed&&c.value===null));
  for(const frequency of [null,undefined,0,NaN])
    assert.ok(choices({doseMode:'perKgDay',weight:20,frequency}).every(c=>!c.allowed&&c.value===null));
});
test('invalid frequencies disable shortcuts; missing frequency does not block absolute amount editing',()=>{
  for(const frequency of [0,-1,1.5,49,NaN,Infinity,'2'])assert.ok(choices({frequency}).every(c=>!c.allowed));
  assert.ok(choices({frequency:null}).every(c=>c.allowed));
});
test('non-mg suspensions only expose volume controls, never invented mg',()=>{
  const f={...form,unitOnly:true,concentrationMg:null,concentrationMl:null};
  assert.ok(liquidDoseChoices(f,{doseMode:'units'}).every(c=>c.allowed&&c.mg===null));
  assert.ok(liquidDoseChoices(f).every(c=>!c.allowed));
  assert.ok(!liquidDoseChoicesMarkup(liquidDoseChoices(f,{doseMode:'units'}),{unit:'ml'}).includes(' mg'));
});
test('no shortcuts for veterinary, blocked, instructional or non-suspension formulations',()=>{
  for(const changed of [{form:'tablet'},{form:'injection'},{form:'solution'},{unitLabel:'g'},{calculationBlocked:true},{referenceOnly:true},{calculationMode:'instruction'}])
    assert.deepEqual(liquidDoseChoices({...form,...changed}),[]);
  assert.deepEqual(choices({veterinary:true}),[]);assert.equal(supportsLiquidChoices(form,true),false);
});
test('single and daily limits flag shortcuts without blocking entry',()=>{
  assert.deepEqual(choices({maxSingleMg:500}).map(c=>c.allowed),[true,true,true]);
  assert.deepEqual(choices({maxSingleMg:500}).map(c=>c.severity),[null,null,'critical']);
  assert.deepEqual(choices({frequency:2,maxDailyMg:700}).map(c=>c.allowed),[true,true,true]);
  assert.deepEqual(choices({frequency:2,maxDailyMg:700}).map(c=>c.severity),[null,'critical','critical']);
  assert.ok(choices({maxDailyMg:NaN}).every(c=>!c.allowed));
});
test('source range and mg/kg daily boundaries remain active',()=>{
  const list=choices({source,doseMode:'perKgDay',weight:20,frequency:2,eligibility:{valid:true}});
  assert.deepEqual(list.map(c=>c.allowed),[true,true,true]);
  assert.deepEqual(list.map(c=>c.severity),['warning',null,'critical']);
  assert.ok(choices({source,doseMode:'fixed'}).every(c=>!c.allowed));
});
test('patient ineligibility, identity and intervals block entry; unit ceilings warn',()=>{
  assert.ok(choices({source:starter,eligibility:{valid:false}}).every(c=>!c.allowed));
  assert.ok(choices({source:{...starter,formIds:['other']}}).every(c=>!c.allowed));
  assert.ok(choices({source:starter,frequency:3}).every(c=>!c.allowed));
  assert.deepEqual(choices({source:{doseMode:'fixed',maxUnitsPerDose:5}}).map(c=>c.severity),[null,null,'critical']);
  assert.deepEqual(choices({source:{doseMode:'fixed',maxDailyUnits:10},frequency:2}).map(c=>c.severity),[null,null,'critical']);
});
test('a volume shortcut never silently changes through an incompatible rounding step',()=>{
  assert.deepEqual(choices({roundingStep:1}).map(c=>c.allowed),[false,true,true]);
  assert.ok(choices({roundingStep:.1}).every(c=>c.allowed));
  assert.ok(choices({roundingStep:NaN}).every(c=>!c.allowed));
});
test('all supported mode shortcuts agree with the existing engine for the same volume',()=>{
  for(const doseMode of ['fixed','units','perKgDay','perKgDose'])for(const c of choices({doseMode,weight:20,frequency:2})) {
    const result=calculate({...input,doseMode,dose:c.value,weight:20});
    assert.equal(result.valid,true);assert.equal(result.singleUnits,c.ml);assert.equal(result.singleMg,c.mg);
  }
});
test('markup marks one active tile and safely escapes labels',()=>{
  const html=liquidDoseChoicesMarkup(choices(),{dose:400,basis:'<script>bad</script>'});
  assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
  assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
});
test('the starting source is limited to the exact adult human product, not children or veterinary',()=>{
  assert.equal(availableHumanRegimens(LIQUID_STARTER_REGIMENS,context).length,1);
  for(const change of [{patientType:'child'},{formId:'ospamox-250'},{formId:'augmentin-tablet-875-125'},{specialty:'veterinary'}])
    assert.equal(availableHumanRegimens(LIQUID_STARTER_REGIMENS,{...context,...change}).length,0);
});
test('explicit source selection fills fixed values only and does not invent duration or weight',()=>{
  assert.deepEqual(sourceInitialValues(starter),{dose:'875',frequency:'2'});
  assert.equal(starter.fixedDays,undefined);assert.equal(starter.defaultDays,undefined);
  assert.equal(resolveHumanRegimen(starter,context).valid,true);
  assert.equal(resolveHumanRegimen(starter,{...context,weight:null}).valid,false);
  assert.equal(resolveHumanRegimen(starter,{...context,days:null}).valid,false);
});
test('source retains scope and both documents without claiming a local suspension default',()=>{
  assert.equal(starter.maxDailyMg,1750);assert.equal(starter.maxSingleMg,875);
  assert.ok(starter.sourceUrl.endsWith('/7496/characteristic'));
  assert.ok(starter.additionalSources.some(s=>s.url.includes('fda.gov')));
  assert.ok(starter.additionalSources.some(s=>s.url.endsWith('/8695/characteristic')));
  const html=liquidStarterMarkup([starter]);assert.ok(html.includes('nie gotowy schemat z polskiej ChPL zawiesiny'));
  assert.ok(html.includes('trudnością połykania'));assert.ok(html.includes('875 mg · 2 ×/dobę'));
});
test('known renal impairment, low weight, excessive dose or interval violation do not become valid defaults',()=>{
  for(const changed of [{weight:39},{crcl:30},{crcl:29},{renalStatus:'impaired'},{dose:900},{frequency:3}]) {
    const result=resolveHumanRegimen(starter,{...context,...changed},{allowNumericOverrides:true});
    assert.equal(result.valid,false,JSON.stringify(changed));
  }
});
test('daily preview keeps the actual suspension ratio instead of labelling clavulanate as 125 mg',()=>{
  const sourceCheck=resolveHumanRegimen(starter,context);
  const note=ingredientDailyDose({form,drug,input:{...input,days:null},source:starter,sourceCheck});
  assert.equal(note.dailyUnits,21.875);assert.equal(note.rows[0].daily,1750);
  assert.equal(note.rows[1].daily,249.375);assert.equal(note.rows[1].ceiling,249.375);
  assert.equal(note.exceeded,false);
});
test('pediatric range starts empty and no range endpoint is auto-selected',()=>{
  assert.deepEqual(sourceInitialValues(source),{dose:'',frequency:'2'});
  assert.ok(liquidStarterMarkup([source]).includes('25–45 mg/kg/dobę'));
});
test('manual edits remain distinct from the source and restoring is deterministic',()=>{
  assert.equal(sourceEditState(starter,{dose:'800',frequency:'2'}).modified,true);
  assert.equal(sourceEditState(starter,{dose:'875',frequency:'2'}).modified,false);
  assert.equal(sourceEditState(starter,{dose:'',frequency:'2'}).modified,true);
});
test('shortcut computation leaves frozen patient inputs and source data intact',()=>{
  const args={doseMode:'fixed',source:structuredClone(starter),frequency:2,weight:70};
  const before=structuredClone(args);Object.freeze(args.source);Object.freeze(args);
  choices(args);liquidStarterMarkup([args.source]);assert.deepEqual(args,before);
});
test('new modules are included in offline/build paths and CSS is loaded',async()=>{
  for(const name of ['liquid-doses.js','liquid-starters.js','liquid-doses.css'])for(const file of ['sw.js','build.mjs'])
    assert.ok((await readFile(new URL(file,import.meta.url),'utf8')).includes(`'${name}'`));
  assert.ok((await readFile(new URL('index.html',import.meta.url),'utf8')).includes('./liquid-doses.css'));
});
