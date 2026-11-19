import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { REGIMENS } from './regimens.js';
import { resolveRegimen } from './regimen-engine.js';
import { ingredientDailyDose, supportsDailyDose } from './daily-dose.js';
import { dailyDoseMarkup, renderDailyDoseNote } from './dose-safety-view.js';
import { regimenMeterModel, regimenPercentModel } from './dose-regimen.js';

const allForms=DRUGS.flatMap(drug=>drug.forms.map(form=>({drug,form})));
const approx=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);
const percent=(note,index=0)=>regimenPercentModel(note.rows[index],note.schemeRows[index]);

function veterinary(formId,regimenId,{weight=500,age=10,ageUnit='years',species=null,
  foodChainStatus='excluded',sourcePatch={},inputPatch={},contextPatch={},limit=null}={}) {
  const {form,drug}=allForms.find(item=>item.form.id===formId);
  const source={...REGIMENS.find(item=>item.id===regimenId),...sourcePatch};
  assert.ok(source.id,`Missing fixture ${regimenId}`);
  const context={formId,species:species||source.species[0],weight,age,ageUnit,foodChainStatus,...contextPatch};
  const resolved=resolveRegimen(source,{...context,days:null});
  const years=age===null?null:age*({years:1,months:1/12,weeks:7/365,days:1/365}[ageUnit]||1);
  const input={
    ...form,patientKind:'animal',species:species||source.species[0],foodChainStatus,
    weight,age:years,doseMode:source.doseMode,dose:resolved.dose??1,
    frequency:source.frequency,days:null,packageSize:form.packOptions[0].quantity,
    ...inputPatch,
  };
  const note=ingredientDailyDose({form,drug,input,source,sourceCheck:resolved,sourceContext:context,limit});
  return {note,form,drug,input,source,context};
}
const render=fixture=>dailyDoseMarkup({...fixture,sourceContext:undefined,veterinary:true,eligibility:{valid:true}});

test('all 22 active veterinary formulations have dose comparisons through their exact source schemes',()=>{
  const covered=new Set();
  for(const source of REGIMENS)for(const formId of source.formIds) {
    const species=source.species[0];
    let weight=species==='horse'?500:species==='cat'?4:10;
    if(source.weightBands&&!source.weightBands.some(b=>(b.minInclusive?weight>=b.min:weight>b.min)&&(b.maxInclusive?weight<=b.max:weight<b.max))) {
      const band=source.weightBands[0];weight=(band.min+band.max)/2;
    }
    const fixture=veterinary(formId,source.id,{weight});
    assert.equal(supportsDailyDose(fixture.form),true,formId);
    assert.equal(fixture.note.comparisonEligibility.valid,true,`${source.id}: ${fixture.note.comparisonEligibility.errors}`);
    assert.ok(fixture.note.schemeRows?.length,source.id);
    for(let i=0;i<fixture.note.rows.length;i++) {
      assert.equal(percent(fixture.note,i).current,100,`${source.id}: ${fixture.note.rows[i].name}`);
      assert.equal(fixture.note.schemeRows[i].kind,'fixed');
      assert.equal(fixture.note.rows[i].ceiling,null);
      assert.equal(fixture.note.schemeRows[i].limit,null);
    }
    assert.match(render(fixture),/dose-scheme-fill/);
    assert.doesNotMatch(render(fixture),/Brak zweryfikowanego limitu/);
    covered.add(formId);
  }
  assert.equal(covered.size,22);
  assert.deepEqual([...covered].sort(),allForms.filter(({form})=>form.targetSpecies&&!form.calculationBlocked&&!form.referenceOnly).map(({form})=>form.id).sort());
});

