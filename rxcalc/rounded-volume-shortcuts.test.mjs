import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { roundedVolumeShortcut, ADULT_AUGMENTIN_ROUNDED_SHORTCUT as preset } from './rounded-volume-shortcuts.js';
import { liquidShortcutWindow, liquidShortcutKey } from './adaptive-dose-choices.js';
import { liquidDoseChoices, liquidDoseChoicesMarkup } from './liquid-doses.js';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { LIQUID_STARTER_REGIMENS } from './liquid-starters.js';
import { calculate } from './engine.js';
import { ingredientDailyDose } from './daily-dose.js';
import { resolveHumanRegimen } from './human-regimen-engine.js';
const drug=DRUGS.find(d=>d.id==='amoxicillin-clavulanate');
const form=drug.forms.find(f=>f.id==='augmentin-400-57');
const source=LIQUID_STARTER_REGIMENS[0];
const options={source,doseMode:'fixed',weight:70,frequency:2,eligibility:{valid:true},page:0};
const choices=o=>liquidDoseChoices(form,{...options,...o});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('documented adult shortcut replaces only the central exact-volume candidate',()=>{
 const c=choices();assert.deepEqual(c.map(x=>x.ml),[10,11,12.5]);
 assert.equal(c[1].value,880);assert.equal(c[1].roundedShortcut,preset);
 assert.equal(c[0].roundedShortcut,undefined);assert.equal(c[2].roundedShortcut,undefined);
});
test('rounded shortcut is explicit, warns about original limits and does not masquerade as 875 mg',()=>{
 const c=choices()[1];assert.equal(c.allowed,true);assert.equal(c.severity,'critical');
 for(const code of ['above-source','single-limit','daily-limit'])assert.ok(c.warnings.some(w=>w.code===code));
 const html=liquidDoseChoicesMarkup(choices(),{dose:875,unit:'mg',basis:'amoksycyliny'});
 assert.ok(html.includes('data-value="11"'));assert.ok(html.includes('Zaokrąglenie +0,57%'));
 assert.ok(html.includes('880 mg + 125,4 mg na podanie')); 
 assert.ok(!html.includes('aria-pressed="true"'));assert.ok(html.includes('Dopiero kliknięcie'));
});
test('choosing 11 ml preserves warning tone and pressed state',()=>{
 const html=liquidDoseChoicesMarkup(choices(),{dose:880});
 assert.match(html,/<button[^>]*active[^>]*liquid-dose-critical[^>]*data-value="11"[^>]*aria-pressed="true"/);
});
test('all downstream quantities use 11 ml, 880 mg and 125.4 mg, not the exact source volume',()=>{
 const c=choices()[1],input={form:'suspension',patientKind:'human',doseMode:'fixed',dose:c.value,frequency:2,weight:70,days:7,concentrationMg:400,concentrationMl:5,packageSize:35,unitLabel:'ml'};
 const r=calculate(input);assert.equal(r.singleUnits,11);assert.equal(r.dailyMg,1760);assert.equal(r.totalUnits,154);
 const note=ingredientDailyDose({form,drug,input});assert.equal(note.rows[0].daily,1760);close(note.rows[1].daily,250.8);
 close(preset.deltaPercent,5/875*100);assert.equal(preset.referenceMl,10.9375);
});
test('original source validation and ceilings still reject the rounded dose for export',()=>{
 const r=resolveHumanRegimen(source,{formId:form.id,specialty:'dental',patientType:'adult',weight:70,age:35,ageUnit:'years',dose:880,frequency:2,days:7,renalStatus:'unknown'},{allowNumericOverrides:true});
 assert.equal(r.valid,false);assert.equal(r.maxSingleMg,875);assert.equal(r.maxDailyMg,1750);
});
test('explicit 0.1 ml grid retains generic 10.9 ml bracketing and does not invoke the named shortcut',()=>{
 const c=choices({roundingStep:.1});assert.deepEqual(c.map(x=>x.ml),[10,10.9,11]);
 assert.ok(c.every(x=>!x.roundedShortcut));assert.equal(c[1].value,872);
 for(const roundingStep of [.01,.05,.5,1,0,NaN])assert.equal(roundedVolumeShortcut(form,{...options,roundingStep}),null);
});
test('no source, other sources, ranges and pediatric contexts are excluded',()=>{
 const child=HUMAN_REGIMENS.find(r=>r.id==='dental-augmentin-400-57-child');
 for(const other of [null,child,{...source,id:'other'},{...source,patientTypes:['child']},{...source,patientTypes:['child','adult']},{...source,dose:500},{...source,doseRange:{min:875,max:1000}}])
  assert.equal(roundedVolumeShortcut(form,{...options,source:other}),null);
 const c=choices({source:child,doseMode:'perKgDay',weight:35});
 assert.deepEqual(c.map(x=>x.value),[25,35,45]);assert.ok(c.every(x=>!x.roundedShortcut));
});
test('unknown weight and failed eligibility cannot enable the documented adult shortcut',()=>{
 for(const weight of [null,undefined,0,39.9,501,Infinity,NaN,'70'])assert.equal(roundedVolumeShortcut(form,{...options,weight}),null);
 for(const eligibility of [null,undefined,{valid:false},{valid:'true'}])assert.equal(roundedVolumeShortcut(form,{...options,eligibility}),null);
 for(const weight of [40,70,500])assert.equal(roundedVolumeShortcut(form,{...options,weight}),preset);
});
test('strength, clavulanate ratio, formulation and route-related flags must match exactly',()=>{
 for(const diff of [{id:'other'},{form:'tablet'},{form:'solution'},{unitLabel:'g'},{concentrationMg:250},{concentrationMl:10},{ingredients:[]},{ingredients:[form.ingredients[0],{amountMg:125,perMl:5}]},{referenceOnly:true},{calculationBlocked:true},{calculationMode:'instruction'}])
  assert.equal(roundedVolumeShortcut({...form,...diff},options),null);
 assert.equal(roundedVolumeShortcut(form,{...options,veterinary:true}),null);
});
test('overridden frequency and other dose modes do not inherit the specific shortcut',()=>{
 for(const frequency of [null,1,3,4,NaN])assert.equal(roundedVolumeShortcut(form,{...options,frequency}),null);
 for(const doseMode of ['units','perKgDay','perKgDose'])assert.equal(roundedVolumeShortcut(form,{...options,doseMode}),null);
 assert.equal(roundedVolumeShortcut(form,{...options,source:{...source,frequency:3}}),null);
});
test('page navigation and dose edits do not recenter or silently apply rounding',()=>{
 const before=structuredClone(options);
 for(const dose of ['',875,880,1000,1600]){
  assert.deepEqual(liquidShortcutWindow(form,{...options,dose}).volumes,[10,11,12.5]);
  assert.equal(liquidShortcutKey(form,{...options,dose}),liquidShortcutKey(form,options));
 }
 const paged=choices({page:1});assert.deepEqual(paged.map(x=>x.ml),[12.5,15,17.5]);assert.ok(paged.every(x=>!x.roundedShortcut));
 assert.deepEqual(options,before);assert.equal(source.dose,875);
});
test('lower physician limits are not widened or removed for a rounded shortcut',()=>{
 const c=choices({maxDailyMg:1500})[1];assert.equal(c.allowed,true);assert.equal(c.severity,'critical');assert.ok(c.warnings.some(w=>w.code==='daily-limit'));
 assert.equal(source.maxDailyMg,1750);
});
test('source context, arithmetic discrepancy and foreign/off-label scope remain visible',()=>{
 const html=liquidDoseChoicesMarkup(choices());
 for(const text of ['HSE','Cleveland Clinic','off-label','2020','Nie jest to nowy schemat stomatologiczny','blokady kopiowania','880 mg, nie 875 mg'])assert.ok(html.includes(text),text);
 assert.ok(html.includes('10,9375 ml'));assert.ok(html.includes('Zaokrąglenie i źródła'));
});
test('building and rendering never writes patient values or relaxes validation',()=>{
 const input=structuredClone(options),before=JSON.stringify(input);
 Object.freeze(input.source);Object.freeze(input);assert.doesNotThrow(()=>liquidDoseChoicesMarkup(choices(input)));
 assert.equal(JSON.stringify(input),before);assert.ok(Object.isFrozen(preset));assert.ok(Object.isFrozen(preset.references));
});
test('new module is present offline and hosted mirrors are identical',async()=>{
 for(const file of ['rounded-volume-shortcuts.js','adaptive-dose-choices.js','liquid-doses.js','liquid-doses.css','sw.js','build.mjs'])assert.equal(await readFile(new URL(file,import.meta.url),'utf8'),await readFile(new URL('../public/rxcalc/'+file,import.meta.url),'utf8'));
 for(const file of ['sw.js','build.mjs'])assert.ok((await readFile(new URL(file,import.meta.url),'utf8')).includes('rounded-volume-shortcuts.js'));
});
