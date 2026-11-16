import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { DRUGS } from './catalogue.js';
import { resolveHumanRegimen } from './human-regimen-engine.js';
import { resolveDurationGuidance, assessDuration, durationPatientEligibility, durationResultWarning } from './duration-guidance.js';
import { durationGuidanceMarkup } from './duration-view.js';

const source = HUMAN_REGIMENS.find(s => s.id === 'dental-ospamox-suspension-ge40-q8');
const form = DRUGS.flatMap(d => d.forms).find(f => f.id === 'ospamox-250');
const context = { formId:form.id,specialty:'dental',patientType:'adult',age:35,ageUnit:'years',weight:70,
  renalStatus:'unknown',crcl:null,dose:250,frequency:3,days:10 };
const opts = () => ({source:structuredClone(source),form:structuredClone(form),context:{...context}});
const g = () => resolveDurationGuidance(opts());
const check = (d,tone) => assert.equal(assessDuration(d,g()).tone,tone);

test('Ospamox abscess has separate, explicitly foreign SDCEP duration reference',()=>{
 const r=g();assert.equal(r.applicable,true);assert.equal(r.rule.origin,'external');
 assert.equal(r.rule.minimum,3);assert.equal(r.rule.maximum,5);assert.equal(r.rule.reviewAfterDays,3);
 assert.match(r.rule.url,/sdcep.*amoxicillin/);assert.match(r.rule.note,/nie zapis ChPL/);assert.equal(r.rule.hardMaximum,false);
});
test('3, 4, 5 days are within duration reference only',()=>{for(const d of [3,4,5])check(d,'within');});
test('7 and 10 days are amber, not forbidden or universally excessive',()=>{for(const d of [7,10])check(d,'warning');assert.match(assessDuration(10,g()).message,/SDCEP.*indywidualnej oceny/);});
test('shorter durations are amber and all outside values share same model',()=>{for(const d of [1,2])check(d,'warning');assert.equal(assessDuration(2,g()).state,'below');});
test('review at 3 days never makes 4/5-day reference values invalid',()=>{
 assert.equal(assessDuration(5,g()).state,'within');assert.equal(assessDuration(3,g()).tone,'within');
 assert.equal(durationResultWarning(5,g()),null);
});
test('missing duration is pending, not zero, and defaults remain empty',()=>{for(const v of ['',null,undefined,'  '])assert.equal(assessDuration(v,g()).state,'pending');assert.equal(source.defaultDays,undefined);});
test('invalid duration is explicitly rejected rather than compared as a recommendation',()=>{
 for(const v of [0,-1,1.5,NaN,Infinity,'abc','1,5',3661])assert.equal(assessDuration(v,g()).state,'invalid');
});
test('typed numeric strings and buttons classify identically',()=>{for(const d of [3,4,5,7,10])assert.deepEqual(assessDuration(d,g()),assessDuration(String(d),g()));});
test('review does not mutate the source, input, dose, day range or maxima',()=>{
 const o=opts(),before=JSON.stringify(o);resolveDurationGuidance(o);assert.equal(JSON.stringify(o),before);
 assert.equal(o.source.minDays,undefined);assert.equal(o.source.maxDays,undefined);assert.equal(o.context.days,10);
});
test('external time deviation remains non-blocking to original resolver',()=>{
 const before=resolveHumanRegimen(source,context,{allowNumericOverrides:true});assert.equal(before.valid,true);
 assert.match(durationResultWarning(10,g()),/Dłużej/);
 assert.deepEqual(resolveHumanRegimen(source,context,{allowNumericOverrides:true}),before);
});
test('missing mass yields neutral choices rather than false green approval',()=>{
 const o=opts();o.context.weight=null;const r=resolveDurationGuidance(o);assert.equal(r.applicable,false);assert.equal(assessDuration(3,r).tone,'neutral');
});
test('missing required age yields neutral choices',()=>{const o=opts();o.context.age=null;assert.equal(resolveDurationGuidance(o).applicable,false);});
test('renal restriction preserves the original scope check',()=>{
 const o=opts();o.context.renalStatus='impaired';assert.equal(resolveDurationGuidance(o).applicable,false);
 o.context.renalStatus='unknown';o.context.crcl=20;assert.equal(resolveDurationGuidance(o).applicable,false);
});
test('duration comparison is independent of blank dose/days and retained after an override',()=>{
 const o=opts();o.context.dose=null;o.context.frequency=null;o.context.days=null;assert.equal(resolveDurationGuidance(o).applicable,true);
 o.context.dose=2000;assert.equal(resolveDurationGuidance(o).applicable,true);
 assert.equal(resolveHumanRegimen(o.source,{...o.context,days:10,frequency:3},{allowNumericOverrides:true}).valid,false);
});
test('manual, custom, reference and veterinary contexts remain neutral',()=>{
 for(const mutate of [o=>o.source=null,o=>o.context.custom=true,o=>o.form.referenceOnly=true,o=>o.context.specialty='veterinary']){
  const o=opts();mutate(o);const r=resolveDurationGuidance(o);assert.equal(r.applicable,false);assert.equal(assessDuration(3,r).tone,'neutral');
 }
});
test('another indication, even with same substance, is not matched by name',()=>{const o=opts();o.source.id='other-ospamox-infection';assert.equal(resolveDurationGuidance(o).rule,null);});
test('different preparation or mismatched form does not inherit duration guidance',()=>{const o=opts();o.form.id='augmentin-400-57';assert.equal(resolveDurationGuidance(o).applicable,false);});
test('Augmentin and Dalacin never inherit amoxicillin 3–5-day reference',()=>{
 for(const id of ['dental-augmentin-400-57-child','dental-dalacin-c-300-over14-tid']){
  const s=HUMAN_REGIMENS.find(r=>r.id===id),f=DRUGS.flatMap(d=>d.forms).find(f=>f.id===s.formIds[0]);
  assert.equal(resolveDurationGuidance({source:s,form:f,context}).rule,null);
 }
});
test('source-matched Ospamox tablets get the same duration reference as suspension',()=>{
 const o=opts();o.source=HUMAN_REGIMENS.find(s=>s.id==='dental-ospamox-tablet-ge40-q8');
 o.form=DRUGS.flatMap(d=>d.forms).find(f=>f.id==='ospamox-tablet-500');
 assert.equal(resolveDurationGuidance(o).rule.id,g().rule.id);assert.equal(resolveDurationGuidance(o).applicable,true);
});
test('child table age scope starts at 6 months and needs real age and mass',()=>{
 const o=opts();o.source=HUMAN_REGIMENS.find(s=>s.id==='dental-ospamox-child-tid');
 o.context={...context,patientType:'child',age:6,ageUnit:'months',weight:8};assert.equal(resolveDurationGuidance(o).applicable,true);
 o.context.age=5;assert.equal(resolveDurationGuidance(o).applicable,false);
 o.context.age=null;assert.equal(resolveDurationGuidance(o).applicable,false);
 o.context.age=5;o.context.ageUnit='years';o.context.weight=20;assert.equal(resolveDurationGuidance(o).applicable,true);
 o.context.weight=40;assert.equal(resolveDurationGuidance(o).applicable,false);
});
test('ambiguous days at infant threshold do not masquerade as 6 completed months',()=>{
 const o=opts();o.source=HUMAN_REGIMENS.find(s=>s.id==='dental-ospamox-child-tid');
 o.context={...context,patientType:'child',age:180,ageUnit:'days',weight:8};assert.equal(resolveDurationGuidance(o).applicable,false);
 o.context.age=186;assert.equal(resolveDurationGuidance(o).applicable,true);
});
test('shelf life and package size never determine duration guidance',()=>{
 const o=opts();o.source=null;o.form.shelfLifeDays=7;o.form.packOptions=[{quantity:100}];assert.equal(resolveDurationGuidance(o).rule,null);
 const a=g();o.source=source;o.form.shelfLifeDays=1;assert.deepEqual(resolveDurationGuidance(o),a);
});
test('explicit existing numerical source duration takes priority over external reference',()=>{
 const o=opts();o.source.minDays=7;o.source.maxDays=10;const r=resolveDurationGuidance(o);
 assert.equal(r.rule.origin,'source');assert.equal(assessDuration(7,r).tone,'within');assert.equal(assessDuration(11,r).tone,'critical');
 assert.equal(assessDuration(3,r).tone,'warning');assert.match(assessDuration(11,r).message,/limit leku/);
});
test('consultation threshold is not painted as an absolute maximum',()=>{
 const o=opts();o.source.maxDays=7;o.source.reviewAfterDays=7;const r=resolveDurationGuidance(o);
 assert.equal(r.rule.hardMaximum,false);assert.equal(assessDuration(10,r).tone,'warning');assert.equal(assessDuration(3,r).tone,'neutral');
});
test('a single lower bound is not enough to paint all longer durations green',()=>{
 const o=opts();o.source.minDays=7;const r=resolveDurationGuidance(o);assert.equal(assessDuration(30,r).tone,'neutral');
});
test('invalid, contradictory or unlinked source ranges fail closed',()=>{
 for(const mutate of [o=>o.source.maxDays=-1,o=>{o.source.minDays=10;o.source.maxDays=3;},o=>{o.source.minDays=3;o.source.sourceUrl='javascript:alert(1)';}]){
  const o=opts();mutate(o);assert.equal(resolveDurationGuidance(o).applicable,false);
 }
});
test('selected 10-day button stays warning, with an independent pressed state',()=>{
 const html=durationGuidanceMarkup({choices:[3,5,7,10],days:10,guidance:g()});
 assert.match(html,/class="duration-choice duration-warning active" data-action="days" data-value="10" aria-pressed="true"/);
 assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);assert.doesNotMatch(html,/\bdisabled\b/);
 assert.match(html,/duration-selected/);assert.match(html,/⚠/);assert.match(html,/W zakresie/);
});
test('UI keeps source disclosure collapsed and separates review from end of treatment',()=>{
 const html=durationGuidanceMarkup({choices:[3,5,7,10],guidance:g()});assert.match(html,/<details class="duration-sources">/);
 assert.match(html,/To nie jest automatyczny koniec kuracji/);assert.match(html,/SDCEP \(Szkocja\)/);
});
test('no-source buttons are neutral including the selected one',()=>{
 const html=durationGuidanceMarkup({choices:[3,5,7,10],days:3,guidance:resolveDurationGuidance({})});
 assert.match(html,/duration-neutral active/);assert.doesNotMatch(html,/duration-within/);
});
test('UI escapes source text, remains numeric and exposes no patient values',()=>{
 const r=g();r.rule.label='<img src=x onerror=alert(1)>';r.rule.note='"<script>x</script>';
 const html=durationGuidanceMarkup({choices:[3,3,-1,NaN,5,'<script>'],days:'<script>',guidance:r});
 assert.doesNotMatch(html,/<script>|<img src=x/);assert.equal((html.match(/data-action="days"/g)||[]).length,2);
});
test('all duration runtime assets are in build, offline cache and identical public mirror',async()=>{
 for(const file of ['duration-guidance.js','duration-view.js','duration.css','app.js','index.html','sw.js','build.mjs']){
  assert.equal(await readFile(new URL(file,import.meta.url),'utf8'),await readFile(new URL('../public/rxcalc/'+file,import.meta.url),'utf8'));
 }
 for(const path of ['build.mjs','sw.js']){
  const t=await readFile(new URL(path,import.meta.url),'utf8');
  for(const file of ['duration-guidance.js','duration-view.js','duration.css'])assert.ok(t.includes(`'${file}'`));
 }
});
