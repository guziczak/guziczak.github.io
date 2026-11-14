import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sourceInitialValues, sourceEditState, sourceEditMarkup} from './regimen-edit.js';
import {resolveHumanRegimen} from './human-regimen-engine.js';
import {HUMAN_REGIMENS} from './human-regimens.js';
import {DRUGS} from './catalogue.js';
import {calculate} from './engine.js';
import {ingredientDailyDose} from './daily-dose.js';
import {humanDosingText} from './dental-output.js';
import {tabletDoseChoices} from './tablet-doses.js';

const source=HUMAN_REGIMENS.find(r=>r.id==='dental-augmentin-tablet-500-125-ge40');
const drug=DRUGS.find(d=>d.id==='amoxicillin-clavulanate');
const form=drug.forms.find(f=>f.id==='augmentin-tablet-500-125');
const context={formId:form.id,specialty:'dental',patientType:'adult',age:35,ageUnit:'years',weight:70,days:7,dose:500,frequency:3,renalStatus:'unknown'};
const editable={allowNumericOverrides:true};
const resolve=(changes={})=>resolveHumanRegimen(source,{...context,...changes},editable);
const input={form:'tablet',patientKind:'human',strengthMg:500,allowedFractions:[1],packageSize:14,doseMode:'fixed',dose:500,frequency:3,days:7,weight:70,unitLabel:'tabl.'};

test('fixed values are seeded only on deliberate selection or restore',()=>{
  assert.deepEqual(sourceInitialValues(source),{dose:'500',frequency:'3'});
  assert.equal(sourceEditState(source,{dose:'500,0',frequency:'3'}).modified,false);
  assert.equal(sourceEditState(source,{dose:'1000',frequency:'3'}).modified,true);
  assert.equal(sourceEditState(source,{dose:'',frequency:'3'}).modified,true);
  const ranged=HUMAN_REGIMENS.find(r=>r.id==='dental-ospamox-child-tid');
  assert.deepEqual(sourceInitialValues(ranged),{dose:'',frequency:'3'});
  assert.equal(sourceEditState(ranged,{dose:'45',frequency:'3'}).modified,false);
  assert.equal(sourceEditState(ranged,{dose:'45',frequency:'2'}).modified,true);
});

test('strict resolver remains unchanged; editing opts in explicitly',()=>{
  assert.equal(resolveHumanRegimen(source,{...context,frequency:2}).valid,false);
  const changed=resolve({frequency:2});
  assert.equal(changed.valid,true);
  assert.equal(changed.frequency,2);
  assert.equal(changed.dose,500);
  assert.match(changed.warnings.join(' '),/Częstotliwość została zmieniona/);
  assert.equal(changed.maxDailyMg,1500);
  assert.equal(changed.maxSingleMg,500);
});

test('an entered excessive dose stays entered and is rejected by preserved ceilings',()=>{
  const changed=resolve({dose:1000});
  assert.equal(changed.dose,1000);
  assert.equal(changed.valid,false);
  assert.match(changed.errors.join(' '),/jednorazowa przekracza/);
  assert.match(changed.errors.join(' '),/dobowa przekracza/);
  assert.equal(changed.maxDailyMg,1500);
  const r=calculate({...input,dose:1000,maxDailyMg:changed.maxDailyMg,maxSingleMg:changed.maxSingleMg});
  assert.equal(r.singleUnits,2);
  assert.equal(r.valid,false);
  const daily=ingredientDailyDose({form,drug,input:{...input,dose:1000,days:null},source,sourceCheck:changed});
  assert.equal(daily.rows[0].daily,3000);
  assert.equal(daily.rows[1].daily,750);
  assert.equal(daily.rows[0].ceiling,1500);
  assert.equal(daily.rows[1].ceiling,375);
  assert.equal(daily.exceeded,true);
});

test('blank, invalid and non-finite edits never silently refill a fixed source',()=>{
  for(const value of ['',null,undefined,0,-5,NaN,Infinity,'500']) {
    const r=resolve({dose:value});
    assert.equal(r.dose,null);
    assert.equal(r.valid,false);
    assert.ok(r.errors.length>0);
  }
  for(const value of ['',null,undefined,0,1.5,49,NaN,Infinity]) {
    const r=resolve({frequency:value});
    assert.equal(r.frequency,null);
    assert.equal(r.valid,false);
  }
});

test('source range and frequency-option constraints are not removed by editing',()=>{
  const r=HUMAN_REGIMENS.find(r=>r.id==='dental-ibuprom-200-over12');
  const c={...context,formId:'ibuprom-200',dose:200,frequency:1};
  assert.equal(resolveHumanRegimen(r,c,editable).valid,true);
  for(const change of [{dose:100},{dose:600},{frequency:8}]) {
    assert.equal(resolveHumanRegimen(r,{...c,...change},editable).valid,false);
  }
});

