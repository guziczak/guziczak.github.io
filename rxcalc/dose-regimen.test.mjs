import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { ingredientDailyDose } from './daily-dose.js';
import { dailyDoseMarkup } from './dose-safety-view.js';
import { regimenComparisonRows, regimenMeterModel, regimenMeterMarkup } from './dose-regimen.js';
import { resolveHumanRegimen } from './human-regimen-engine.js';
import { calculate } from './engine.js';

const drug=DRUGS.find(d=>d.id==='amoxicillin-clavulanate');
const form=drug.forms.find(f=>f.id==='augmentin-400-57');
const source=HUMAN_REGIMENS.find(s=>s.id==='dental-augmentin-400-57-child');
const input={form:'suspension',patientKind:'human',doseMode:'perKgDay',dose:45,weight:35,frequency:2,
  concentrationMg:400,concentrationMl:5,unitLabel:'ml',packageSize:35,days:null};
const context={formId:form.id,specialty:'dental',patientType:'child',age:5,ageUnit:'years',weight:35,days:1,dose:45,frequency:2};
const sourceCheck=resolveHumanRegimen(source,context);
const preview=(updates={})=>ingredientDailyDose({form,drug,input,source,sourceCheck,...updates});
const valid={valid:true};
const ingredients=[{index:0,name:'Amoksycylina',unit:'mg',amount:400,perMl:5},{index:1,name:'Kwas klawulanowy',unit:'mg',amount:57,perMl:5}];
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('35 kg: both ends of 25–45 are shown, without an invented higher ceiling',()=>{
 const note=preview();const [a,b]=note.schemeRows;
 assert.equal(a.minimum,25);assert.equal(a.maximum,45);assert.equal(a.dailyMin,875);assert.equal(a.dailyMax,1575);
 assert.equal(a.limit,null);assert.equal(b.limit,null);
 assert.equal(a.kind,'range');assert.equal(a.perKg,true);
 const html=dailyDoseMarkup({note,source,input,eligibility:valid});
 assert.ok(html.includes('25–45 mg/kg/dobę'));
 assert.ok(html.includes('875–1575 mg/dobę'));
 assert.equal((html.match(/class="dose-scheme-marker"/g)||[]).length,4);
 assert.ok(!html.includes('class="dose-scheme-wall"'));
 assert.ok(!html.includes('70 mg/kg'));
 assert.ok(html.includes('Nie wyznaczono osobnego maksimum poza schematem'));
});

test('45 is included and close floating-point results do not exceed the source band',()=>{
 const note=preview();
 for(let i=0;i<2;i++)assert.equal(regimenMeterModel(note.rows[i],note.schemeRows[i]).state,'upper');
 assert.equal(regimenMeterModel({...note.rows[0],perKg:45+Number.EPSILON*45},note.schemeRows[0]).state,'upper');
});

test('source bands detect below, inside, boundary and above, including the syringe examples',()=>{
 for(const [dose,state] of [[25,'within'],[35,'within'],[45,'upper'],[46,'above']]) {
  const note=preview({input:{...input,dose}});
  assert.equal(regimenMeterModel(note.rows[0],note.schemeRows[0]).state,state);
 }
 for(const [dose,state] of [[2.5,'below'],[5,'below'],[10,'above']]) {
  const note=preview({input:{...input,doseMode:'units',dose}});
  for(let i=0;i<2;i++)assert.equal(regimenMeterModel(note.rows[i],note.schemeRows[i]).state,state);
 }
});

test('companion range preserves 400:57 precision and is never a separate maximum',()=>{
 const note=preview();const b=note.schemeRows[1];
 approx(b.minimum,3.5625);approx(b.maximum,6.4125);
 approx(b.dailyMin,124.6875);approx(b.dailyMax,224.4375);
 assert.equal(b.derived,true);
 const html=regimenMeterMarkup(note.rows[1],b);
 assert.ok(html.includes('Ilość odpowiadająca schematowi'));
 assert.ok(html.includes('nie jest to niezależne maksimum'));
});

