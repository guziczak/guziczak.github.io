import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { LIQUID_STARTER_REGIMENS } from './liquid-starters.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { calculate } from './engine.js';
import { assessDoseRounding } from './rounding-assessment.js';
import { liquidDoseChoices, liquidDoseChoicesMarkup } from './liquid-doses.js';
import { regimenComparisonRows, regimenPercentModel,
  regimenDosePercentMarkup, regimenMeterMarkup } from './dose-regimen.js';

const form=DRUGS.find(d=>d.id==='amoxicillin-clavulanate').forms.find(f=>f.id==='augmentin-400-57');
const source=LIQUID_STARTER_REGIMENS.find(s=>s.id==='dental-augmentin-suspension-adult-substitution');
const context={patientKind:'human',formId:form.id,specialty:'dental',patientType:'adult',
  doseMode:'fixed',dose:875,frequency:2,days:7,weight:70,age:35,ageUnit:'years',
  renalStatus:'normal',crcl:90,roundingMode:'auto',roundingStep:1};
const settings=(updates={},changes={})=>({source,doseMode:'fixed',weight:70,frequency:2,
  eligibility:{valid:true},view:'dose',roundDoseChoices:true,page:0,
  roundingStep:updates.roundingStep===undefined?1:updates.roundingStep,
  roundingContext:{form,source,context:{...context,...updates},limits:{single:null,daily:null}},
  ...changes});
