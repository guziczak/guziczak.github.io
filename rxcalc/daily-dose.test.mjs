import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from './engine.js';
import {suspensionDailyDose} from './daily-dose.js';

const form={
  form:'suspension',concentrationMg:400,concentrationMl:5,
  ingredients:[
    {name:'amoksycylina',amountMg:400,perMl:5},
    {name:'kwas klawulanowy',amountMg:57,perMl:5},
  ],
  sourceLabel:'Źródło preparatu',sourceUrl:'https://example.test/product',
};
const drug={name:'Amoksycylina + klawulanian'};
const input={
  form:'suspension',doseMode:'fixed',dose:50,frequency:2,days:'',weight:null,
  concentrationMg:400,concentrationMl:5,packageSize:70,unitLabel:'ml',
};
const source={
  label:'Wybrany schemat · 25–45 mg/kg/dobę w 2 dawkach',
  sourceLabel:'Źródło schematu',sourceUrl:'https://example.test/regimen',
};
const report=(changes={})=>suspensionDailyDose({form,drug,input,...changes});

test('a daily preview computes 50 mg twice daily without requiring duration',()=>{
  for(const days of ['',null,undefined,7]) {
    const value=report({input:{...input,days}});
    assert.equal(value.dailyUnits,1.25);
    assert.deepEqual(value.rows,[
      {name:'amoksycylina',unit:'mg',daily:100,perKg:null,ceiling:null,ceilingPerKg:null,derivedCeiling:false},
      {name:'kwas klawulanowy',unit:'mg',daily:14.25,perKg:null,ceiling:null,ceilingPerKg:null,derivedCeiling:false},
    ]);
    assert.equal(value.ceilingKind,null);
    assert.equal(value.exceeded,false);
  }
  assert.equal(calculate(input).dailyUnits,null);
});

test('equivalent ml, per-kg-day and per-kg-dose inputs retain engine semantics',()=>{
  assert.deepEqual(report({input:{...input,doseMode:'units',dose:0.625}}).rows,report().rows);
  for(const [doseMode,dose] of [['perKgDay',45],['perKgDose',22.5],['units',5.625]]) {
    const current={...input,doseMode,dose,weight:20};
    const value=report({input:current});
    assert.equal(value.dailyUnits,calculate({...current,days:1}).dailyUnits);
    assert.equal(value.rows[0].daily,900);
    assert.equal(value.rows[0].perKg,45);
    assert.equal(value.rows[1].daily,128.25);
    assert.equal(value.rows[1].perKg,6.4125);
  }
  const twice=report({input:{...input,doseMode:'perKgDose',dose:45,weight:20}});
  assert.equal(twice.rows[0].daily,1800);
});

test('rounding and an exceeded limit preserve already-computed daily quantities',()=>{
  const current={...input,roundingStep:1,maxDailyMg:100,weight:20};
  const engine=calculate({...current,days:1});
  assert.equal(engine.valid,false);
  assert.equal(engine.dailyMg,160);
  const value=report({input:current,limit:{daily:100,kind:'manual'}});
  assert.equal(value.dailyUnits,engine.dailyUnits);
  assert.equal(value.rows[0].daily,engine.dailyMg);
  assert.equal(value.rows[1].daily,22.8);
  assert.equal(value.rows[0].ceiling,100);
  assert.equal(value.rows[1].ceiling,14.25);
  assert.equal(value.ceilingKind,'manual');
  assert.equal(value.exceeded,true);
});

test('missing dose or frequency never produces a zero daily quantity',()=>{
  for(const field of ['dose','frequency'])for(const missing of ['',null,undefined,0,NaN]) {
    const value=report({input:{...input,[field]:missing,weight:20},source,
      sourceCheck:{valid:false,maxDailyMg:900,maxDailyMgPerKg:45}});
    assert.equal(value.dailyUnits,null);
    assert.ok(value.rows.every(row=>row.daily===null&&row.perKg===null));
    assert.equal(value.rows[0].ceiling,900);
    assert.equal(value.exceeded,false);
  }
});

test('a source boundary remains visible with missing patient data and is scoped to its full label',()=>{
  const value=report({source,sourceCheck:{valid:false,maxDailyMg:null,maxDailyMgPerKg:45}});
  assert.equal(value.rows[0].ceiling,null);
  assert.equal(value.rows[0].ceilingPerKg,45);
  assert.equal(value.rows[1].ceilingPerKg,6.4125);
  assert.equal(value.rows[1].derivedCeiling,true);
  assert.ok(value.rows.every(row=>row.perKg===null));
  assert.equal(value.ceilingKind,'source');
  assert.equal(value.sourceScope,source.label);
  assert.equal(value.sourceLabel,source.sourceLabel);
  assert.equal(value.sourceUrl,source.sourceUrl);
});