test('lower manual limit is a separate solid line and does not change source endpoints',()=>{
 const note=preview({limit:{daily:1400,kind:'manual'}});
 const s=note.schemeRows[0];
 assert.equal(s.minimum,25);assert.equal(s.maximum,45);assert.equal(s.limit.value,40);assert.equal(s.limit.kind,'manual');
 assert.equal(regimenMeterModel(note.rows[0],s).limitExceeded,true);
 const html=dailyDoseMarkup({note,source,input,eligibility:valid});
 assert.equal((html.match(/class="dose-scheme-wall"/g)||[]).length,2);
 assert.ok(html.includes('Limit wpisany przez lekarza'));
 assert.ok(html.includes('Przekroczony dodatkowy limit'));
 assert.equal(s.dailyMax,1575);
});

test('same-value physician limit is explicitly merged, not drawn at a fabricated position',()=>{
 const note=preview({limit:{daily:1575,kind:'manual'}});
 assert.equal(regimenMeterModel(note.rows[0],note.schemeRows[0]).sharedWall,true);
 assert.ok(regimenMeterMarkup(note.rows[0],note.schemeRows[0]).includes('wspólna kreska'));
});

test('a genuinely separate higher source limit can be displayed, but none is guessed',()=>{
 const changed={...source,maxDailyMgPerKg:60};
 const note=preview({source:changed});
 assert.equal(note.schemeRows[0].maximum,45);
 assert.equal(note.schemeRows[0].limit.value,60);
 assert.equal(preview().schemeRows[0].limit,null);
});

test('missing or ineligible patient data suppress fill and markers, not static source information',()=>{
 const note=preview();
 const html=dailyDoseMarkup({note,source,input,eligibility:{valid:false,errors:['Uzupełnij wiek']}});
 assert.ok(html.includes('25–45 mg/kg/dobę'));
 assert.ok(html.includes('Warunki porównania niepotwierdzone'));
 assert.ok(!html.includes('class="dose-scheme-fill"'));
 assert.ok(!html.includes('class="dose-scheme-marker"'));
 const missing=preview({input:{...input,weight:null}});
 assert.equal(missing.schemeRows[0].dailyMax,null);
 assert.equal(missing.schemeRows[0].maximum,45);
 const manual=preview({input:{...input,weight:null},limit:{daily:800,kind:'manual'}});
 assert.equal(manual.schemeRows[0].limit.daily,800);
 assert.equal(manual.schemeRows[0].limit.value,null);
});

test('missing dose and frequency never become zero progress; duration is irrelevant',()=>{
 for(const field of ['dose','frequency']) {
  const note=preview({input:{...input,[field]:null}});
  const model=regimenMeterModel(note.rows[0],note.schemeRows[0]);
  assert.equal(model.state,'pending');assert.equal(model.fill,null);
 }
 for(const days of ['',null,undefined,1,7])assert.deepEqual(preview({input:{...input,days}}).schemeRows,preview().schemeRows);
});

test('fixed tablet scheme has a single source marker; an override cannot move its boundary',()=>{
 const f=drug.forms.find(f=>f.id==='augmentin-tablet-500-125');
 const s=HUMAN_REGIMENS.find(s=>s.id==='dental-augmentin-tablet-500-125-ge40');
 const i={...input,form:'tablet',doseMode:'fixed',dose:500,frequency:2,strengthMg:500,allowedFractions:[1],unitLabel:'tabl.',concentrationMg:null,concentrationMl:null};
 const note=ingredientDailyDose({form:f,drug,input:i,source:s,sourceCheck:{maxDailyMg:1500}});
 assert.equal(note.schemeRows[0].kind,'fixed');assert.equal(note.schemeRows[0].maximum,1500);
 assert.equal(note.schemeRows[1].maximum,375);assert.equal(note.schemeRows[0].frequency,3);
 assert.equal(note.rows[0].daily,1000);
 assert.equal(regimenMeterModel(note.rows[0],note.schemeRows[0]).state,'below');
 const html=dailyDoseMarkup({note,input:i,source:s,eligibility:valid,modified:true});
 assert.equal((html.match(/class="dose-scheme-marker"/g)||[]).length,2);
 assert.ok(html.includes('Dawka dobowa wybranego schematu'));
});