const choices=(updates={},changes={},product=form)=>liquidDoseChoices(product,settings(updates,changes));
const nominal=list=>list.find(c=>c.value===875);
const codes=c=>c.warnings.map(w=>w.code);
const tile=(markup,ml)=>[...markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
  .map(m=>m[0]).find(b=>b.includes('data-action="liquid-dose"')&&b.includes(`data-value="${ml}"`));
const text=markup=>markup.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const close=(value,expected)=>assert.ok(Math.abs(value-expected)<1e-9,`${value} != ${expected}`);

test('Auto evaluates the 875 mg candidate independently from a current 800 mg field',()=>{
  const list=choices({dose:800,roundingStep:null}),candidate=nominal(list);
  assert.deepEqual(list.map(c=>c.value),[800,875,1000]);
  assert.equal(candidate.ml,10.9375);assert.equal(candidate.mg,875);
  assert.equal(candidate.roundedDose.ml,11);assert.equal(candidate.roundedDose.mg,880);
  assert.equal(candidate.roundingAssessment.state,'rule');assert.equal(candidate.severity,'info');
  assert.deepEqual(codes(candidate),['rounding-rule']);
  assert.equal(list[0].roundedDose,undefined);assert.equal(list[2].roundedDose,undefined);
  assert.equal(list[2].ml,12.5);assert.equal(list[2].severity,'critical');
});

test('Auto never applies the current rule step to neighbouring doses or the volume grid',()=>{
  const fromSource=choices(),fromOther=choices({dose:800,roundingStep:null});
  assert.equal(fromSource.browser.key,fromOther.browser.key);
  assert.deepEqual(fromSource,fromOther);
  const volume=choices({}, {view:'volume'});
  assert.deepEqual(volume.map(c=>[c.ml,c.value]),[[10,800],[11,880],[12.5,1000]]);
  assert.ok(volume.every(c=>c.roundedDose===undefined));
  assert.equal(volume.find(c=>c.ml===11).severity,'info');
});

test('Auto and Off retain the manual baseline step in current amounts and volume grids',()=>{
  const baselineStep=.2;
  const result=calculate({form:'suspension',unitLabel:'ml',doseMode:'fixed',dose:900,
    frequency:2,days:7,weight:70,concentrationMg:400,concentrationMl:5,
    packageSize:35,roundingStep:baselineStep});
  assert.equal(result.singleUnits,11.2);assert.equal(result.singleMg,896);
  for(const roundingMode of ['auto','off']) {
    const list=choices({dose:900,roundingMode,baselineStep,roundingStep:1},
      {view:'volume',roundDoseChoices:roundingMode!=='off'});
    assert.equal(list.browser.window.grid,baselineStep);
    const markup=liquidDoseChoicesMarkup(list,{dose:900,unit:'mg'});
    assert.match(text(markup),/Wpisana dawka: 900 mg Po zaokrągleniu: 11,2 ml · 896 mg na podanie/);
    for(const candidate of list.filter(c=>c.allowed)) {
      const actual=calculate({form:'suspension',unitLabel:'ml',doseMode:'fixed',dose:candidate.value,
        frequency:2,days:7,weight:70,concentrationMg:400,concentrationMl:5,
        packageSize:35,roundingStep:baselineStep});
      close(candidate.ml,actual.singleUnits);close(candidate.mg,actual.singleMg);
    }
  }
  const doses=choices({baselineStep,roundingStep:1});
  assert.equal(nominal(doses).roundedDose.ml,11);
  assert.equal(doses.find(c=>c.value===1000).roundedDose.ml,12.6);
});

test('a rule tile keeps its nominal action and exposes actual amounts with neutral information',()=>{
  const markup=liquidDoseChoicesMarkup(choices(),{dose:875,unit:'mg',basis:'amoksycyliny'});
  const selected=tile(markup,10.9375);
  assert.match(selected,/liquid-dose-info/);assert.match(selected,/aria-pressed="true"/);
  assert.match(text(selected),/875 mg/);assert.match(text(selected),/11 ml na podanie/);
  assert.match(text(selected),/880 mg/);assert.match(text(selected),/Zmiana \+0,57%/);
  assert.match(text(selected),/ℹ Zaokrąglono według reguły/);
  assert.doesNotMatch(selected,/liquid-dose-warning|liquid-dose-critical|Dawka ze źródła|⚠/);
  assert.doesNotMatch(markup,/Zmiana przez krok zaokrąglenia/);
  for(const mode of ['auto','custom','off']) {
    const volume=choices({roundingMode:mode,roundingStep:mode==='custom'?1:null},{view:'volume'});
    assert.doesNotMatch(liquidDoseChoicesMarkup(volume,{dose:880,unit:'mg'}),/liquid-rounded-note|odrębna indywidualna ocena/);
  }
});

test('custom whole ml and an explicit 880 mg volume show the same rule state',()=>{
  const custom=nominal(choices({roundingMode:'custom'}));
  const explicit=choices({dose:880,roundingMode:'off',roundingStep:null},{view:'volume',roundDoseChoices:false})
    .find(c=>c.value===880);
  for(const c of [custom,explicit]) {
    assert.equal(c.roundingAssessment.state,'rule');assert.equal(c.severity,'info');
    assert.deepEqual(codes(c),['rounding-rule']);
    assert.equal((c.roundedDose||c).ml,11);assert.equal((c.roundedDose||c).mg,880);
  }
  const off=nominal(choices({roundingMode:'off'},{roundDoseChoices:false}));
  assert.equal(off.roundedDose,undefined);assert.equal(off.roundingAssessment,null);
  assert.equal(off.severity,null);assert.equal(off.ml,10.9375);
});

test('other custom roundings retain source departures without a general tolerance',()=>{
  const down=nominal(choices({roundingMode:'custom',roundingStep:.1}));
  assert.equal(down.roundedDose.ml,10.9);assert.equal(down.severity,'warning');
  assert.ok(codes(down).includes('below-source'));assert.ok(codes(down).includes('decimal-rounding'));
  const up=nominal(choices({roundingMode:'custom',roundingStep:.01}));
  assert.equal(up.roundedDose.ml,10.94);assert.equal(up.severity,'critical');
  assert.ok(codes(up).includes('above-source'));assert.ok(codes(up).includes('daily-limit'));
  assert.equal(up.roundingAssessment,null);
});

test('Auto leaves an unrelated pediatric regimen exact',()=>{
  const child=HUMAN_REGIMENS.find(s=>s.id==='dental-augmentin-400-57-child');
  const childContext={...context,patientType:'child',age:8,weight:20,doseMode:'perKgDay',dose:35};
  const list=choices({}, {source:child,doseMode:'perKgDay',weight:20,
    roundingContext:{form,source:child,context:childContext}});
  assert.deepEqual(list.map(c=>c.value),[25,35,45]);
  assert.ok(list.every(c=>c.roundedDose===undefined&&c.roundingAssessment===null));
  assert.equal(list[1].ml,4.375);
});

test('independent primary, companion and device restrictions remain critical',()=>{
  for(const limits of [{single:879},{daily:1755},{ingredients:[{index:1,single:125}]}]) {
    const c=nominal(choices({}, {roundingContext:{form,source,context,limits}}));
    assert.equal(c.roundedDose.ml,11);assert.equal(c.roundingAssessment.state,'blocked');
    assert.equal(c.severity,'critical');assert.ok(codes(c).includes('rounding-blocked'));
  }
  const device=nominal(choices({}, {roundingContext:{form,source,
    context:{...context,doseStepUnits:2}}}));
  assert.equal(device.severity,'critical');assert.ok(device.warnings.some(w=>w.message.includes('podziałkom')));
  const cappedForm={...form,maxSingleMg:879};
  const catalogue=nominal(choices({}, {},cappedForm));
  assert.equal(catalogue.severity,'critical');assert.equal(catalogue.roundingAssessment.state,'blocked');
});

test('rule information never erases an independent warning supplied by the tile caller',()=>{
  const c=nominal(choices({}, {maxDailyMg:1700}));
  assert.equal(c.roundingAssessment.state,'rule');assert.equal(c.severity,'critical');
  assert.ok(codes(c).includes('daily-limit'));assert.ok(codes(c).includes('rounding-rule'));
  assert.equal(c.reason,'Ponad limit dobowy');
});

test('eligibility failures still disable candidates',()=>{
  const list=choices({}, {eligibility:{valid:false,errors:['Sprawdź masę']}});
  assert.ok(list.every(c=>!c.allowed&&c.roundingAssessment===null&&c.roundedDose===undefined));
});

const ingredients=[{index:0,name:'Amoksycylina',unit:'mg',amount:400,perMl:5},
  {index:1,name:'Kwas klawulanowy',unit:'mg',amount:57,perMl:5}];
const rows=[{...ingredients[0],daily:1760,perKg:1760/70},
  {...ingredients[1],daily:250.8,perKg:250.8/70}];
const assessment=assessDoseRounding({form,source,context});

test('rule bars show the unchanged source comparison at 100.57 percent in both ingredients',()=>{
  const schemes=regimenComparisonRows({source,input:context,ingredients,weight:70});
  close(schemes[0].maximum,1750);close(schemes[1].maximum,249.375);
  for(let i=0;i<rows.length;i++) {
    close(regimenPercentModel(rows[i],schemes[i]).current,1760/1750*100);
    assert.match(regimenDosePercentMarkup(rows[i],schemes[i],true,assessment),/rule[^>]*><b>100,57%/);
    const html=regimenMeterMarkup(rows[i],schemes[i],true,assessment);
    assert.match(html,/dose-scheme-meter[^>]*rule/);assert.match(html,/\+0,57% względem dawki źródłowej/);
    assert.doesNotMatch(html,/limit-exceeded|Zaokrąglenie wymaga indywidualnej oceny/);
  }
});

test('a real bar ceiling and a blocked companion assessment take precedence over information',()=>{
  const schemes=regimenComparisonRows({source,input:context,ingredients,weight:70,
    limit:{daily:1700,kind:'manual'}});
  const html=regimenMeterMarkup(rows[0],schemes[0],true,assessment);
  assert.match(html,/dose-scheme-meter[^>]*limit-exceeded/);
  assert.doesNotMatch(html,/dose-scheme-meter[^>]*\brule\b/);
  assert.match(html,/Przekroczony dodatkowy limit/);
  const blocked=assessDoseRounding({form,source,context,limits:{ingredients:[{index:1,single:125}]}});
  const noExtra=regimenComparisonRows({source,input:context,ingredients,weight:70});
  assert.match(regimenMeterMarkup(rows[1],noExtra[1],true,blocked),/dose-scheme-meter[^>]*blocked/);
  assert.match(regimenDosePercentMarkup(rows[1],noExtra[1],true,blocked),/dose-scheme-current blocked/);
});

test('candidate evaluation and rendering never mutate the shared patient or source',()=>{
  const options=settings({dose:800,roundingStep:null}),before=structuredClone(options);
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  freeze(options);
  const list=liquidDoseChoices(freeze(structuredClone(form)),options);
  liquidDoseChoicesMarkup(list,{dose:800,unit:'mg'});
  assert.deepEqual(options,before);assert.equal(source.dose,875);assert.equal(source.maxDailyMg,1750);
});
