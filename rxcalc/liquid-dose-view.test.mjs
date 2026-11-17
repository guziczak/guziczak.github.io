import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { LIQUID_STARTER_REGIMENS } from './liquid-starters.js';
import { calculate } from './engine.js';
import { defaultLiquidDoseView, liquidDoseChoices, liquidDoseChoicesMarkup } from './liquid-doses.js';

const form = DRUGS.find(d => d.id === 'amoxicillin-clavulanate').forms.find(f => f.id === 'augmentin-400-57');
const source = LIQUID_STARTER_REGIMENS.find(s => s.id === 'dental-augmentin-suspension-adult-substitution');
const childSource = HUMAN_REGIMENS.find(s => s.id === 'dental-augmentin-400-57-child');
const context = {
  patientKind:'human',formId:form.id,specialty:'dental',patientType:'adult',doseMode:'fixed',
  dose:875,frequency:2,days:7,weight:70,age:35,ageUnit:'years',renalStatus:'unknown',crcl:null,roundingStep:null,
};
const roundingContext = {form,source,context,limits:{single:null,daily:null}};
const base = {source,doseMode:'fixed',weight:70,frequency:2,eligibility:{valid:true},roundingContext,page:0};
const choices = (view,changes={}) => liquidDoseChoices(form,{...base,...changes,...(view ? {view} : {})});
const html = (view,dose=875,changes={}) => liquidDoseChoicesMarkup(choices(view,changes),{dose,unit:'mg',basis:'amoksycyliny'});
const close = (actual,expected) => assert.ok(Math.abs(actual-expected)<1e-9,`${actual} differs from ${expected}`);
const buttons = markup => [...markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(m=>m[0]);
const button = (markup,action,value) => buttons(markup).find(b=>b.includes(`data-action="${action}"`)&&b.includes(`data-value="${value}"`));
const text = markup => markup.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
function currentSummary(markup) {
  const opening=/<([a-z][\w:-]*)\b[^>]*class="[^"]*\bliquid-dose-current\b[^"]*"[^>]*>/i.exec(markup);
  if(!opening)return '';
  const tags=new RegExp(`<(/?)${opening[1]}\\b[^>]*>`,'gi');
  tags.lastIndex=opening.index;
  let depth=0,match;
  while((match=tags.exec(markup))) {
    depth+=match[1]?-1:1;
    if(depth===0)return markup.slice(opening.index,tags.lastIndex);
  }
  assert.fail('Current-selection summary has no closing element');
}
function frozen(value) {
  if(value&&typeof value==='object') {
    for(const item of Object.values(value))frozen(item);
    Object.freeze(value);
  }
  return value;
}
const input = {
  patientKind:'human',form:'suspension',doseMode:'fixed',frequency:2,weight:70,days:1,
  concentrationMg:400,concentrationMl:5,unitLabel:'ml',packageSize:35,
};

test('documented mg and weight-based schemes default to dose presentation',()=>{
  assert.equal(defaultLiquidDoseView(form,{source,doseMode:'fixed'}),'dose');
  assert.equal(defaultLiquidDoseView(form,{source:childSource,doseMode:'perKgDay'}),'dose');
  assert.equal(defaultLiquidDoseView(form,{source:{doseMode:'perKgDose',doseRange:{min:10,max:20}},doseMode:'perKgDose'}),'dose');
  assert.equal(defaultLiquidDoseView(form,{source:{doseMode:'fixed',doseRange:{min:250,max:500}},doseMode:'fixed'}),'dose');
});

test('missing, mismatched or unsupported source data cannot select a dose presentation by default',()=>{
  for(const options of [
    {},{source,doseMode:'perKgDay'},{source:{...source,formIds:['other']},doseMode:'fixed'},
    {source:{doseMode:'fixed',dose:0}},{source:{doseMode:'fixed',doseRange:{min:500,max:250}}},
    {source:{doseMode:'fixed'}},{source:{doseMode:'units',dose:5},doseMode:'units'},
    {source,doseMode:'fixed',veterinary:true},
  ])assert.equal(defaultLiquidDoseView(form,options),'volume',JSON.stringify(options));
  for(const changed of [
    {concentrationMg:null},{concentrationMl:0},{unitOnly:true,concentrationMg:null,concentrationMl:null},
    {calculationBlocked:true},{referenceOnly:true},{form:'tablet'},{calculationMode:'instruction'},
  ])assert.equal(defaultLiquidDoseView({...form,...changed},{source,doseMode:'fixed'}),'volume',JSON.stringify(changed));
});

test('dose view retains the exact 875 mg source choice and its exact conversion',()=>{
  const list=choices('dose'),exact=list.find(c=>c.value===875);
  assert.ok(exact,'The source dose must remain selectable');
  assert.equal(exact.allowed,true);
  assert.equal(exact.severity,null);
  close(exact.ml,10.9375);
  close(exact.mg,875);
  const result=calculate({...input,dose:exact.value});
  close(result.singleUnits,exact.ml);
  close(result.singleMg,875);
  close(result.dailyMg,1750);
  const selected=button(html('dose'),'liquid-dose',exact.ml);
  assert.ok(selected);
  assert.match(selected,/aria-pressed="true"/);
  assert.match(text(selected),/875\s*mg/);
});

test('volume view retains the explicit 11 ml choice as 880 mg with its rounding assessment',()=>{
  const rounded=choices('volume').find(c=>c.ml===11);
  assert.ok(rounded);
  assert.equal(rounded.value,880);
  assert.equal(rounded.mg,880);
  assert.equal(rounded.roundingAssessment.state,'needs-review');
  assert.equal(rounded.severity,'warning');
  const result=calculate({...input,dose:rounded.value});
  assert.equal(result.singleUnits,11);
  assert.equal(result.dailyMg,1760);
  const selected=button(html('volume',880),'liquid-dose',11);
  assert.match(selected,/aria-pressed="true"/);
  assert.match(text(selected),/880\s*mg/);
});

test('explicit presentation buttons expose their own pressed state independently from dose tiles',()=>{
  for(const view of ['dose','volume']) {
    const markup=html(view);
    for(const candidate of ['dose','volume']) {
      const control=button(markup,'liquid-dose-view',candidate);
      assert.ok(control,`Missing ${candidate} view control`);
      assert.ok(control.includes(`aria-pressed="${candidate===view}"`));
    }
  }
});

test('switching to dose view preserves the visible actual 880 mg choice instead of selecting 875 mg',()=>{
  for(const view of ['volume','dose']) {
    const markup=html(view,880,{roundingContext:{...roundingContext,context:{...context,dose:880}}});
    const summary=currentSummary(markup);
    assert.ok(summary,'The entered value must remain visible even outside the tile set');
    assert.match(text(summary),/880\s*mg/);
    assert.match(text(summary),/11\s*ml/);
    assert.match(text(summary),/0,57\s*%/);
    const exact=button(markup,'liquid-dose',10.9375);
    if(exact)assert.match(exact,/aria-pressed="false"/);
  }
});

test('a typed off-grid value remains visible without moving the documented source target',()=>{
  const initial=choices('dose').map(c=>[c.ml,c.value]);
  const markup=html('dose',900,{roundingContext:{...roundingContext,context:{...context,dose:900}}});
  assert.match(text(currentSummary(markup)),/900\s*mg/);
  assert.match(text(currentSummary(markup)),/11,25\s*ml/);
  assert.deepEqual(choices('dose').map(c=>[c.ml,c.value]),initial);
  const exact=button(markup,'liquid-dose',10.9375);
  assert.match(exact,/aria-pressed="false"/);
});

test('source and independent limits remain active in both presentations',()=>{
  const exact=choices('dose',{maxDailyMg:1700}).find(c=>c.value===875);
  assert.equal(exact.severity,'critical');
  assert.ok(exact.warnings.some(w=>w.code==='daily-limit'));
  for(const view of ['dose','volume']) {
    const list=choices(view,{maxDailyMg:1700,roundingContext:{...roundingContext,limits:{daily:1700}}});
    for(const candidate of list.filter(c=>c.mg*2>1700))assert.equal(candidate.severity,'critical');
    assert.equal(source.dose,875);
    assert.equal(source.maxDailyMg,1750);
    assert.equal(source.maxSingleMg,875);
  }
});

test('an explicit volume grid never becomes exact source compliance merely by switching to doses',()=>{
  for(const view of ['dose','volume']) {
    const list=choices(view,{roundingStep:.1,roundingContext:{...roundingContext,context:{...context,roundingStep:.1}}});
    for(const candidate of list.filter(c=>c.allowed)) {
      close(candidate.ml/.1,Math.round(candidate.ml/.1));
      const result=calculate({...input,dose:candidate.value,roundingStep:.1});
      close(result.singleUnits,candidate.ml);
      close(result.singleMg,candidate.mg);
      if(candidate.value===875)assert.ok(candidate.severity,'A rounded source target cannot be presented as exact');
    }
    assert.ok(list.every(c=>c.value!==875||!c.allowed||c.severity));
  }
});

test('pediatric toggling changes the primary unit while preserving the same actual doses',()=>{
  const options={...base,source:childSource,doseMode:'perKgDay',weight:20,roundingContext:null};
  const doseChoices=liquidDoseChoices(form,{...options,view:'dose'});
  const volumeChoices=liquidDoseChoices(form,{...options,view:'volume'});
  assert.deepEqual(doseChoices.map(c=>[c.value,c.ml,c.mg]),volumeChoices.map(c=>[c.value,c.ml,c.mg]));
  assert.deepEqual(doseChoices.map(c=>c.value),[25,35,45]);
  const doseMarkup=liquidDoseChoicesMarkup(doseChoices,{dose:35,unit:'mg/kg/dobę'});
  const volumeMarkup=liquidDoseChoicesMarkup(volumeChoices,{dose:35,unit:'mg/kg/dobę'});
  const doseTile=button(doseMarkup,'liquid-dose',4.375),volumeTile=button(volumeMarkup,'liquid-dose',4.375);
  assert.match(doseTile,/<strong>\s*35\s*(?:<[^>]*>\s*)*mg\/kg\/dobę/);
  assert.match(volumeTile,/<strong>\s*4,375\s*(?:<[^>]*>\s*)*ml/);
  assert.match(doseTile,/aria-pressed="true"/);
  assert.match(volumeTile,/aria-pressed="true"/);
  const result=calculate({...input,doseMode:'perKgDay',dose:35,weight:20});
  close(result.singleUnits,4.375);
  close(result.dailyMg,700);
});

test('missing dose or conversion inputs do not produce a fabricated current-selection summary',()=>{
  for(const dose of [null,0,NaN])assert.equal(currentSummary(html('dose',dose)),'');
  const list=liquidDoseChoices(form,{...base,source:childSource,doseMode:'perKgDay',weight:null,view:'dose',roundingContext:null});
  assert.ok(list.every(c=>!c.allowed));
  assert.equal(currentSummary(liquidDoseChoicesMarkup(list,{dose:35,unit:'mg/kg/dobę'})),'');
});

test('legacy callers without an explicit view keep the previous shortcut calculation',()=>{
  assert.deepEqual(choices().map(c=>[c.ml,c.value]),[[10,800],[11,880],[12.5,1000]]);
});

test('rendering either view cannot mutate dose, frequency, days, rounding or source records',()=>{
  const original=frozen(structuredClone({...base,dose:880,days:7,confirmed:true}));
  const snapshot=JSON.stringify(original);
  const fixedForm=frozen(structuredClone(form));
  for(const view of ['dose','volume','dose']) {
    const list=liquidDoseChoices(fixedForm,{...original,view});
    liquidDoseChoicesMarkup(list,{dose:original.dose,unit:'mg'});
    defaultLiquidDoseView(fixedForm,original);
  }
  assert.equal(JSON.stringify(original),snapshot);
});