test('gram-based pastes, gels and powders and ml injections retain independent expected amounts',()=>{
  for(const [formId,regimenId,dailyUnits,dailyMg] of [
    ['panacur-horse-paste-187-5','panacur-paste-nematodes',20,3750],
    ['equimoxin-horse-gel-18-92','equimoxin-horse-susceptible-parasites',200/18.92,200],
    ['ventipulmin-horse-granules','ventipulmin-acute',50,.8],
    ['butagran-equi-horse-200','butagran-horse-day-one',22,4400],
    ['flunivis-horse-50-iv','flunivis-horse-msk-pyrexia',11,550],
  ]) {
    const {note,form}=veterinary(formId,regimenId);
    approx(note.dailyUnits,dailyUnits);approx(note.rows[0].daily,dailyMg);
    approx(note.rows[0].perKg,dailyMg/500);
    assert.equal(note.rows[0].unit,'mg');
    assert.equal(note.unitLabel,form.form==='injection'?'ml':'g');
    assert.equal(note.ceilingKind,null);
    assert.equal(percent(note).current,100);
  }
});

test('a combination paste follows its literal gram table and keeps both ingredient proportions',()=>{
  const fixture=veterinary('iverpraz-horse-paste-18-7-140-3','iverpraz-horse-mixed-infestation-table');
  assert.equal(fixture.note.dailyUnits,5.35);
  approx(fixture.note.rows[0].daily,100.045);
  approx(fixture.note.rows[1].daily,750.605);
  assert.equal(percent(fixture.note,0).current,100);
  assert.equal(percent(fixture.note,1).current,100);
  assert.equal(fixture.note.schemeRows[1].derived,true);
  assert.equal(fixture.note.rows[1].ceiling,null);
  assert.match(render(fixture),/nie jest to niezależne maksimum/);
});

test('source dose and original frequency stay fixed after manually entered dose or frequency changes',()=>{
  const baseline=veterinary('metacam-dog-1-5','metacam-dog-maintenance',{weight:10});
  assert.equal(baseline.note.schemeRows[0].maximum,.1);
  assert.equal(baseline.note.schemeRows[0].dailyMax,1);
  for(const [dose,frequency,expectedPercent] of [[.2,1,200],[.1,2,200],[.2,2,400]]) {
    const fixture=veterinary('metacam-dog-1-5','metacam-dog-maintenance',{weight:10,inputPatch:{dose,frequency}});
    assert.deepEqual(fixture.note.schemeRows,baseline.note.schemeRows);
    approx(percent(fixture.note).current,expectedPercent);
    assert.equal(regimenMeterModel(fixture.note.rows[0],fixture.note.schemeRows[0]).state,'above');
    assert.equal(fixture.note.ceilingKind,null);
  }
  const lower=veterinary('metacam-dog-1-5','metacam-dog-maintenance',{weight:10,limit:{daily:.8,kind:'manual'}});
  assert.equal(lower.note.schemeRows[0].maximum,.1);
  assert.equal(percent(lower.note).current,100);
  approx(percent(lower.note).limit,80);
  assert.equal(regimenMeterModel(lower.note.rows[0],lower.note.schemeRows[0]).limitExceeded,true);
});

test('exact inclusive/exclusive weight-band edges choose one dose without a continuous range',()=>{
  for(const [weight,tablets] of [[2.5,1],[5.999,1],[6,2],[12,2]]) {
    const fixture=veterinary('onsior-cat-6','onsior-cat-acute',{weight});
    assert.equal(fixture.note.schemeRows[0].minimum,tablets*6);
    assert.equal(fixture.note.schemeRows[0].maximum,tablets*6);
    assert.equal(fixture.note.schemeRows[0].kind,'fixed');
    assert.equal(percent(fixture.note).current,100);
  }
  for(const [formId,regimenId,weight] of [
    ['onsior-cat-6','onsior-cat-acute',2.49],
    ['onsior-cat-6','onsior-cat-acute',12.001],
    ['cerenia-dog-16','cerenia-vomiting-16',4.05],
    ['iverpraz-horse-paste-18-7-140-3','iverpraz-horse-mixed-infestation-table',100.5],
  ]) {
    const fixture=veterinary(formId,regimenId,{weight});
    assert.equal(fixture.note.schemeRows,null);
    assert.equal(fixture.note.comparisonEligibility.valid,false);
    assert.doesNotMatch(render(fixture),/dose-scheme-fill|dose-scheme-marker|dose-scheme-current/);
    assert.match(render(fixture),/Nie zaokrąglaj masy/);
  }
  const left=veterinary('cerenia-dog-16','cerenia-vomiting-16',{weight:4});
  const right=veterinary('cerenia-dog-16','cerenia-vomiting-16',{weight:4.1});
  assert.equal(left.note.schemeRows[0].maximum,8);
  assert.equal(right.note.schemeRows[0].maximum,16);
});

