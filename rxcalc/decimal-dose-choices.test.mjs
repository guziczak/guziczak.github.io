import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { LIQUID_STARTER_REGIMENS } from './liquid-starters.js';
import { calculate } from './engine.js';
import { liquidDoseChoices, liquidDoseChoicesMarkup } from './liquid-doses.js';

const form=DRUGS.find(d=>d.id==='amoxicillin-clavulanate').forms.find(f=>f.id==='augmentin-400-57');
const source=LIQUID_STARTER_REGIMENS.find(s=>s.id==='dental-augmentin-suspension-adult-substitution');
const childSource=HUMAN_REGIMENS.find(s=>s.id==='dental-augmentin-400-57-child');
const context={patientKind:'human',formId:form.id,specialty:'dental',patientType:'adult',
  doseMode:'fixed',dose:875,frequency:2,days:7,weight:70,age:35,ageUnit:'years',
  renalStatus:'unknown',crcl:null,roundingStep:null};
const options={source,doseMode:'fixed',weight:70,frequency:2,view:'dose',
  eligibility:{valid:true},roundDoseChoices:true,page:0};
const choices=(step,extra={})=>liquidDoseChoices(form,{...options,roundingStep:step,
  roundingContext:{form,source,context:{...context,roundingStep:step},limits:{single:null,daily:null}},...extra});
