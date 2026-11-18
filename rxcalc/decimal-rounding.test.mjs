import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './engine.js';
import { ingredientDailyDose } from './daily-dose.js';
import { DECIMAL_PLACES, normalizeDecimalPlaces, supportsDecimalRounding,
  effectiveRoundingStep } from './decimal-rounding.js';

const form = Object.freeze({form:'suspension',unitLabel:'ml',concentrationMg:400,concentrationMl:5});
const base = Object.freeze({...form,doseMode:'fixed',dose:875,frequency:2,days:7,
  packageSize:70,maxSingleMg:875,maxDailyMg:1750});
const rounded = (places, extra = {}) => calculate({...base,...extra,
  roundingStep:effectiveRoundingStep({enabled:true,places,form})});

test('decimal precision accepts supported numeric/select values and preserves zero', () => {
  for (const places of DECIMAL_PLACES) {
    assert.equal(normalizeDecimalPlaces(places),places);
    assert.equal(normalizeDecimalPlaces(String(places)),places);
    assert.equal(effectiveRoundingStep({enabled:true,places,form}),10**-places);
  }
  assert.equal(normalizeDecimalPlaces(' 0 '),0);
});

test('missing, nonfinite and out-of-range precision never becomes zero places', () => {
  for (const value of [null,undefined,'',' ',false,true,-1,4,1.5,NaN,Infinity,'1e0','0.5',[],{}]) {
    assert.equal(normalizeDecimalPlaces(value),2,`${String(value)}`);
  }
  assert.equal(normalizeDecimalPlaces(null,0),0);
  assert.equal(normalizeDecimalPlaces(null,3),3);
  assert.equal(normalizeDecimalPlaces(null,99),2);
});

test('continuous liquid and gram quantities support precision without inventing a measuring step', () => {
  for (const type of ['suspension','solution','injection']) {
    assert.equal(supportsDecimalRounding({form:type,unitLabel:'ml'}),true,type);
  }
  for (const type of ['oralPaste','oralPowder','oralGel','gel']) {
    assert.equal(supportsDecimalRounding({form:type,unitLabel:'g'}),true,type);
  }
  assert.equal(supportsDecimalRounding({...form,unitOnly:true}),true);
});

test('tablets, capsules, actuations, drops and wrong units cannot acquire decimal rounding', () => {
  for (const item of [null,{},[],{form:'tablet',unitLabel:'tabl.'},
    {form:'tablet',unitLabel:'kaps.'},{form:'capsule',unitLabel:'kaps.'},
    {form:'spray',unitLabel:'rozp.'},{form:'drops',unitLabel:'kropli'},
    {form:'drops',unitLabel:'ml'},{form:'suspension',unitLabel:'mg'},
    {form:'oralPaste',unitLabel:'ml'}]) {
    assert.equal(supportsDecimalRounding(item),false,JSON.stringify(item));
    assert.equal(effectiveRoundingStep({enabled:true,form:item,places:0}),null);
  }
});

test('instruction, reference and preparation-blocked forms stay excluded', () => {
  for (const property of ['referenceOnly','calculationBlocked']) {
    assert.equal(supportsDecimalRounding({...form,[property]:true}),false);
  }
  assert.equal(supportsDecimalRounding({...form,calculationMode:'instruction'}),false);
  assert.equal(supportsDecimalRounding(form,{doseMode:'instruction'}),false);
});

test('a device-specific step, including malformed metadata, cannot be replaced by a decimal preference', () => {
  for (const doseStepUnits of [0.5,400/370,0,-1,NaN,'0.1',false]) {
    assert.equal(supportsDecimalRounding({...form,doseStepUnits}),false);
    assert.equal(supportsDecimalRounding(form,{doseStepUnits}),false);
  }
  assert.equal(supportsDecimalRounding({...form,doseStepUnits:null}),true);
});