test('patient, renal, formulation, duration and lower manual limits still apply',()=>{
  for(const change of [{weight:39},{weight:null},{age:-1},{crcl:20},{crcl:30},{renalStatus:'impaired'},{days:0},{days:1.5},{formId:'wrong'}]) {
    assert.equal(resolve(change).valid,false,JSON.stringify(change));
  }
  assert.equal(calculate({...input,frequency:2,maxDailyMg:800}).valid,false);
  assert.equal(calculate({...input,dose:250,frequency:2}).valid,false); // undivided Augmentin tablet
  const missingDuration=resolve({frequency:2,days:null});
  assert.equal(missingDuration.valid,false);
  const daily=ingredientDailyDose({form,drug,input:{...input,frequency:2,days:null},source,sourceCheck:missingDuration});
  assert.equal(daily.rows[0].daily,1000);
  assert.equal(daily.rows[1].daily,250);
});

test('fixed source selection can expose tablet shortcuts without disabling safety checks',()=>{
  assert.deepEqual(tabletDoseChoices(form,{source}),[]);
  const choices=tabletDoseChoices(form,{source,allowFixedSource:true,frequency:3,maxDailyMg:1500,maxSingleMg:500});
  assert.equal(choices.find(c=>c.tablets===1).allowed,true);
  assert.equal(choices.find(c=>c.tablets===2).allowed,false);
  assert.equal(choices.find(c=>c.tablets===0.5).allowed,false);
});

test('instruction-only workflows do not become numeric overriding workflows',()=>{
  const instruction=HUMAN_REGIMENS.find(r=>r.doseMode==='instruction');
  const c={...context,formId:instruction.formIds[0],dose:9999,frequency:48};
  assert.equal(sourceInitialValues(instruction),null);
  assert.equal(sourceEditState(instruction,c).modified,false);
  assert.equal(sourceEditMarkup(instruction,c,'mg'),'');
  assert.deepEqual(resolveHumanRegimen(instruction,c,editable),resolveHumanRegimen(instruction,c));
});

test('restored source values clear modified provenance but do not alter the source record',()=>{
  const original=structuredClone(source);
  const draft={...context,dose:'1000',frequency:'2',manualMax:'800',days:'9',extraInstructions:'Sprawdzić'};
  Object.assign(draft,sourceInitialValues(source));
  assert.equal(sourceEditState(source,draft).modified,false);
  assert.equal(draft.days,'9');assert.equal(draft.manualMax,'800');
  assert.equal(draft.extraInstructions,'Sprawdzić');
  assert.deepEqual(source,original);
});

test('modified export uses actual frequency and never includes conflicting source prose',()=>{
  const selected=HUMAN_REGIMENS.find(r=>r.id==='dental-ospamox-child-tid');
  const settings={source:selected,amount:'5 ml',route:'doustnie',frequency:2,days:7};
  assert.match(humanDosingText(settings),/w 3 podaniach/);
  const ds=humanDosingText({...settings,sourceModified:true,extraInstructions:'Wstrząsnąć przed użyciem.'});
  assert.match(ds,/2 razy na dobę/);
  assert.doesNotMatch(ds,/w 3 podaniach/);
  assert.match(ds,/Wstrząsnąć przed użyciem/);
  const prn=HUMAN_REGIMENS.find(r=>r.id==='dental-ibuprom-200-over12');
  const text=humanDosingText({...settings,source:prn,sourceModified:true,effectiveDailyLimit:800});
  assert.match(text,/w razie potrzeby/);assert.match(text,/co najmniej 4 godz/);assert.match(text,/800 mg/);
});

test('edit notice retains source amounts, restoration and HTML escaping',()=>{
  const html=sourceEditMarkup(source,{dose:'1000',frequency:'2'},'<script>mg</script>');
  assert.match(html,/Zmodyfikowany przez użytkownika/);
  assert.match(html,/Źródło: 500/);
  assert.match(html,/3 × na dobę/);
  assert.match(html,/Przywróć wartości ze źródła/);
  assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);
});

test('edits do not mutate frozen source or patient objects',()=>{
  const selected=Object.freeze(structuredClone(source));
  const patient=Object.freeze({...context,dose:1000,frequency:2});
  assert.doesNotThrow(()=>resolveHumanRegimen(selected,patient,editable));
  assert.equal(patient.dose,1000);assert.equal(selected.dose,500);
});

test('runtime, source mirror and offline shell include the editing helper',async()=>{
  for(const path of ['sw.js','build.mjs'])assert.ok((await readFile(new URL(path,import.meta.url),'utf8')).includes("'regimen-edit.js'"));
  const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
  assert.match(app,/syncSourceRegimen\(\{ initialize:true \}\)/);
  assert.match(app,/case 'restore-source-values'/);
  assert.match(app,/allowNumericOverrides:editable/);
  assert.match(app,/sourceModified:sourceIsModified\(\)/);
});
