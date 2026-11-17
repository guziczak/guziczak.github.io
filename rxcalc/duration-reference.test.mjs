import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HUMAN_REGIMENS} from './human-regimens.js';
import {DRUGS} from './catalogue.js';
import {calculate} from './engine.js';
import {ingredientDailyDose} from './daily-dose.js';
import {resolveHumanRegimen} from './human-regimen-engine.js';
import {resolveDurationGuidance,assessDuration,durationResultWarning} from './duration-guidance.js';
import {durationGuidanceMarkup} from './duration-view.js';
const source=HUMAN_REGIMENS.find(s=>s.id==='dental-augmentin-400-57-child');
const drug=DRUGS.find(d=>d.forms.some(f=>f.id==='augmentin-400-57'));
const form=drug.forms.find(f=>f.id==='augmentin-400-57');
const context={specialty:'dental',patientType:'child',formId:form.id,age:5,ageUnit:'years',weight:20,
  renalStatus:'unknown',crcl:null,doseMode:'perKgDay',dose:35,frequency:2,days:5};
const opts=()=>({source:structuredClone(source),form:structuredClone(form),context:{...context}});
const g=(changes={})=>resolveDurationGuidance({...opts(),...changes});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('pediatric Augmentin gets a separate UCSF time comparison, not a replacement source',()=>{
 const r=g();assert.equal(r.applicable,true);assert.equal(r.rule.origin,'source');
 assert.equal(r.rule.minimum,null);assert.equal(r.rule.maximum,null);assert.equal(r.rule.reviewAfterDays,14);
 assert.equal(r.reference.minimum,3);assert.equal(r.reference.maximum,7);assert.equal(r.reference.hardMaximum,false);
 assert.equal(r.reference.organization,'UCSF');assert.equal(r.reference.checkedAt,'2026-11-17');
 assert.match(r.reference.url,/idmp\.ucsf\.edu\/content\/dental-infection$/);
});
test('UCSF provenance retains prior nonresponse, dose cap, twice-daily and dental consultation conditions',()=>{
 const r=g().reference;
 for(const re of [/niewystarczającej odpowiedzi/,/22,5/,/875/,/2 razy/,/konsultację stomatologiczną/,/powikłanych/])assert.match(r.note,re);
 assert.equal(r.reviewAfterDays,null);assert.equal(r.reviewText,'');
 assert.match(r.additionalSources[0].url,/maximum-dosing/);
});
test('35 mg/kg/day does not grant green UCSF agreement for any 3 through 7 day duration',()=>{
 for(const d of [3,4,5,6,7]){const a=assessDuration(d,g());assert.equal(a.tone,'warning');assert.equal(a.short,'Wymaga oceny');assert.equal(a.timeState,'within');assert.match(a.message,/UCSF/);assert.ok(durationResultWarning(d,g()));}
});
test('short and longer than reference durations are advisory amber, not invented prohibitions',()=>{
 for(const d of [1,2,8,10]){const a=assessDuration(d,g());assert.equal(a.tone,'warning');assert.match(a.message,/UCSF/);}
 assert.equal(assessDuration(2,g()).state,'below');assert.equal(assessDuration(10,g()).state,'above');
});
test('primary 14-day extension review survives a supplementary time range',()=>{
 assert.doesNotMatch(assessDuration(14,g()).message,/Nie przedłużać/);
 const a=assessDuration(15,g());assert.equal(a.tone,'warning');assert.equal(a.sourceState,'review');
 assert.match(a.message,/3–7 dni w UCSF/);assert.match(a.message,/Nie przedłużać.*14 dni/);
 assert.equal(durationResultWarning(15,g()),a.message);
});
test('primary hard or review restrictions cannot be turned green by supplementary comparison',()=>{
 const r=g();r.rule={...r.rule,maximum:4,hardMaximum:true};
 assert.equal(assessDuration(5,r).tone,'critical');
 r.rule={...r.rule,maximum:null,hardMaximum:false,reviewAfterDays:4,reviewText:'Ocena po 4 dniach.'};
 assert.equal(assessDuration(5,r).tone,'warning');assert.match(assessDuration(5,r).message,/Ocena po 4 dniach/);
});
test('typed and clicked durations use the same assessment; empty is not zero',()=>{
 for(const d of [2,3,5,7,10,15])assert.deepEqual(assessDuration(d,g()),assessDuration(String(d),g()));
 for(const v of [null,undefined,'',' '])assert.equal(assessDuration(v,g()).state,'pending');
 for(const v of [0,-1,1.5,'x',Infinity,3661])assert.equal(assessDuration(v,g()).state,'invalid');
});
test('35 mg/kg/day is not silently changed to the 45 mg/kg/day UCSF reference',()=>{
 const o=opts(),before=JSON.stringify(o);const r=resolveDurationGuidance(o);
 assert.equal(r.reference.doseComparison,'different');assert.match(r.reference.contextNotice,/różni się/);
 assert.equal(r.reference.comparisonSingleMg,450);assert.equal(o.context.dose,35);assert.equal(JSON.stringify(o),before);
});
test('dose comparison includes frequency and UCSF 875 mg per-dose cap, without updating limits',()=>{
 assert.equal(g({context:{...context,dose:45}}).reference.doseComparison,'same');
 assert.equal(g({context:{...context,dose:45,frequency:1}}).reference.doseComparison,'different');
 const r=g({context:{...context,weight:39,dose:45}}).reference;
 assert.equal(r.comparisonSingleMg,875);assert.equal(r.doseComparison,'different');
 assert.equal(source.maxDailyMgPerKg,45);assert.equal(source.maxSingleMg,undefined);
});
test('absence of dose/frequency is not agreement and does not choose a course',()=>{
 const r=g({context:{...context,dose:null,frequency:null,days:null}});
 assert.equal(r.reference.doseComparison,'unknown');assert.equal(assessDuration(null,r).state,'pending');
 assert.equal(assessDuration(3,r).tone,'neutral');
 assert.equal(source.defaultDays,undefined);
});
test('UCSF notice and duration use the same actual dose after rounding',()=>{
 const r=g({context:{...context,dose:45,roundingStep:0.1}});
 assert.equal(r.reference.doseComparison,'different');
 assert.equal(r.regimen.state,'mismatch');
 assert.match(r.reference.contextNotice,/różni się/);
 assert.doesNotMatch(r.reference.contextNotice,/odpowiada UCSF/);
 assert.equal(assessDuration(3,r).tone,'warning');
 const html=durationGuidanceMarkup({choices:[3,5,7,10],days:3,guidance:r});
 assert.doesNotMatch(html,/Dawkowanie liczbowe odpowiada UCSF/);
});
test('numerical agreement with UCSF does not confirm its unassessed clinical conditions',()=>{
 const r=g({context:{...context,dose:45}});
 assert.equal(r.reference.doseComparison,'same');assert.equal(r.regimen.state,'review');
 for(const d of [3,5,7]){
  const a=assessDuration(d,r);assert.equal(a.tone,'warning');
  assert.match(a.message,/niewystarczającej odpowiedzi/);assert.match(a.message,/powikłaniach/);
 }
});
test('unknown patient conditions suspend colors rather than imply clinical applicability',()=>{
 for(const change of [{weight:null},{weight:40},{age:null},{age:1,ageUnit:'months'},{patientType:'adult'},
   {renalStatus:'impaired'},{crcl:20},{specialty:'veterinary'},{custom:true}]){
  const r=g({context:{...context,...change}});assert.equal(r.reference,undefined,JSON.stringify(change));
  assert.equal(assessDuration(5,r).tone,'neutral');
 }
});
test('adult age in child UI cannot inherit the pediatric reference',()=>{
 assert.equal(g({context:{...context,age:18}}).reference,undefined);
 assert.ok(g({context:{...context,age:17}}).reference);
});
test('changed indication or source signature is unverified, not silently mapped to UCSF',()=>{
 for(const change of [{id:'other'},{indication:'Other infection'},{frequency:3},{doseRange:{min:20,max:90}}]){
  const r=g({source:{...source,...change}});assert.equal(r.reference,undefined);assert.equal(assessDuration(5,r).tone,'neutral');
 }
});
test('other strength, proportion or route has no supplementary comparison',()=>{
 for(const change of [{concentrationMg:600},{routeLabel:'dożylnie'},{ingredients:[{amountMg:400,perMl:5},{amountMg:40,perMl:5}]}])
 assert.equal(g({form:{...form,...change}}).reference,undefined);
});
test('manual and adult Augmentin do not receive pediatric time ranges',()=>{
 assert.equal(g({source:null}).reference,undefined);
 const s=HUMAN_REGIMENS.find(s=>s.id==='dental-augmentin-tablet-875-125-ge40');
 const f=DRUGS.flatMap(d=>d.forms).find(f=>f.id===s.formIds[0]);
 const r=resolveDurationGuidance({source:s,form:f,context:{...context,patientType:'adult',age:35,weight:70}});
 assert.equal(r.reference,undefined);assert.equal(assessDuration(5,r).tone,'neutral');
});
test('Ospamox retains SDCEP 3–5 rather than being broadened to UCSF 3–7',()=>{
 const s=HUMAN_REGIMENS.find(s=>s.id==='dental-ospamox-child-tid');
 const f=DRUGS.flatMap(d=>d.forms).find(f=>f.id==='ospamox-250');
 const r=resolveDurationGuidance({source:s,form:f,context:{...context,formId:f.id}});
 assert.equal(r.reference,undefined);assert.equal(r.rule.maximum,5);assert.equal(assessDuration(7,r).tone,'warning');
});
test('longer external time never relaxes dose resolver, renal or manual limit checks',()=>{
 const before=resolveHumanRegimen(source,{...context,days:10},{allowNumericOverrides:true});
 assert.equal(before.valid,true);assert.match(durationResultWarning(10,g()),/UCSF/);
 assert.deepEqual(resolveHumanRegimen(source,{...context,days:10},{allowNumericOverrides:true}),before);
 assert.equal(resolveHumanRegimen(source,{...context,dose:46},{allowNumericOverrides:true}).valid,false);
});
test('source arithmetic screenshot: 20 kg, 35 mg/kg/day, BID, 5 days, 35 ml pack',()=>{
 const input={...form,...context,packageSize:35,maxDailyMg:900,unitLabel:'ml'};
 const r=calculate(input);assert.equal(r.valid,true);assert.equal(r.singleMg,350);assert.equal(r.dailyMg,700);
 assert.equal(r.singleUnits,4.375);assert.equal(r.totalUnits,43.75);assert.equal(r.packages,2);
 const preview=ingredientDailyDose({form,drug,input});near(preview.rows[1].daily,99.75);
 const before=JSON.stringify(r);g();assert.equal(JSON.stringify(calculate(input)),before);
});
test('explicit 0.1 ml rounding recalculates both substances and total supply, not just labels',()=>{
 const input={...form,...context,packageSize:35,roundingStep:0.1,maxDailyMg:900,unitLabel:'ml'};
 const r=calculate(input),p=ingredientDailyDose({form,drug,input});
 assert.equal(r.singleUnits,4.4);assert.equal(r.singleMg,352);assert.equal(r.dailyMg,704);
 assert.equal(r.totalUnits,44);near(p.rows[1].daily,100.32);assert.equal(r.packages,2);
});
test('view keeps external context visible and separate ChPL review in disclosure',()=>{
 const html=durationGuidanceMarkup({choices:[3,5,7,10],days:5,guidance:g()});
 assert.match(html,/Porównanie czasu: UCSF \(dzieci\)/);assert.match(html,/duration-reference-context/);
 const mismatchAt=html.indexOf('Rzeczywista dawka na podanie');
 assert.ok(mismatchAt>=0&&mismatchAt<html.indexOf('<details'));
 assert.ok(html.indexOf('niewystarczającej odpowiedzi')<html.indexOf('<details'));
 assert.match(html,/Osobny warunek ChPL:/);assert.match(html,/14 dni/);assert.doesNotMatch(html,/według SDCEP/);
 assert.match(html,/duration-neutral active.*data-value="5"/);assert.doesNotMatch(html,/\bdisabled\b/);
 assert.match(html,/W zakresie UCSF/);assert.match(html,/Wybrano/);
});
test('selected longer course retains warning color and one selected checkmark',()=>{
 const html=durationGuidanceMarkup({choices:[3,5,7,10],days:10,guidance:g()});
 assert.match(html,/duration-warning active.*data-value="10"/);
 assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
});
test('new reference module is mirrored, built and precached without patient data',async()=>{
 for(const name of ['duration-reference.js','duration-guidance.js','duration-view.js','duration.css','build.mjs','sw.js'])
 assert.equal(await readFile(new URL(name,import.meta.url),'utf8'),await readFile(new URL('../public/rxcalc/'+name,import.meta.url),'utf8'));
 for(const name of ['build.mjs','sw.js'])assert.match(await readFile(new URL(name,import.meta.url),'utf8'),/'duration-reference\.js'/);
 assert.doesNotMatch(await readFile(new URL('duration-reference.js',import.meta.url),'utf8'),/localStorage|sessionStorage|fetch\(|dispatchEvent/);
});