test('an overlapping source table is rejected even when the selected weight lies outside the overlap',()=>{
  const fixture=veterinary('onsior-cat-6','onsior-cat-acute',{weight:3,sourcePatch:{weightBands:[
    {min:2.5,max:6,minInclusive:true,maxInclusive:true,units:1},
    {min:6,max:12,minInclusive:true,maxInclusive:true,units:2},
  ]}});
  assert.equal(fixture.note.schemeRows,null);
  assert.equal(fixture.note.comparisonEligibility.valid,false);
  assert.match(render(fixture),/nakładające się przedziały/);
});

test('species, exact age units and food-chain restrictions still gate veterinary comparisons',()=>{
  const sixWeeks=veterinary('metacam-dog-1-5','metacam-dog-maintenance',{weight:10,age:6,ageUnit:'weeks'});
  assert.equal(sixWeeks.note.comparisonEligibility.valid,true);
  for(const fixture of [
    veterinary('metacam-dog-1-5','metacam-dog-maintenance',{weight:10,age:5,ageUnit:'weeks'}),
    veterinary('metacam-dog-1-5','metacam-dog-maintenance',{weight:10,species:'cat'}),
    veterinary('butagran-equi-horse-200','butagran-horse-day-one',{foodChainStatus:'unknown'}),
    veterinary('equioxx-horse-57','equioxx-horse-osteoarthritis',{weight:601}),
  ]) {
    assert.equal(fixture.note.comparisonEligibility.valid,false);
    // A stale caller's valid:true cannot override the local source resolution.
    assert.doesNotMatch(render(fixture),/dose-scheme-fill|dose-scheme-marker|dose-scheme-current/);
  }
});

test('the live input identity and weight override stale sourceContext and duration does not affect daily references',()=>{
  const fixture=veterinary('onsior-cat-6','onsior-cat-acute',{weight:6,contextPatch:{weight:3,formId:'another',species:'dog',days:500}});
  assert.equal(fixture.note.comparisonEligibility.valid,true);
  assert.equal(fixture.note.schemeRows[0].maximum,12);
  const baseline=veterinary('panacur-horse-paste-187-5','panacur-paste-nematodes');
  for(const days of [null,'',1,100]) {
    const actual=veterinary('panacur-horse-paste-187-5','panacur-paste-nematodes',{inputPatch:{days},contextPatch:{days}});
    assert.deepEqual(actual.note.schemeRows,baseline.note.schemeRows);
    assert.equal(actual.note.dailyUnits,baseline.note.dailyUnits);
  }
});

function humanPhysical(form,input,source,extra={}) {
  return ingredientDailyDose({form,source,input:{...form,patientKind:'human',doseMode:'units',days:null,packageSize:100,...input},...extra});
}

test('oral rinses compare physical ml without manufacturing an active mg concentration',()=>{
  const form={form:'solution',unitLabel:'ml',concentrationMg:null,concentrationMl:null};
  const source={doseMode:'units',dose:15,frequency:2,label:'Instrukcja płukania'};
  const note=humanPhysical(form,{dose:15,frequency:2,weight:70},source);
  assert.equal(note.physicalAmount,true);
  assert.deepEqual(note.rows,[{name:'Ilość preparatu',unit:'ml',daily:30,perKg:null,ceiling:null,ceilingPerKg:null,derivedCeiling:false}]);
  assert.equal(note.schemeRows[0].maximum,30);
  assert.equal(percent(note).current,100);
  const html=dailyDoseMarkup({note,source,eligibility:{valid:true}});
  assert.match(html,/30 ml\/dobę/);
  assert.doesNotMatch(html,/mg\/dobę|ml\/kg/);
});