const actualResult=(candidate,step,extra={})=>calculate({form:'suspension',unitLabel:'ml',
  concentrationMg:400,concentrationMl:5,doseMode:'fixed',dose:candidate.value,
  frequency:2,weight:70,days:7,packageSize:70,roundingStep:step,
  maxSingleMg:source.maxSingleMg,maxDailyMg:source.maxDailyMg,...extra});
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} differs from ${expected}`);
const codes=candidate=>candidate.warnings.map(w=>w.code);
const text=markup=>markup.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const tile=(markup,ml)=>[...markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
  .map(match=>match[0]).find(button=>button.includes('data-action="liquid-dose"')
    &&button.includes(`data-value="${ml}"`));

test('decimal dose rounding keeps the 875 mg source anchor and original action identity',()=>{
  const list=choices(.1),exact=list.find(c=>c.value===875);
  assert.ok(exact,'The nominal source dose must remain available');
  assert.equal(exact.allowed,true);
  assert.equal(exact.ml,10.9375);
  assert.equal(exact.mg,875);
  assert.equal(exact.value,875);
  assert.equal(exact.roundedDose.ml,10.9);
  assert.equal(exact.roundedDose.mg,872);
  assert.equal(exact.roundedDose.value,872);
  close(exact.roundedDose.deltaPercent,(872/875-1)*100);
  assert.equal(exact.severity,'warning');
  assert.ok(codes(exact).includes('below-source'));
  assert.ok(codes(exact).includes('decimal-rounding'));
  assert.ok(!codes(exact).includes('single-limit'));
  assert.ok(!codes(exact).includes('daily-limit'));
  const result=actualResult(exact,.1);
  assert.equal(result.valid,true);
  assert.equal(result.singleUnits,exact.roundedDose.ml);
  assert.equal(result.singleMg,exact.roundedDose.mg);
  assert.equal(source.dose,875);
  assert.equal(list.browser.settings.roundDoseChoices,true);
  assert.equal(list.browser.settings.roundingStep,.1);
});

test('rounded tiles show the actual volume, actual mg and delta without a source-compliance badge',()=>{
  const list=choices(.1);
  const markup=liquidDoseChoicesMarkup(list,{dose:875,unit:'mg',basis:'amoksycyliny'});
  const selected=tile(markup,10.9375);
  assert.ok(selected);
  assert.match(selected,/aria-pressed="true"/);
  assert.doesNotMatch(selected,/\sdisabled(?:\s|>)/);
  assert.match(text(selected),/875 mg/);
  assert.match(text(selected),/Po zaokrągleniu: 10,9 ml na podanie/);
  assert.match(text(selected),/872 mg/);
  assert.match(text(selected),/Zmiana -0,34%/);
  assert.doesNotMatch(selected,/liquid-dose-source|Dawka ze źródła|Liczbowo w schemacie/);
});

test('rounding 875 mg to hundredths checks actual 875.2 mg against both source ceilings',()=>{
  const list=choices(.01),exact=list.find(c=>c.value===875);
  assert.equal(exact.allowed,true,'A tile remains a selectable arithmetic input');
  assert.equal(exact.roundedDose.ml,10.94);
  assert.equal(exact.roundedDose.mg,875.2);
  assert.equal(exact.severity,'critical');
  for(const code of ['above-source','single-limit','daily-limit','decimal-rounding'])
    assert.ok(codes(exact).includes(code),code);
  assert.notEqual(exact.roundingAssessment?.state,'reviewed');
  const result=actualResult(exact,.01);
  assert.equal(result.valid,false,'Existing independent limits still prevent export');
  assert.equal(result.singleUnits,exact.roundedDose.ml);
  assert.equal(result.singleMg,exact.roundedDose.mg);
  assert.equal(source.maxSingleMg,875);
  assert.equal(source.maxDailyMg,1750);
  const selected=tile(liquidDoseChoicesMarkup(list,{dose:875,unit:'mg'}),10.9375);
  assert.match(selected,/liquid-dose-critical/);
  assert.match(text(selected),/875,2 mg/);
});

test('pediatric lower and upper bounds are evaluated after rounding in mg/kg/day',()=>{
  const child={source:childSource,doseMode:'perKgDay',weight:20,roundingContext:null};
  const tenths=choices(.1,child);
  assert.deepEqual(tenths.map(c=>c.value),[25,35,45]);
  const low=tenths.find(c=>c.value===25),middle=tenths.find(c=>c.value===35);
  assert.equal(low.allowed,true);
  assert.equal(low.roundedDose.ml,3.1);
  assert.equal(low.roundedDose.value,24.8);
  assert.ok(codes(low).includes('below-range'));
  assert.equal(middle.roundedDose.ml,4.4);
  assert.equal(middle.roundedDose.value,35.2);
  assert.deepEqual(codes(middle),['decimal-rounding']);
  assert.equal(middle.severity,'warning');
  const high=choices(.01,child).find(c=>c.value===45);
  assert.equal(high.roundedDose.ml,5.63);
  assert.equal(high.roundedDose.value,45.04);
  assert.ok(codes(high).includes('above-range'));
  assert.equal(high.severity,'critical');
  const result=actualResult(high,.01,{doseMode:'perKgDay',weight:20,
    maxSingleMg:null,maxDailyMg:null});
  assert.equal(result.singleUnits,high.roundedDose.ml);
  close(result.dailyMg/20,high.roundedDose.value);
});

test('actual rounded volumes and weight-based amounts are used for independent ceilings',()=>{
  const bounded={doseMode:'perKgDose',dose:10,frequency:2,
    maxUnitsPerDose:1.25,maxDailyUnits:2.5,maxSingleMgPerKg:10,maxDailyMgPerKg:20};
  const exact=choices(.1,{source:bounded,doseMode:'perKgDose',weight:10,
    roundingContext:null,volumes:[1.25]}).at(0);
  assert.equal(exact.value,10);
  assert.equal(exact.roundedDose.ml,1.3);
  assert.equal(exact.roundedDose.value,10.4);
  assert.ok(codes(exact).includes('single-limit'));
  assert.ok(codes(exact).includes('daily-limit'));
  assert.equal(exact.severity,'critical');
});

test('switching the toggle off restores the exact source amount and compliance state',()=>{
  const rounded=choices(.1).find(c=>c.value===875);
  const exact=choices(null,{roundDoseChoices:false}).find(c=>c.value===875);
  assert.ok(rounded.roundedDose);
  assert.equal(exact.allowed,true);
  assert.equal(exact.ml,10.9375);
  assert.equal(exact.value,875);
  assert.equal(exact.roundedDose,undefined);
  assert.equal(exact.severity,null);
  assert.deepEqual(exact.warnings,[]);
});

test('volume presentation preserves its grid and exact 11 ml review rule with the flag on',()=>{
  const on=choices(.1,{view:'volume'}),off=choices(.1,{view:'volume',roundDoseChoices:false});
  assert.deepEqual(on,off);
  for(const candidate of on.filter(c=>c.allowed)) {
    close(candidate.ml/.1,Math.round(candidate.ml/.1));
    assert.equal(candidate.roundedDose,undefined);
    const result=actualResult(candidate,.1);
    assert.equal(result.singleUnits,candidate.ml);
    assert.equal(result.singleMg,candidate.mg);
  }
  const named=on.find(c=>c.ml===11);
  assert.equal(named.value,880);
  assert.equal(named.roundingAssessment.state,'needs-review');
  assert.equal(named.severity,'warning');
  assert.equal(on.browser.settings.roundingStep,.1);
});

test('a nonzero nominal dose rounded to zero stays disabled',()=>{
  const zero=choices(1,{source:{doseMode:'fixed',dose:1},roundingContext:null,
    volumes:[.0125]}).at(0);
  assert.equal(zero.value,1);
  assert.equal(zero.allowed,false);
  assert.equal(zero.roundedDose,undefined);
  assert.match(zero.reason,/zerową dawkę/);
});

test('the decimal opt-in cannot silently change legacy grid behavior',()=>{
  const legacy=choices(.1,{roundDoseChoices:false});
  assert.ok(legacy.every(c=>c.value!==875||!c.allowed));
  for(const candidate of legacy.filter(c=>c.allowed)) {
    close(candidate.ml/.1,Math.round(candidate.ml/.1));
    assert.equal(candidate.roundedDose,undefined);
  }
  assert.notEqual(legacy.browser.key,choices(.1).browser.key);
});