test('off restores the exact baseline without mutating the selected form or source', () => {
  const source = Object.freeze({doseMode:'fixed',dose:875});
  for (const baselineStep of [null,undefined,0.05,0.1,NaN,0,-1]) {
    // Undefined is an omitted option and therefore has the documented null default.
    const expected = baselineStep === undefined ? null : baselineStep;
    assert.ok(Object.is(effectiveRoundingStep({enabled:false,places:0,form,source,baselineStep}),expected));
  }
  assert.equal(effectiveRoundingStep({enabled:true,places:1,form,source,baselineStep:0.05}),0.1);
  assert.equal(source.dose,875);
  assert.equal(form.concentrationMg,400);
  assert.equal(effectiveRoundingStep({enabled:'true',places:0,form,baselineStep:null}),null);
});

test('switching off after rounding recovers the original arithmetic quantity', () => {
  const on = rounded(1);
  const off = calculate({...base,roundingStep:effectiveRoundingStep({enabled:false,places:1,form})});
  assert.equal(on.singleUnits,10.9);
  assert.equal(off.singleUnits,10.9375);
  assert.equal(off.singleMg,875);
  assert.equal(off.totalUnits,153.125);
  assert.equal(off.roundingDifferencePercent,0);
  assert.equal(base.dose,875);
});

test('rounding changes actual mg, course amount and supply together', () => {
  const r = rounded(1,{packageSize:153});
  assert.equal(r.valid,true);
  assert.equal(r.singleUnits,10.9);
  assert.equal(r.singleMg,872);
  assert.equal(r.dailyMg,1744);
  assert.equal(r.totalUnits,152.6);
  assert.equal(r.packages,1);
  assert.equal(calculate({...base,packageSize:153}).packages,2);
  assert.match(r.warnings.join(' '),/Zaokrąglono ilość/);
});

test('rounded quantities remain subject to independent single and daily limits', () => {
  for (const places of [0,2,3]) {
    const r = rounded(places);
    assert.equal(r.valid,false,`${places} places`);
    assert.equal(r.status,'critical');
    assert.ok(r.singleMg>875);
    assert.ok(r.dailyMg>1750);
    assert.match(r.errors.join(' '),/przekracza wprowadzony limit/);
  }
});

test('both ingredients use the rounded amount while source quantities stay intact', () => {
  const combination = {...form,ingredients:[
    {name:'amoksycylina',amountMg:400,perMl:5},
    {name:'kwas klawulanowy',amountMg:57,perMl:5},
  ]};
  const source = Object.freeze({doseMode:'fixed',dose:875,frequency:2});
  const input = {...base,roundingStep:effectiveRoundingStep({enabled:true,places:1,form:combination,source})};
  const note = ingredientDailyDose({form:combination,input,source,sourceCheck:{maxDailyMg:1750}});
  assert.equal(note.dailyUnits,21.8);
  assert.equal(note.rows[0].daily,1744);
  assert.equal(note.rows[1].daily,248.52);
  assert.equal(note.rows[0].ceiling,1750);
  assert.equal(note.rows[1].ceiling,249.375);
  assert.deepEqual(note.rounding,{from:10.9375,to:10.9});
  const restored = ingredientDailyDose({form:combination,input:{...input,
    roundingStep:effectiveRoundingStep({enabled:false,places:1,form:combination,source})}});
  assert.equal(restored.rows[1].daily,249.375);
  assert.equal(source.dose,875);
});

test('rounding a small nonzero amount to zero stays an error', () => {
  const r = rounded(0,{doseMode:'units',dose:0.125});
  assert.equal(r.valid,false);
  assert.equal(r.singleUnits,null);
  assert.match(r.errors.join(' '),/zerową dawkę/);
});

test('gram preparations use the same canonical arithmetic path', () => {
  const grams = {form:'oralPowder',unitLabel:'g',strengthMg:100};
  const r = calculate({...grams,doseMode:'fixed',dose:123.45,frequency:2,days:3,
    packageSize:10,roundingStep:effectiveRoundingStep({enabled:true,places:2,form:grams})});
  assert.equal(r.valid,true);
  assert.equal(r.singleUnits,1.23);
  assert.equal(r.singleMg,123);
  assert.equal(r.totalUnits,7.38);
});