test('variable frequencies use only an explicit in-source choice',()=>{
 const s={doseMode:'fixed',doseRange:{min:200,max:400},frequencyOptions:[1,2,3],maxDailyMg:1200};
 assert.equal(regimenComparisonRows({source:s,input:{},ingredients}),null);
 assert.equal(regimenComparisonRows({source:s,input:{frequency:8},ingredients}),null);
 const rows=regimenComparisonRows({source:s,input:{frequency:2},ingredients});
 assert.equal(rows[0].minimum,400);assert.equal(rows[0].maximum,800);
 assert.equal(rows[0].limit.value,1200);
});

test('as-needed ranges never imply a compulsory daily minimum and respect the source cap',()=>{
 const s={doseMode:'fixed',doseRange:{min:200,max:400},frequencyOptions:[1,2,3,4,5,6],maxDailyMg:1200,asNeeded:true};
 const rows=regimenComparisonRows({source:s,input:{frequency:6},ingredients});
 assert.equal(rows[0].minimum,0);assert.equal(rows[0].maximum,1200);assert.equal(rows[0].kind,'asNeeded');
 assert.equal(rows[0].limit,null);
});

test('unit-based activities retain IU instead of mg',()=>{
 const s={doseMode:'units',doseRange:{min:1,max:2},frequency:4,maxDailyUnits:10};
 const rows=regimenComparisonRows({source:s,input:{},ingredients:[{index:0,name:'Nystatyna',unit:'j.m.',amount:100000,perMl:1}]});
 assert.equal(rows[0].minimum,400000);assert.equal(rows[0].maximum,800000);assert.equal(rows[0].limit.value,1000000);
});

test('no source and veterinary workflows retain their old presentation',()=>{
 assert.equal(preview({source:null}).schemeRows,null);
 assert.equal(preview({input:{...input,patientKind:'animal'}}).schemeRows,null);
});

test('invalid source metadata does not invent a band',()=>{
 for(const patch of [{doseRange:{min:45,max:25}},{doseRange:{min:0,max:45}},{doseRange:{min:25,max:Infinity}},{frequency:0},{doseMode:'instruction'}]) {
  assert.equal(regimenComparisonRows({source:{...source,...patch},input,ingredients}),null);
 }
});

test('clipped values keep full arithmetic and scale markers do not follow the dose',()=>{
 const small=preview({input:{...input,dose:25}});const big=preview({input:{...input,dose:100}});
 const a=regimenMeterModel(small.rows[0],small.schemeRows[0]);const b=regimenMeterModel(big.rows[0],big.schemeRows[0]);
 assert.equal(a.scale,b.scale);assert.equal(a.start,b.start);assert.equal(a.end,b.end);assert.equal(b.fill,100);assert.equal(b.clipped,true);
 assert.equal(big.rows[0].daily,3500);
});

test('markup escapes names and units and never mutates inputs',()=>{
 const note=preview();const row={...note.rows[0],name:'<img onerror=x>',unit:'<script>'};const s=note.schemeRows[0];
 const before=structuredClone({row,s});const html=regimenMeterMarkup(row,s);
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;script&gt;'));
 assert.deepEqual({row,s},before);
});

test('display metadata leaves engine outputs and all clinical thresholds unchanged',()=>{
 const before=structuredClone({source,input,sourceCheck,form});
 const result=calculate({...input,days:7});preview();
 assert.deepEqual({source,input,sourceCheck,form},before);
 assert.deepEqual(calculate({...input,days:7}),result);
 assert.equal(source.maxDailyMgPerKg,45);
});

test('new module is built, cached and mirrored with the runtime',async()=>{
 for(const name of ['build.mjs','sw.js'])assert.ok((await readFile(new URL(name,import.meta.url),'utf8')).includes("'dose-regimen.js'"));
 for(const name of ['dose-regimen.js','daily-dose.js','dose-safety-view.js','dose-safety.css','sw.js','build.mjs'])assert.equal(await readFile(new URL(name,import.meta.url),'utf8'),await readFile(new URL(`../public/rxcalc/${name}`,import.meta.url),'utf8'));
});
