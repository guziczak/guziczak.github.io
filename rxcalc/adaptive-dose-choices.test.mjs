import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {liquidShortcutWindow,liquidShortcutKey} from './adaptive-dose-choices.js';
import {liquidDoseChoices,liquidDoseChoicesMarkup} from './liquid-doses.js';
import {DRUGS} from './catalogue.js';
import {HUMAN_REGIMENS} from './human-regimens.js';
import {LIQUID_STARTER_REGIMENS} from './liquid-starters.js';
import {calculate} from './engine.js';
import {resolveHumanRegimen} from './human-regimen-engine.js';
const form=DRUGS.find(d=>d.id==='amoxicillin-clavulanate').forms.find(f=>f.id==='augmentin-400-57');
const adult=LIQUID_STARTER_REGIMENS[0],child=HUMAN_REGIMENS.find(s=>s.id==='dental-augmentin-400-57-child');
const fixed={source:adult,doseMode:'fixed',weight:70,frequency:2,eligibility:{valid:true},page:0};
const range={...fixed,source:child,doseMode:'perKgDay',weight:35};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);
const list=(o={})=>liquidDoseChoices(form,{...fixed,...o});

test('all-small 875 mg case replaces two tiles with larger source-anchored values',()=>{
 const c=list();assert.deepEqual(c.map(x=>x.ml),[10,11,12.5]);
 assert.deepEqual(c.map(x=>x.value),[800,880,1000]);assert.deepEqual(c.map(x=>x.severity),['warning','critical','critical']);
 assert.ok(c.every(x=>x.allowed));
});
test('an explicit 0.1 ml grid brackets the source without inventing clinical tolerance',()=>{
 const c=list({roundingStep:.1});assert.deepEqual(c.map(x=>x.ml),[10,10.9,11]);
 assert.deepEqual(c.map(x=>x.value),[800,872,880]);assert.deepEqual(c.map(x=>x.severity),['warning','warning','critical']);
 assert.ok(c.browser.window.noGridValue);assert.ok(liquidDoseChoicesMarkup(c).includes('nie są automatycznie akceptowanym zaokrągleniem'));
});
test('a coarse grid does not silently convert an exact source dose into a green choice',()=>{
 const c=list({roundingStep:1});assert.ok(c.every(x=>Number.isInteger(x.ml)));assert.ok(c.every(x=>x.severity!==null));
});
test('selected per-kg range creates source-unit choices, including the exact upper endpoint',()=>{
 const c=list(range);assert.deepEqual(c.map(x=>x.value),[25,35,45]);assert.ok(c.every(x=>x.allowed&&!x.severity));
 assert.deepEqual(c.map(x=>x.ml),[5.46875,7.65625,9.84375]);
 const html=liquidDoseChoicesMarkup(c,{unit:'mg/kg/d'});assert.ok(html.includes('w jednostce schematu'));assert.ok(html.includes('ml na podanie'));
});
test('changing weight updates volumes but keeps original per-kg source endpoints',()=>{
 for(const weight of [10,20,35,39]){const c=list({...range,weight});assert.deepEqual(c.map(x=>x.value),[25,35,45]);near(c[2].ml,45*weight/160);}
});
test('grid-based range values stay within the range where possible',()=>{
 const c=list({...range,roundingStep:.1});assert.ok(c.every(x=>x.value>=25&&x.value<=45&&!x.severity));
 assert.deepEqual(c.map(x=>x.ml),[5.5,7.6,9.8]);
});
test('narrow ranges with no grid point keep warnings instead of manufacturing compliance',()=>{
 const source={doseMode:'fixed',doseRange:{min:875,max:877}};
 const c=list({source,roundingStep:.1});assert.ok(c.browser.window.noGridValue);assert.ok(c.every(x=>x.severity));
});
test('high ranges show two larger values inside source and retain useful lower neighbour',()=>{
 const c=list({source:{doseMode:'fixed',doseRange:{min:1200,max:1600}}});
 assert.deepEqual(c.map(x=>x.ml),[10,15,20]);assert.deepEqual(c.map(x=>x.severity),['warning',null,null]);
});
test('distant ranges replace an irrelevant old lower tile rather than anchoring to 10 ml forever',()=>{
 const c=list({source:{doseMode:'fixed',doseRange:{min:2400,max:3200}}});assert.deepEqual(c.map(x=>x.ml),[30,35,40]);
});
test('larger-volume browsing reaches 15 and 20 without changing source anchor',()=>{
 assert.deepEqual(list({page:1}).map(x=>x.ml),[12.5,15,17.5]);assert.deepEqual(list({page:2}).map(x=>x.ml),[17.5,20,22.5]);
 assert.deepEqual(list().map(x=>x.ml),[10,11,12.5]);assert.ok(list({page:2}).every(x=>x.severity==='critical'));
});
test('paging below zero clamps to positive finite values, never an empty dead-end',()=>{
 for(const page of [-1000,-10,-3,-2,-1,0,1,50]){const w=liquidShortcutWindow(form,{...fixed,page});assert.ok(w.volumes.length>0&&w.volumes.length<=3);assert.ok(w.volumes.every(v=>v>0&&Number.isFinite(v)));}
});
test('entered dose, duration and confirmation cannot move the window or change its identity',()=>{
 for(const dose of ['',800,875,1600,99999]){
 assert.deepEqual(liquidShortcutWindow(form,{...fixed,dose}).volumes,liquidShortcutWindow(form,fixed).volumes);
 assert.equal(liquidShortcutKey(form,{...fixed,dose,days:100,confirmed:true}),liquidShortcutKey(form,fixed));}
});
test('source, weight, frequency, concentration, mode and rounding reset navigation identity',()=>{
 const key=liquidShortcutKey(form,fixed);
 for(const diff of [{weight:39},{source:child},{frequency:3},{doseMode:'units'},{roundingStep:.1},{eligibility:{valid:false}}])assert.notEqual(liquidShortcutKey(form,{...fixed,...diff}),key);
 assert.notEqual(liquidShortcutKey({...form,concentrationMg:250},fixed),key);
});
test('unknown and ineligible contexts do not generate patient-specific targets',()=>{
 for(const change of [{weight:null},{weight:0},{frequency:null},{eligibility:{valid:false}}]){
 const c=list({...range,...change});assert.equal(c.browser.window.anchored,false);assert.ok(c.every(x=>!x.allowed));}
});
test('unselected source uses neutral arithmetic shortcuts, never guesses a target from a dose',()=>{
 const c=list({source:null,dose:875});assert.deepEqual(c.map(x=>x.ml),[2.5,5,10]);assert.equal(c.browser.window.anchored,false);
});
test('different product strengths use their own concentration',()=>{
 const f={...form,id:'other',concentrationMg:250};const source={doseMode:'fixed',dose:750};
 const c=liquidDoseChoices(f,{...fixed,source});assert.ok(c.some(x=>x.value===750&&x.ml===15));
});
test('unit-only suspensions never invent milligrams',()=>{
 const f={...form,concentrationMg:null,concentrationMl:null};const c=liquidDoseChoices(f,{doseMode:'units',source:{doseMode:'units',dose:4},page:0});
 assert.ok(c.some(x=>x.value===4));assert.ok(c.every(x=>x.mg===null));
});
test('per-kg-dose mode multiplies by real patient weight without an extra daily multiplier',()=>{
 const c=list({source:{doseMode:'perKgDose',doseRange:{min:10,max:20}},doseMode:'perKgDose',weight:20,frequency:3});
 assert.deepEqual(c.map(x=>x.value),[10,15,20]);near(c[2].mg,400);
});
test('all generated selections preserve engine arithmetic for current quantity',()=>{
 for(const options of [fixed,range,{...fixed,page:2},{...range,roundingStep:.1},{...range,page:-1}])for(const c of list(options)){
 const r=calculate({patientKind:'human',form:'suspension',doseMode:options.doseMode,dose:c.value,weight:options.weight,frequency:options.frequency,days:1,concentrationMg:400,concentrationMl:5,unitLabel:'ml',packageSize:35,roundingStep:options.roundingStep});
 near(r.singleUnits,c.ml);near(r.dailyMg,c.mg*options.frequency);}
});
test('additional lower limits stay red and never move the source-based candidates',()=>{
 const c=list({...range,maxDailyMg:500});assert.deepEqual(c.map(x=>x.value),[25,35,45]);assert.ok(c.every(x=>x.severity==='critical'&&x.warnings.some(w=>w.code==='daily-limit')));
});
test('larger selection remains rejected by the unchanged source validator',()=>{
 const c=list()[2];const r=resolveHumanRegimen(adult,{formId:form.id,specialty:'dental',patientType:'adult',weight:70,age:35,ageUnit:'years',dose:c.value,frequency:2,days:7,renalStatus:'unknown'},{allowNumericOverrides:true});
 assert.equal(r.valid,false);assert.equal(r.maxDailyMg,1750);
});
test('source range and patient data are not mutated by generating or rendering',()=>{
 const options=structuredClone(range);Object.freeze(options.source.doseRange);Object.freeze(options.source);Object.freeze(options);const before=JSON.stringify(options);
 assert.doesNotThrow(()=>liquidDoseChoicesMarkup(list(options)));assert.equal(JSON.stringify(options),before);
});
test('no adaptive suggestions for blocked or unsupported routes or veterinary forms',()=>{
 for(const changed of [{form:'injection'},{form:'solution'},{form:'tablet'},{calculationBlocked:true},{referenceOnly:true}])assert.deepEqual(liquidDoseChoices({...form,...changed},fixed),[]);
 assert.deepEqual(list({veterinary:true}),[]);
});
test('finite nonzero values survive edge-case grids and ranges without loops',()=>{
 for(const value of [.0001,.1,1,875,1e5])for(const grid of [null,.01,.1,1,10])for(const page of [-999,0,999]){
 const w=liquidShortcutWindow(form,{...fixed,source:{doseMode:'fixed',dose:value},roundingStep:grid,page});
 assert.ok(w.volumes.length>0);assert.ok(w.volumes.every(v=>v>0&&Number.isFinite(v)));}
});
test('display approximation does not replace the exact value that will be entered',()=>{
 const c=list(range);const html=liquidDoseChoicesMarkup(c,{unit:'mg/kg/d'});assert.ok(html.includes('≈'));assert.ok(html.includes('data-value="5.46875"'));assert.ok(html.includes('nie zmianę dawki'));
});
test('navigation avoids synthetic clinical events and persists no patient data',async()=>{
 const s=await readFile(new URL('./shortcut-browser.js',import.meta.url),'utf8');assert.ok(!/localStorage|sessionStorage|dispatchEvent/.test(s));assert.ok(s.includes('preventScroll:true'));
});
test('new runtime files are built, cached and identically mirrored',async()=>{
 for(const file of ['adaptive-dose-choices.js','shortcut-browser.js','liquid-doses.js','liquid-doses.css','sw.js','build.mjs'])assert.equal(await readFile(new URL(file,import.meta.url),'utf8'),await readFile(new URL('../public/rxcalc/'+file,import.meta.url),'utf8'));
 for(const file of ['adaptive-dose-choices.js','shortcut-browser.js'])for(const inFile of ['sw.js','build.mjs'])assert.ok((await readFile(new URL(inFile,import.meta.url),'utf8')).includes(file));
});