test('spray and numeric gel amounts use per-unit strengths; qualitative gels stay excluded',()=>{
  for(const [form,dose,frequency,expected] of [
    [{form:'spray',unitLabel:'rozp.',strengthMg:.255},4,2,2.04],
    [{form:'gel',unitLabel:'g',strengthMg:5},2,3,30],
  ]) {
    const source={doseMode:'units',dose,frequency};
    const note=humanPhysical(form,{dose,frequency},source);
    approx(note.rows[0].daily,expected);
    assert.equal(percent(note).current,100);
  }
  for(const form of allForms.map(item=>item.form).filter(form=>form.calculationMode==='instruction'||form.referenceOnly||form.calculationBlocked)) {
    assert.equal(supportsDailyDose(form),false,form.id);
    assert.equal(ingredientDailyDose({form,input:{doseMode:'units',dose:1,frequency:1,packageSize:10}}),null);
  }
});

test('drops use product-specific calibration and cannot silently become ml',()=>{
  const form={form:'drops',unitLabel:'kropli',concentrationMg:10,concentrationMl:1,dropsPerMl:20};
  const source={doseMode:'units',dose:10,frequency:2};
  const note=humanPhysical(form,{dose:10,frequency:2},source);
  assert.equal(note.dailyUnits,20);
  assert.equal(note.rows[0].daily,10);
  assert.equal(note.schemeRows[0].maximum,10);
  assert.equal(percent(note).current,100);
  const uncalibrated=humanPhysical({...form,dropsPerMl:null},{dose:10,frequency:2},source);
  assert.equal(uncalibrated.rows[0].unit,'kropli');
  assert.equal(uncalibrated.rows[0].daily,20);
  assert.equal(uncalibrated.schemeRows[0].maximum,20);
  assert.equal(uncalibrated.rows[0].ceiling,null);
});

test('Nystatin reads declared activity by default and preserves an explicit override in IU',()=>{
  const form={form:'suspension',unitLabel:'ml',concentrationMg:null,concentrationMl:null,
    activityIngredients:[{name:'Nystatyna',amount:100000,perMl:1,unit:'j.m.'}]};
  const source={doseMode:'units',doseRange:{min:1,max:2},frequency:4};
  const input={dose:1.5,frequency:4};
  const note=humanPhysical(form,input,source);
  assert.equal(note.rows[0].daily,600000);
  assert.equal(note.rows[0].unit,'j.m.');
  assert.equal(note.schemeRows[0].minimum,400000);
  assert.equal(note.schemeRows[0].maximum,800000);
  assert.equal(percent(note).current,75);
  assert.deepEqual(humanPhysical(form,input,source,{ingredientOverride:form.activityIngredients}),note);
  const html=dailyDoseMarkup({note,source,eligibility:{valid:true}});
  assert.match(html,/600000.*j\.m\.\/dobę/);
  assert.doesNotMatch(html,/mg\/dobę|Brak zweryfikowanego limitu/);
});

test('missing source or input gets neutral guidance and never a fabricated zero or alarm',()=>{
  const form={form:'solution',unitLabel:'ml',concentrationMg:50,concentrationMl:1};
  const noSource=humanPhysical(form,{dose:2,frequency:3},null);
  const choose=dailyDoseMarkup({note:noSource,canChooseSource:true});
  assert.match(choose,/Wybierz schemat, aby zobaczyć/);
  assert.match(choose,/data-action="daily-dose-source"/);
  assert.doesNotMatch(choose,/dose-safety-notice|Brak zweryfikowanego limitu|dose-safety-fill/);
  const fixture=veterinary('metacam-dog-1-5','metacam-dog-maintenance',{weight:null,age:null,inputPatch:{dose:null,frequency:null}});
  assert.equal(fixture.note.dailyUnits,null);
  assert.equal(fixture.note.rows[0].daily,null);
  const incomplete=render(fixture);
  assert.match(incomplete,/Uzupełnij dane do porównania/);
  assert.doesNotMatch(incomplete,/dose-safety-notice|dose-scheme-fill|<b>0%/);
});