test('400:57 source ratios use 6.4125 and never invent an independent 6.4 mg/kg ceiling',()=>{
  const current={...input,doseMode:'perKgDay',dose:45,weight:20,maxDailyMg:900};
  const settings={source,sourceCheck:{valid:false,maxDailyMg:900,maxDailyMgPerKg:45}};
  const boundary=report({...settings,input:current});
  assert.equal(boundary.rows[1].ceiling,128.25);
  assert.equal(boundary.rows[1].ceilingPerKg,6.4125);
  assert.equal(boundary.rows[1].perKg,6.4125);
  assert.equal(boundary.rows[1].derivedCeiling,true);
  assert.equal(boundary.exceeded,false);
  const excessive=report({...settings,input:{...current,dose:46}});
  assert.equal(excessive.rows[0].daily,920);
  assert.equal(excessive.rows[1].daily,131.1);
  assert.equal(excessive.exceeded,true);
});

test('a tighter manual ceiling narrows source totals and displayed per-kg boundaries',()=>{
  const settings={source,sourceCheck:{maxDailyMg:900,maxDailyMgPerKg:45},limit:{daily:800,kind:'manual'}};
  const value=report({...settings,input:{...input,doseMode:'perKgDay',dose:45,weight:20}});
  assert.equal(value.ceilingKind,'manual');
  assert.equal(value.rows[0].ceiling,800);
  assert.equal(value.rows[0].ceilingPerKg,40);
  assert.equal(value.rows[1].ceiling,114);
  assert.equal(value.rows[1].ceilingPerKg,5.7);
  assert.equal(value.exceeded,true);
  const noWeight=report({...settings,sourceCheck:{maxDailyMg:null,maxDailyMgPerKg:45}});
  assert.equal(noWeight.rows[0].ceiling,800);
  assert.ok(noWeight.rows.every(row=>row.ceilingPerKg===null));
  const higher=report({...settings,limit:{daily:1000,kind:'manual'},input:{...input,weight:20}});
  assert.equal(higher.ceilingKind,'source');
  assert.equal(higher.rows[0].ceiling,900);
});

test('missing limits stay null and explicit manual/catalogue metadata determine provenance',()=>{
  for(const daily of [undefined,null,0,NaN,Infinity,-1]) {
    const value=report({limit:{daily},form:{...form,maxDailyMg:123}});
    assert.equal(value.ceilingKind,null);
    assert.ok(value.rows.every(row=>row.ceiling===null&&row.ceilingPerKg===null));
  }
  assert.equal(report({limit:{daily:100}}).ceilingKind,'catalogue');
  assert.equal(report({limit:{daily:100},input:{...input,manualMax:100}}).ceilingKind,'manual');
  assert.equal(report({limit:{daily:100,kind:'catalogue'},input:{...input,manualMax:200}}).ceilingKind,'catalogue');
  assert.equal(report({source,sourceCheck:{valid:false}}).ceilingKind,null);
});

test('single-ingredient suspensions use their supplied name and concentration',()=>{
  const single={form:'suspension',concentrationMg:250,concentrationMl:5};
  const value=report({form:single,drug:{name:'Nazwa leku',substanceLabel:'Nazwa substancji'},
    input:{...input,concentrationMg:250,concentrationMl:5,weight:20}});
  assert.equal(value.rows.length,1);
  assert.equal(value.rows[0].name,'Nazwa substancji');
  assert.equal(value.rows[0].daily,100);
  assert.equal(value.rows[0].perKg,5);
  assert.equal(report({form:single,drug:{name:'Nazwa leku'}}).rows[0].name,'Nazwa leku');
});

test('Nystatin activity is displayed in supplied IU rather than relabelled as mg',()=>{
  const nystatin={form:'suspension',concentrationMg:null,concentrationMl:null};
  const current={...input,doseMode:'units',dose:2,frequency:4,weight:20,concentrationMg:null,concentrationMl:null,packageSize:28};
  const settings={form:nystatin,drug:{name:'Nystatyna'},input:current,
    ingredientOverride:[{name:'Nystatyna',amount:100000,perMl:1,unit:'j.m.'}],
    source:{...source,maxDailyUnits:16},sourceCheck:{valid:false,maxDailyMg:4000}};
  const value=report(settings);
  assert.equal(value.dailyUnits,8);
  assert.deepEqual(value.rows,[{name:'Nystatyna',unit:'j.m.',daily:800000,perKg:40000,
    ceiling:1600000,ceilingPerKg:80000,derivedCeiling:false}]);
  assert.equal(value.ceilingKind,'source');
  assert.equal(value.exceeded,false);
  assert.equal(report({...settings,input:{...current,dose:5}}).exceeded,true);
});

test('unavailable weights do not become per-kg values and excluded forms have no preview',()=>{
  for(const weight of ['',null,undefined,0,-1,NaN,Infinity,501]) {
    assert.ok(report({input:{...input,weight}}).rows.every(row=>row.perKg===null));
  }
  for(const kind of ['tablet','solution','gel','drops'])assert.equal(report({form:{...form,form:kind}}),null);
  assert.equal(report({form:{...form,calculationBlocked:true}}),null);
  assert.equal(report({input:{...input,calculationBlocked:true}}),null);
});

test('the preview leaves patient inputs and catalogue/source metadata unchanged',()=>{
  const settings=structuredClone({form,drug,input,source,sourceCheck:{maxDailyMgPerKg:45},limit:{daily:800,kind:'manual'}});
  const before=structuredClone(settings);
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  assert.doesNotThrow(()=>suspensionDailyDose(freeze(settings)));
  assert.deepEqual(settings,before);
  assert.equal(settings.input.days,'');
});
