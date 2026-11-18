import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DRUGS} from './catalogue.js';
import {LIQUID_STARTER_REGIMENS} from './liquid-starters.js';
import {HUMAN_REGIMENS} from './human-regimens.js';
import {assessDoseRounding,createRoundingReview,resolveRoundingRegimen,roundingValidationSource,roundingAuditText,hasScopedRoundingEvidence} from './rounding-assessment.js';
import {roundingReviewMarkup} from './rounding-review-view.js';
import {liquidDoseChoices,liquidDoseChoicesMarkup} from './liquid-doses.js';
import {ingredientDailyDose} from './daily-dose.js';
import {dailyDoseMarkup} from './dose-safety-view.js';
import {calculate} from './engine.js';

const drug=DRUGS.find(d=>d.id==='amoxicillin-clavulanate');
const form=drug.forms.find(f=>f.id==='augmentin-400-57');
const source=LIQUID_STARTER_REGIMENS[0];
const base={form,source,context:{patientKind:'human',formId:form.id,specialty:'dental',patientType:'adult',doseMode:'fixed',dose:880,frequency:2,days:7,weight:70,age:35,ageUnit:'years',renalStatus:'unknown',crcl:null,roundingStep:null},limits:{daily:null,single:null}};
const attest={reason:'Ocena indywidualna — wyłącznie przypadek testowy.',scopeConfirmed:true,measurementConfirmed:true};
const withContext=diff=>({...base,context:{...base.context,...diff}});
const approved=()=>({...base,review:createRoundingReview(base,attest)});
const input={patientKind:'human',form:'suspension',doseMode:'fixed',dose:880,frequency:2,weight:70,days:7,concentrationMg:400,concentrationMl:5,unitLabel:'ml',packageSize:35};

