import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DRUGS} from './catalogue.js';
import {HUMAN_REGIMENS} from './human-regimens.js';
import {liquidDoseChoices as evaluateLiquidChoices,liquidDoseChoicesMarkup} from './liquid-doses.js';
import {resolveHumanRegimen} from './human-regimen-engine.js';
import {sourceEditState} from './regimen-edit.js';
import {ingredientDailyDose} from './daily-dose.js';
const liquidDoseChoices=(form,options={})=>evaluateLiquidChoices(form,{...options,adaptive:false});
const drug=DRUGS.find(d=>d.id==='amoxicillin-clavulanate');
const form=drug.forms.find(f=>f.id==='augmentin-400-57');
const source=HUMAN_REGIMENS.find(r=>r.id==='dental-augmentin-400-57-child');
const args={source,doseMode:'perKgDay',frequency:2,weight:39,eligibility:{valid:true}};
const choices=(overrides={})=>liquidDoseChoices(form,{...args,...overrides});
const context={formId:form.id,specialty:'dental',patientType:'child',age:3,ageUnit:'years',weight:39,
  days:7,frequency:2,renalStatus:'unknown'};

test('39 kg screenshot: all tiles selectable, smaller volumes yellow, 10 ml unflagged',()=>{
  const list=choices();
  assert.deepEqual(list.map(c=>c.allowed),[true,true,true]);
  assert.deepEqual(list.map(c=>c.severity),['warning','warning',null]);
  assert.deepEqual(list.map(c=>c.reason),['Poniżej zakresu schematu','Poniżej zakresu schematu','']);
  assert.equal(list[2].value,41.025641025641);
});
test('35 kg screenshot: 10 ml stays selectable but red above the scheme',()=>{
  const list=choices({weight:35});
  assert.ok(list.every(c=>c.allowed));
  assert.deepEqual(list.map(c=>c.severity),['warning','warning','critical']);
  assert.equal(list[2].reason,'Powyżej zakresu schematu');
  assert.ok(list[2].warnings.some(w=>w.code==='daily-limit'));
});
test('range endpoints are accepted without below/above warnings',()=>{
  assert.equal(choices({weight:16})[0].value,25);
  assert.equal(choices({weight:16})[0].severity,null);
  const upper=choices({weight:1600/45})[2];
  assert.equal(upper.value,45);assert.equal(upper.severity,null);
});
test('under-range tile remains an invalid source regimen after selection',()=>{
  const c=choices()[0];assert.equal(c.allowed,true);
  const resolved=resolveHumanRegimen(source,{...context,dose:c.value},{allowNumericOverrides:true});
  assert.equal(resolved.valid,false);assert.ok(resolved.errors.some(e=>e.includes('poza zakresem')));
  assert.equal(sourceEditState(source,{dose:c.value,frequency:2}).modified,true);
});
test('over-range tile does not relax original daily ceiling or source validation',()=>{
  const c=choices({weight:35})[2];
  const resolved=resolveHumanRegimen(source,{...context,weight:35,dose:c.value},{allowNumericOverrides:true});
  assert.equal(c.allowed,true);assert.equal(resolved.valid,false);assert.equal(resolved.maxDailyMg,1575);
  assert.ok(resolved.errors.some(e=>e.includes('przekracza limit')));
  assert.equal(source.maxDailyMgPerKg,45);
});
test('both ingredients still reflect actual selected volume outside range with no duration',()=>{
  for(const weight of [35,39])for(const c of choices({weight})) {
    const input={form:'suspension',doseMode:'perKgDay',dose:c.value,weight,frequency:2,days:null,
      concentrationMg:400,concentrationMl:5,unitLabel:'ml',packageSize:35};
    const resolved=resolveHumanRegimen(source,{...context,weight,dose:c.value},{allowNumericOverrides:true});
    const note=ingredientDailyDose({form,drug,input,source,sourceCheck:resolved});
    assert.ok(Math.abs(note.rows[0].daily-c.mg*2)<1e-7);
    assert.ok(Math.abs(note.rows[1].daily-c.ml*2*57/5)<1e-7);
    assert.equal(note.rows[0].ceiling,45*weight);
  }
});
test('a stricter limit is red even when a value is also below the source range',()=>{
  const c=choices({maxDailyMg:300})[0];
  assert.equal(c.allowed,true);assert.equal(c.severity,'critical');assert.equal(c.reason,'Ponad limit dobowy');
  assert.deepEqual(c.warnings.map(w=>w.code),['below-range','daily-limit']);
});
test('manual source-free amounts remain selectable with a red numeric-limit warning',()=>{
  const list=choices({source:null,doseMode:'fixed',maxSingleMg:300,maxDailyMg:700});
  assert.ok(list.every(c=>c.allowed));assert.deepEqual(list.map(c=>c.severity),[null,'critical','critical']);
});
test('fixed source comparison is labelled as a source dose, not a universal safe ceiling',()=>{
  const list=choices({source:{doseMode:'fixed',dose:400},doseMode:'fixed'});
  assert.deepEqual(list.map(c=>c.severity),['warning',null,'critical']);
  assert.equal(list[0].reason,'Poniżej dawki ze źródła');assert.equal(list[2].reason,'Powyżej dawki ze źródła');
});
test('volume-only IU formulation uses unit ceilings without inventing mg',()=>{
  const f={...form,concentrationMg:null,concentrationMl:null,unitOnly:true};
  const list=liquidDoseChoices(f,{doseMode:'units',source:{doseMode:'units',maxDailyUnits:10},frequency:2});
  assert.ok(list.every(c=>c.allowed&&c.mg===null));assert.equal(list[2].severity,'critical');
});
test('missing patient inputs and incompatible rounding still disable unusable shortcuts',()=>{
  for(const change of [{weight:null},{frequency:null},{eligibility:{valid:false}},
    {doseMode:'fixed'},{maxDailyMg:NaN}]) {
    assert.ok(choices(change).every(c=>!c.allowed&&c.severity===null&&c.warnings.length===0));
  }
  const rounded=choices({roundingStep:1});assert.equal(rounded[0].allowed,false);
  assert.equal(rounded[0].reason,'Zmień krok zaokrąglenia');assert.equal(rounded[1].allowed,true);
});
test('selected warning retains its color, text and pressed state without disabled markup',()=>{
  const list=choices({weight:35});const html=liquidDoseChoicesMarkup(list,{dose:list[2].value,unit:'mg/kg/d',basis:'amoksycyliny'});
  assert.ok(!/\sdisabled(?:\s|>)/.test(html));assert.ok(html.includes('liquid-dose-critical'));
  assert.ok(html.includes('liquid-dose-warning'));assert.ok(html.includes('Poniżej zakresu schematu'));
  assert.ok(html.includes('Powyżej zakresu schematu'));assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
  assert.ok(html.includes('✓'));assert.ok(html.includes('kontrola kopiowania pozostaje aktywna'));
});
test('text and title warnings escape markup rather than trusting display data',()=>{
  const c={...choices()[0],reason:'<img src=x>',warnings:[{message:'<script>bad</script>'}]};
  const html=liquidDoseChoicesMarkup([c],{basis:'" onmouseover="bad'});
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&lt;script'));
});
test('classification leaves original source and patient context unchanged',()=>{
  const frozen=structuredClone(args),before=structuredClone(frozen);
  const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
  assert.doesNotThrow(()=>liquidDoseChoices(freeze(structuredClone(form)),freeze(frozen)));
  assert.deepEqual(frozen,before);
});
test('warning styles use theme colors and runtime mirror stays identical',async()=>{
  const css=await readFile(new URL('liquid-doses.css',import.meta.url),'utf8');
  for(const v of ['--warn','--warn-bg','--red','--red-bg'])assert.ok(css.includes(`var(${v})`));
  for(const name of ['liquid-doses.js','liquid-doses.css','sw.js'])assert.equal(
    await readFile(new URL(name,import.meta.url),'utf8'),
    await readFile(new URL(`../public/rxcalc/${name}`,import.meta.url),'utf8'));
});
