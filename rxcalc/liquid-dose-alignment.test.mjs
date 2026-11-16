import test from 'node:test';
import assert from 'node:assert/strict';
import {liquidDoseChoices, liquidDoseChoicesMarkup} from './liquid-doses.js';
import {DRUGS} from './catalogue.js';
import {HUMAN_REGIMENS} from './human-regimens.js';

const form=DRUGS.find(d=>d.id==='amoxicillin-clavulanate').forms.find(f=>f.id==='augmentin-400-57');
const source=HUMAN_REGIMENS.find(s=>s.id==='dental-augmentin-400-57-child');
const options={source,doseMode:'perKgDay',weight:20,frequency:2,eligibility:{valid:true}};
const render=choices=>liquidDoseChoicesMarkup(choices,{unit:'mg/kg/d'});
const alignment=choices=>render(choices).match(/data-align="(start|end)"/)?.[1];
const mock=(count,canLower,canHigher)=>{
 const choices=liquidDoseChoices(form,{...options,page:0}).slice(0,count);
 Object.defineProperty(choices,'browser',{value:{key:'layout-test',form,settings:options,
  window:{page:0,anchored:true,weighted:true,canLower,canHigher}}});
 return choices;
};

test('actual lower edge keeps both smallest values and places the gap on the left',()=>{
 const c=liquidDoseChoices(form,{...options,page:-1000});
 assert.deepEqual(c.map(x=>x.ml),[.25,.5]);
 assert.deepEqual(c.map(x=>x.value),[2,4]);
 assert.equal(c.browser.window.canLower,false);
 assert.equal(alignment(c),'end');
 assert.equal((render(c).match(/data-action="liquid-dose"/g)||[]).length,2);
});
test('one remaining lower-edge tile occupies the right-hand slot',()=>assert.equal(alignment(mock(1,false,true)),'end'));
test('two remaining upper-edge tiles retain left alignment',()=>assert.equal(alignment(mock(2,true,false)),'start'));
test('one remaining upper-edge tile retains left alignment',()=>assert.equal(alignment(mock(1,true,false)),'start'));
test('complete three-tile rows never move, including both boundaries',()=>{
 for(const flags of [[false,true],[true,false],[true,true],[false,false]])assert.equal(alignment(mock(3,...flags)),'start');
});
test('partial rows without a lower boundary retain their ordinary order',()=>{
 assert.equal(alignment(mock(2,true,true)),'start');
 assert.equal(alignment(mock(2,false,false)),'start');
 const plain=[...liquidDoseChoices(form,{...options,page:0})].slice(0,2);
 assert.equal(alignment(plain),'start');
 assert.equal(render([]),'');
});
test('alignment does not alter amounts, warnings, selection or source data',()=>{
 const c=liquidDoseChoices(form,{...options,page:-1000});
 const before=JSON.stringify(c),sourceBefore=JSON.stringify(source);
 const html=liquidDoseChoicesMarkup(c,{dose:4,unit:'mg/kg/d'});
 assert.equal(JSON.stringify(c),before);assert.equal(JSON.stringify(source),sourceBefore);
 assert.equal((html.match(/liquid-dose-warning/g)||[]).length,2);
 assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
 assert.ok(html.indexOf('data-value="0.25"')<html.indexOf('data-value="0.5"'));
 assert.ok(!html.includes('tabindex="-1"'));
});