test('exact conversion is pending individual review, not an automatically approved rule',()=>{
 const a=assessDoseRounding(base);assert.equal(a.state,'needs-review');assert.equal(a.severity,'warning');assert.equal(a.clinicallyValidated,false);
 const r=resolveRoundingRegimen(base);assert.equal(r.valid,false);assert.ok(r.errors.some(x=>x.includes('indywidualnej oceny')));
 assert.equal(r.maxSingleMg,null);assert.equal(r.maxDailyMg,null);assert.equal(source.maxSingleMg,875);assert.equal(source.maxDailyMg,1750);
});
test('complete exact case can be individually reviewed with rationale and both confirmations',()=>{
 const options=approved();assert.ok(Object.isFrozen(options.review));
 const a=assessDoseRounding(options),r=resolveRoundingRegimen(options);
 assert.equal(a.state,'reviewed');assert.equal(a.clinicallyValidated,false);assert.equal(r.valid,true);assert.equal(r.dose,880);assert.equal(r.frequency,2);
 assert.ok(r.warnings.some(x=>x.includes('Indywidualnie')));
 assert.ok(roundingAuditText(a).includes('875 mg (10,9375 ml) → 880 mg (11 ml)'));
});
test('875 mg nominal input rounded to exactly 11 ml enters the same individual-review gate',()=>{
 const o=withContext({dose:875,roundingStep:1}),before=JSON.stringify(o);
 const a=assessDoseRounding(o),pending=resolveRoundingRegimen(o);
 const actual=calculate({...input,dose:875,roundingStep:1});
 assert.equal(actual.singleUnits,11);assert.equal(actual.singleMg,880);assert.equal(actual.dailyMg,1760);
 assert.equal(a.state,'needs-review');assert.equal(a.severity,'warning');assert.equal(a.clinicallyValidated,false);
 assert.equal(a.ml,actual.singleUnits);assert.equal(a.singleMg,actual.singleMg);assert.equal(a.dailyMg,actual.dailyMg);
 assert.equal(pending.valid,false);assert.ok(pending.errors.some(x=>x.includes('indywidualnej oceny')));
 assert.equal(pending.maxSingleMg,null);assert.equal(pending.maxDailyMg,null);
 const review=createRoundingReview(o,attest);assert.ok(review);
 const reviewed=resolveRoundingRegimen({...o,review});
 assert.equal(reviewed.valid,true);assert.equal(reviewed.rounding.state,'reviewed');
 assert.equal(reviewed.dose,875,'Review must preserve the nominal source dose');
 assert.equal(o.context.roundingStep,1);assert.equal(JSON.stringify(o),before);
 assert.equal(source.dose,875);assert.equal(source.maxSingleMg,875);assert.equal(source.maxDailyMg,1750);
});
test('nominal-dose rounding still needs a reason, both attestations and complete context',()=>{
 const o=withContext({dose:875,roundingStep:1});
 for(const a of [{},{...attest,scopeConfirmed:false},{...attest,measurementConfirmed:false},
  {...attest,reason:''},{...attest,reason:'krótko'}])assert.equal(createRoundingReview(o,a),null);
 const incomplete={...o,context:{...o.context,days:null}};
 assert.equal(assessDoseRounding(incomplete).state,'needs-review');
 assert.equal(createRoundingReview(incomplete,attest),null);
 assert.equal(resolveRoundingRegimen(incomplete,{allowNumericOverrides:true,previewDuration:true}).valid,false);
});
test('nominal dose and rounding step remain part of review proof even for the same actual 11 ml',()=>{
 const o=withContext({dose:875,roundingStep:1}),review=createRoundingReview(o,attest);
 assert.equal(assessDoseRounding({...o,review}).state,'reviewed');
 for(const diff of [{roundingStep:.5},{dose:880},{dose:880,roundingStep:null}]) {
  const changed={...o,context:{...o.context,...diff},review};
  const a=assessDoseRounding(changed);
  assert.equal(a.state,'needs-review',JSON.stringify(diff));assert.notEqual(a.key,review.key);
  assert.equal(resolveRoundingRegimen(changed).valid,false);
 }
 const legacy=approved();
 assert.equal(assessDoseRounding({...o,review:legacy.review}).state,'needs-review');
 assert.equal(assessDoseRounding(legacy).state,'reviewed');
});
test('decimal rounding only admits the exact 875-to-880 conversion, without a general tolerance',()=>{
 const o=withContext({dose:875,roundingStep:1}),review=createRoundingReview(o,attest);
 for(const roundingStep of [null,.1,.01,.001,0,-1,NaN]) {
  const changed={...o,context:{...o.context,roundingStep},review};
  assert.equal(assessDoseRounding(changed),null,String(roundingStep));
 }
 const hundredths=calculate({...input,dose:875,roundingStep:.01});
 assert.equal(hundredths.singleUnits,10.94);assert.equal(hundredths.singleMg,875.2);
 const ordinary=resolveRoundingRegimen(withContext({dose:875,roundingStep:.01}));
 assert.equal(ordinary.rounding,undefined);assert.equal(ordinary.maxSingleMg,875);assert.equal(ordinary.maxDailyMg,1750);
 assert.equal(calculate({...input,dose:875,roundingStep:.01,
  maxSingleMg:ordinary.maxSingleMg,maxDailyMg:ordinary.maxDailyMg}).valid,false);
 for(const dose of [874,876,879,885])assert.equal(assessDoseRounding(withContext({dose,roundingStep:1})),null,String(dose));
 for(const diff of [{id:'other'},{roundingConstraintKind:'hard-limit'},{doseRange:{min:800,max:900}}])
  assert.equal(assessDoseRounding({...o,source:{...source,...diff}}),null);
});
test('all independent and patient limits remain active for nominal 875 mg rounded to 11 ml',()=>{
 const o=withContext({dose:875,roundingStep:1});
 for(const limits of [{single:875},{daily:1750},{ingredients:[{index:1,single:125}]},
  {ingredients:[{index:1,daily:250}]},{single:0},{daily:NaN}]) {
  const limited={...o,limits};assert.equal(assessDoseRounding(limited).state,'blocked');
  assert.equal(createRoundingReview(limited,attest),null);assert.equal(resolveRoundingRegimen(limited).valid,false);
 }
 for(const diff of [{maxSingleMg:875},{maxDailyMg:1750}]) {
  const limited={...o,form:{...form,...diff}};assert.equal(assessDoseRounding(limited).state,'blocked');
  assert.equal(createRoundingReview(limited,attest),null);
 }
 for(const diff of [{weight:39},{age:12},{renalStatus:'impaired'},{crcl:20}]) {
  const limited={...o,context:{...o.context,...diff}};
  assert.equal(assessDoseRounding(limited).state,'blocked');assert.equal(createRoundingReview(limited,attest),null);
 }
});
test('875 mg rounded-dose tile, actual ingredient totals and export review use one assessment',()=>{
 const pending=withContext({dose:875,roundingStep:1});
 for(const o of [pending,{...pending,review:createRoundingReview(pending,attest)}]) {
  const a=assessDoseRounding(o),resolved=resolveRoundingRegimen(o);
  const choices=liquidDoseChoices(form,{source,doseMode:'fixed',weight:70,frequency:2,
   eligibility:{valid:true},view:'dose',roundDoseChoices:true,roundingStep:1,roundingContext:o,page:0});
  const c=choices.find(c=>c.value===875);assert.ok(c);
  assert.equal(c.ml,10.9375);assert.equal(c.roundedDose.ml,11);assert.equal(c.roundedDose.mg,880);
  assert.equal(c.roundingAssessment.state,a.state);assert.equal(c.severity,a.severity);
  assert.ok(!c.warnings.some(w=>w.code==='single-limit'||w.code==='daily-limit'));
  const actualInput={...input,dose:875,roundingStep:1};
  const note=ingredientDailyDose({form,drug,input:actualInput,
   source:roundingValidationSource(source,a),sourceCheck:resolved});
  assert.equal(note.rows[0].daily,1760);assert.ok(Math.abs(note.rows[1].daily-250.8)<1e-9);
  assert.equal(note.schemeRows[0].maximum,1750);assert.equal(note.schemeRows[0].limit,null);
  assert.equal(resolved.valid,Boolean(o.review));
 }
});
test('no empty, implicit, partial or overly long professional acknowledgement',()=>{
 for(const a of [{},{...attest,scopeConfirmed:false},{...attest,measurementConfirmed:false},{...attest,reason:'krótko'},{...attest,reason:' '.repeat(20)},{...attest,reason:'a'.repeat(501)}])assert.equal(createRoundingReview(base,a),null);
 for(const days of [null,0,1.5,Infinity])assert.equal(createRoundingReview(withContext({days}),attest),null);
});
test('preview works without duration but never unlocks export',()=>{
 const o=withContext({days:null});assert.equal(assessDoseRounding(o).state,'needs-review');
 assert.equal(resolveRoundingRegimen(o).valid,false);assert.equal(resolveRoundingRegimen(o,{allowNumericOverrides:true,previewDuration:true}).valid,false);
});
test('review survives preview calculation without replacing its context fingerprint',()=>{
 const r=resolveRoundingRegimen(approved(),{allowNumericOverrides:true,previewDuration:true});assert.equal(r.rounding.state,'reviewed');assert.equal(r.valid,true);
});
test('all significant changes revoke review; no accumulation of rounding',()=>{
 const o=approved();
 for(const [k,v] of Object.entries({weight:71,age:36,days:8,crcl:80,renalStatus:'normal',roundingStep:.1})) {
  const a=assessDoseRounding({...o,context:{...o.context,[k]:v}});assert.notEqual(a?.state,'reviewed',k);
 }
 for(const dose of [872,875,880.1,885,1000,1600])assert.equal(assessDoseRounding({...o,context:{...o.context,dose}}),null);
 for(const frequency of [1,3,4])assert.equal(assessDoseRounding({...o,context:{...o.context,frequency}}),null);
});
test('wrong context, patient, formulation or source cannot inherit review',()=>{
 for(const context of [{patientType:'child'},{patientKind:'animal'},{formId:'other'},{specialty:'cardio'},{doseMode:'perKgDay'}])assert.equal(assessDoseRounding(withContext(context)),null);
 for(const diff of [{id:'other'},{dose:874},{frequency:3},{roundingConstraintKind:'hard-limit'},{maxSingleMg:870},{maxDailyMg:1700},{maxDailyMgPerKg:25},{doseRange:{min:800,max:900}}])assert.equal(assessDoseRounding({...base,source:{...source,...diff}}),null);
 for(const diff of [{routeCode:'iv'},{routeLabel:'dożylnie'},{concentrationMg:200},{ingredients:[form.ingredients[0],{amountMg:60,perMl:5}]}])assert.equal(assessDoseRounding({...base,form:{...form,...diff}}),null);
});
test('missing mass, implausible age and renal constraints cannot be waived',()=>{
 for(const ctx of [{weight:null},{weight:39},{weight:501},{age:12},{age:170},{age:NaN},{renalStatus:'impaired'},{crcl:30},{crcl:20},{crcl:-1}]){
  const o=withContext(ctx);assert.equal(assessDoseRounding(o).state,'blocked',JSON.stringify(ctx));assert.equal(createRoundingReview(o,attest),null);assert.equal(resolveRoundingRegimen(o).valid,false);
 }
});
test('independent limits are preserved, including a manual limit equal to original target',()=>{
 for(const limits of [{single:875},{daily:1750},{daily:1500},{single:0},{daily:NaN},{ingredients:[{index:1,daily:250}]},{ingredients:[{index:1,single:125}]}]){
  const o={...base,limits};assert.equal(assessDoseRounding(o).state,'blocked');assert.equal(createRoundingReview(o,attest),null);assert.equal(resolveRoundingRegimen(o).valid,false);
 }
 const o={...base,limits:{single:900,daily:1800}};assert.equal(assessDoseRounding(o).state,'needs-review');assert.ok(createRoundingReview(o,attest));
});
test('catalogue hard ceilings and changed grid are not bypassed',()=>{
 for(const diff of [{maxDailyMg:1700},{maxSingleMg:850}]){const o={...base,form:{...form,...diff}};assert.equal(assessDoseRounding(o).state,'blocked');assert.equal(createRoundingReview(o,attest),null);}
 for(const roundingStep of [.3,0,-1,NaN])assert.equal(assessDoseRounding(withContext({roundingStep})).state,'blocked');
 assert.equal(assessDoseRounding(withContext({roundingStep:.1})).state,'needs-review');
});
test('normal source values and other regimens retain original resolver behaviour',()=>{
 const r=resolveRoundingRegimen(withContext({dose:875}));assert.equal(r.valid,true);assert.equal(r.rounding,undefined);assert.equal(r.maxDailyMg,1750);
 const child=HUMAN_REGIMENS.find(r=>r.id==='dental-augmentin-400-57-child');
 const o={...base,source:child,context:{...base.context,patientType:'child',age:5,weight:35,doseMode:'perKgDay',dose:45}};
 assert.equal(assessDoseRounding(o),null);assert.equal(resolveRoundingRegimen(o).valid,true);
 assert.equal(resolveRoundingRegimen({...o,context:{...o.context,dose:46}}).valid,false);
});
test('arithmetic, both ingredients and original percentages remain exact',()=>{
 const a=assessDoseRounding(approved());const r=calculate(input);assert.equal(r.singleUnits,11);assert.equal(r.dailyMg,1760);assert.equal(r.totalUnits,154);
 const o=approved(),check=resolveRoundingRegimen(o),note=ingredientDailyDose({form,drug,input,source:roundingValidationSource(source,a),sourceCheck:check});
 assert.equal(note.rows[0].daily,1760);assert.ok(Math.abs(note.rows[1].daily-250.8)<1e-9);
 assert.equal(note.schemeRows[0].maximum,1750);assert.equal(note.schemeRows[0].limit,null);
 const html=dailyDoseMarkup({note,input,source,eligibility:{valid:true},roundingAssessment:a,modified:true});
 assert.ok(html.includes('100,6%'));assert.ok(html.includes('Zaokrąglenie ocenione indywidualnie'));assert.ok(!html.includes('Przekroczony dodatkowy limit'));
 assert.match(html,/dose-scheme-meter[^>]*reviewed/);
});
test('tile, bars and export gate agree on needs-review and reviewed states',()=>{
 for(const o of [base,approved()]){
  const choices=liquidDoseChoices(form,{source,doseMode:'fixed',weight:70,frequency:2,eligibility:{valid:true},roundingContext:o});
  const c=choices.find(c=>c.ml===11);assert.equal(c.roundingAssessment.state,assessDoseRounding(o).state);assert.equal(c.severity,assessDoseRounding(o).severity);
  const html=liquidDoseChoicesMarkup(choices,{dose:880});assert.ok(html.includes(c.reason));assert.ok(!c.warnings.some(w=>w.code==='daily-limit'));
  assert.equal(resolveRoundingRegimen(o).valid,o.review!=null);
 }
});
test('previewing a tile cannot reuse review from another actual dose or lower limit',()=>{
 const o=approved();const choices=liquidDoseChoices(form,{source,doseMode:'fixed',weight:70,frequency:2,eligibility:{valid:true},roundingContext:{...o,limits:{daily:1750}}});
 assert.equal(choices.find(c=>c.ml===11).severity,'critical');
});
test('acknowledgement panel clearly distinguishes evidence, local decision and verification',()=>{
 const pending=roundingReviewMarkup(assessDoseRounding(base),{complete:true});
 for(const text of ['Nie jest to automatycznie zatwierdzona','HSE','2020','Uzasadnienie','rounding-review-scope','rounding-review-measurement'])assert.ok(pending.includes(text));
 const done=roundingReviewMarkup(assessDoseRounding(approved()));assert.ok(done.includes('To nie jest walidacja kliniczna reguły'));assert.ok(done.includes('Cofnij ocenę'));
});
test('review text is escaped in HTML and not executed',()=>{
 const reason='<img src=x onerror=alert(1)> indywidualna ocena';const review=createRoundingReview(base,{...attest,reason});
 const html=roundingReviewMarkup(assessDoseRounding({...base,review}));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));
});
test('unknown or stale proof is never accepted, inputs and sources never mutate',()=>{
 const o=structuredClone(base),before=JSON.stringify(o);assessDoseRounding(o);createRoundingReview(o,attest);resolveRoundingRegimen(o);assert.equal(JSON.stringify(o),before);
 for(const review of [{approved:true},{...approved().review,key:'stale'},{...approved().review,revision:'other'},{...approved().review,scopeConfirmed:false}])assert.equal(assessDoseRounding({...base,review}).state,'needs-review');
});
test('all runtime changes mirrored and rounding modules shipped offline',async()=>{
 for(const f of ['rounding-assessment.js','rounding-review-view.js','app.js','liquid-starters.js','liquid-doses.js','dose-regimen.js','dose-safety-view.js','dose-safety.css','liquid-doses.css','sw.js','build.mjs'])assert.equal(await readFile(new URL(f,import.meta.url),'utf8'),await readFile(new URL('../public/rxcalc/'+f,import.meta.url),'utf8'));
 for(const f of ['sw.js','build.mjs'])for(const m of ['rounding-assessment.js','rounding-review-view.js'])assert.ok((await readFile(new URL(f,import.meta.url),'utf8')).includes(m));
 const app=await readFile(new URL('app.js',import.meta.url),'utf8');assert.ok(app.includes('state.confirmed=false;roundingReview=null'));assert.ok(!app.includes("savePreference('rounding"));
});
