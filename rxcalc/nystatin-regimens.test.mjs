import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { NYSTATIN_REGIMENS as records } from './nystatin-regimens.js';
import { availableHumanRegimens, resolveHumanRegimen } from './human-regimen-engine.js';
import { calculate } from './engine.js';
import { ingredientDailyDose } from './daily-dose.js';
import { dailyDoseMarkup } from './dose-safety-view.js';
import { instructionDosingText, humanDosingText } from './dental-output.js';
import { liquidStarterMarkup } from './liquid-starters.js';

const drug=DRUGS.find(d=>d.id==='nystatin'), form=drug.forms[0];
const byId=id=>records.find(r=>r.id===`nystatin-${id}`);
const context=(source,overrides={})=>({formId:form.id,specialty:'dental',
  patientType:source.patientTypes[0],age:source.patientTypes[0]==='child'?6:35,ageUnit:'years',
  dose:source.dose??source.doseRange?.min,frequency:source.frequency??2,days:14,...overrides});
const input=(source,overrides={})=>({patientKind:'human',form:'suspension',doseMode:'units',
  dose:source.dose??source.doseRange?.min,frequency:source.frequency,days:14,unitLabel:'ml',
  packageSize:28,shelfLifeDays:7,concentrationMg:null,concentrationMl:null,...overrides});

test('Nystatin source options keep indication and age groups explicit',()=>{
  assert.equal(records.length,6);
  assert.deepEqual(availableHumanRegimens(records,{formId:form.id,specialty:'dental',patientType:'adult'})
    .map(r=>r.id),['nystatin-adult-oral','nystatin-adult-gastrointestinal','nystatin-adult-antibiotic-prophylaxis']);
  for(const source of records){
    assert.equal(resolveHumanRegimen(source,context(source)).valid,true,source.id);
    assert.equal(source.maxDailyMg,undefined);
    assert.equal(source.maxDailyUnits,undefined);
    assert.equal(source.fixedDays,undefined);
  }
  assert.equal(resolveHumanRegimen(byId('adult-oral'),context(byId('adult-oral'),{age:17})).valid,false);
  assert.equal(resolveHumanRegimen(byId('child-oral'),context(byId('child-oral'),{age:18})).valid,false);
});

test('quantitative regimens produce the ChPL daily IU amounts without inventing mg',()=>{
  for(const [id,dose,frequency,expected] of [
    ['adult-oral',1,4,400000],['child-oral',1,4,400000],
    ['adult-gastrointestinal',5,4,2000000],['adult-gastrointestinal',10,4,4000000],
    ['child-gastrointestinal',.5,4,200000],['child-gastrointestinal',5,4,2000000],
    ['adult-antibiotic-prophylaxis',5,3,1500000],
  ]){
    const source=byId(id), entered=input(source,{dose,frequency});
    const resolved=resolveHumanRegimen(source,context(source,{dose,frequency}));
    assert.equal(resolved.valid,true,id);
    const result=calculate(entered);
    assert.equal(result.valid,true,result.errors.join(' '));
    assert.equal(result.singleMg,null);
    const note=ingredientDailyDose({form,drug,input:entered,source,sourceCheck:resolved});
    assert.equal(note.rows[0].daily,expected);
    assert.equal(note.rows[0].unit,'j.m.');
    assert.equal(note.rows[0].ceiling,null);
    assert.equal(note.schemeRows[0].frequency,frequency);
    const html=dailyDoseMarkup({note,input:entered,source,eligibility:resolved});
    assert.ok(html.includes('dose-scheme-meter'));
    assert.ok(!html.includes('Brak zweryfikowanego limitu dla tego schematu'));
  }
});

test('pediatric daily range is divided by four; source boundaries are not silently overridable',()=>{
  const source=byId('child-gastrointestinal');
  for(const dose of [.499,5.001])assert.equal(resolveHumanRegimen(source,context(source,{dose}),{allowNumericOverrides:true}).valid,false);
  assert.equal(resolveHumanRegimen(source,context(source,{frequency:3}),{allowNumericOverrides:true}).valid,false);
  assert.equal(resolveHumanRegimen(source,context(source,{dose:null})).valid,false);
  assert.equal(resolveHumanRegimen(source,context(source,{days:null})).valid,false);
  const oral=byId('adult-oral');
  assert.equal(resolveHumanRegimen(oral,context(oral,{dose:2.5}),{allowNumericOverrides:true}).valid,false);
});

test('seven-day suspension shelf life does not force a seven-day therapy',()=>{
  const source=byId('adult-oral');
  for(const days of [5,7,14])assert.equal(resolveHumanRegimen(source,context(source,{days})).valid,true);
  const result=calculate(input(source));
  assert.equal(result.dailyUnits,4);
  assert.equal(result.totalUnits,56);
  assert.equal(result.packages,2);
  assert.match(humanDosingText({source,amount:'1 ml',frequency:4,days:14}),/przez 14 dni/);
});

test('brushing remains an instruction with no invented volume or mandatory duration',()=>{
  const source=byId('oral-brushing');
  assert.equal(resolveHumanRegimen(source,context(source,{dose:null,days:null})).valid,true);
  assert.equal(source.dose,undefined);
  assert.equal(source.doseRange,undefined);
  const text=instructionDosingText({source,frequency:3,days:null});
  assert.ok(text.includes('3 razy na dobę'));
  assert.ok(!text.includes('ml'));
  assert.ok(!text.includes('przez 7 dni'));
  const picker=liquidStarterMarkup([source]);
  assert.ok(picker.includes('Instrukcja miejscowa'));
  assert.ok(!picker.includes('Wybierz dawkę'));
});