test('actual device errors remain visible without moving the source reference',()=>{
  const fixture=veterinary('paramectin-horse-paste-18-7','paramectin-horse-susceptible-parasites',{weight:550});
  assert.equal(fixture.note.comparisonEligibility.valid,true);
  assert.equal(percent(fixture.note).current,100);
  assert.ok(fixture.note.calculationErrors.some(error=>/podziałkom przyrządu/.test(error)));
  assert.match(render(fixture),/Sprawdź zgodność i odmierzenie dawki/);
  assert.match(render(fixture),/Nie zaokrąglono do podziałki/);
});

test('comparison calculations never mutate source tables, patient context or limits',()=>{
  const fixture=veterinary('iverpraz-horse-paste-18-7-140-3','iverpraz-horse-mixed-infestation-table');
  const args={form:fixture.form,drug:fixture.drug,input:fixture.input,source:fixture.source,sourceContext:fixture.context,limit:{daily:90,kind:'manual'}};
  const before=structuredClone(args);
  const frozen=structuredClone(args);
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  assert.doesNotThrow(()=>ingredientDailyDose(freeze(frozen)));
  ingredientDailyDose(args);
  assert.deepEqual(args,before);
});

function animationFixture() {
  const calls=[],listeners=new Set();
  const media={matches:false,addEventListener:(_,handler)=>listeners.add(handler),removeEventListener:(_,handler)=>listeners.delete(handler)};
  let row,markup='';
  const node={ownerDocument:{defaultView:{matchMedia:()=>media}},querySelectorAll:()=>row?[row]:[],
    set innerHTML(value) {
      markup=value;
      const target=Number(/width:([\d.]+)%/.exec(value)?.[1]);
      const fill={className:'dose-scheme-fill',style:{width:`${target}%`},visible:target,
        parentElement:{getBoundingClientRect:()=>({width:200,height:20})},
        getBoundingClientRect(){return {width:this.visible*2,height:10};},
        animate(frames,options){const animation={frames,options,cancelled:false,cancel(){this.cancelled=true;},finished:new Promise(()=>{})};calls.push(animation);return animation;},
      };
      row={fill,querySelector:()=>({textContent:'Substancja'}),querySelectorAll:()=>[fill]};
    },get innerHTML(){return markup;},
  };
  return {node,media,calls,listeners,get fill(){return row.fill;}};
}

test('bar updates animate from the visible interrupted width for 240 ms and honor reduced motion',()=>{
  const fixture=animationFixture();
  const markup=value=>`<div class="dose-safety-row"><dt>Substancja</dt><span class="dose-scheme-fill" style="width:${value}%"></span></div>`;
  renderDailyDoseNote(fixture.node,markup(60),'same source');
  assert.equal(fixture.calls.length,0);
  renderDailyDoseNote(fixture.node,markup(80),'same source');
  assert.deepEqual(fixture.calls[0].frames,[{width:'60%'},{width:'80%'}]);
  assert.equal(fixture.calls[0].options.duration,240);
  fixture.fill.visible=70;
  renderDailyDoseNote(fixture.node,markup(40),'same source');
  assert.equal(fixture.calls[0].cancelled,true);
  assert.deepEqual(fixture.calls[1].frames,[{width:'70%'},{width:'40%'}]);
  fixture.media.matches=true;
  for(const listener of [...fixture.listeners])listener({matches:true});
  assert.equal(fixture.calls[1].cancelled,true);
  renderDailyDoseNote(fixture.node,markup(90),'same source');
  assert.equal(fixture.calls.length,2);
  assert.match(fixture.node.innerHTML,/width:90%/);
  fixture.media.matches=false;
  renderDailyDoseNote(fixture.node,markup(50),'different source');
  assert.equal(fixture.calls.length,2);
});
