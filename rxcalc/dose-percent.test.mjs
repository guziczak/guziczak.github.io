import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DRUGS} from './catalogue.js';
import {HUMAN_REGIMENS} from './human-regimens.js';
import {ingredientDailyDose} from './daily-dose.js';
import {dailyDoseMarkup} from './dose-safety-view.js';
import {regimenPercentModel,formatRegimenPercent,regimenDosePercentMarkup,regimenMeterMarkup,regimenMeterModel} from './dose-regimen.js';
import {calculate} from './engine.js';
const drug=DRUGS.find(d=>d.id==='amoxicillin-clavulanate');
const form=drug.forms.find(f=>f.id==='augmentin-400-57');
const source=HUMAN_REGIMENS.find(s=>s.id==='dental-augmentin-400-57-child');
const input={form:'suspension',patientKind:'human',doseMode:'perKgDay',dose:40,weight:20,frequency:2,concentrationMg:400,concentrationMl:5,unitLabel:'ml',packageSize:35,days:null};
const preview=(updates={})=>ingredientDailyDose({form,drug,source,input,sourceCheck:{maxDailyMg:900,maxDailyMgPerKg:45},...updates});
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const render=note=>dailyDoseMarkup({note,input,source,eligibility:{valid:true}});

test('screenshot case: 800 and 114 mg/day each show 88.9% of their own source upper endpoint',()=>{
 const note=preview();assert.equal(note.rows[0].daily,800);assert.equal(note.rows[1].daily,114);
 for(let i=0;i<2;i++){
  const p=regimenPercentModel(note.rows[i],note.schemeRows[i]);
  approx(p.current,40/45*100);approx(p.start,25/45*100);assert.equal(p.end,100);assert.equal(p.scale,125);assert.equal(p.limit,null);
 }
 const html=render(note);assert.equal((html.match(/<b>88,9%<\/b>/g)||[]).length,2);
 assert.match(html,/55,6%/);assert.match(html,/Koniec skali · nie limit/);
});
test('100% always names the source endpoint and is not completion of the track',()=>{
 const note=preview({input:{...input,dose:45}});const m=regimenMeterModel(note.rows[0],note.schemeRows[0]);
 assert.equal(m.fill,80);assert.equal(regimenPercentModel(note.rows[0],note.schemeRows[0]).current,100);
 assert.match(render(note),/górnej granicy schematu/);assert.match(render(note),/100% jest odniesieniem do górnej granicy schematu/);
});
test('an out-of-scale dose retains its full percentage instead of clamping to 125',()=>{
 const note=preview({input:{...input,dose:90}});const p=regimenPercentModel(note.rows[0],note.schemeRows[0]);
 assert.equal(p.current,200);assert.equal(p.scale,125);
 assert.equal(regimenMeterModel(note.rows[0],note.schemeRows[0]).fill,100);
 assert.match(render(note),/200%/);assert.match(render(note),/dose-scheme-overflow/);
});
test('a lower physician limit has its own percentage and cannot renormalize the source range',()=>{
 const note=preview({limit:{daily:700,kind:'manual'}});const p=regimenPercentModel(note.rows[0],note.schemeRows[0]);
 approx(p.limit,700/900*100);approx(p.current,800/900*100);assert.equal(p.end,100);
 assert.match(render(note),/77,8% górnej granicy schematu/);assert.match(render(note),/Przekroczony dodatkowy limit/);
});
test('a higher documented limit expands the displayed scale with a truthful percentage',()=>{
 const note=preview();const s={...note.schemeRows[0],limit:{value:60,daily:1200,kind:'source'}};
 const p=regimenPercentModel(note.rows[0],s);approx(p.limit,133.3333333333333);approx(p.scale,166.6666666666667);
 assert.equal(p.end,100);approx(p.current,88.8888888888889);
 const html=regimenMeterMarkup(note.rows[0],s);assert.match(html,/133,3%/);assert.match(html,/166,7%/);
});
test('same-value manual limit stays at 100 with its shared-line description',()=>{
 const note=preview({limit:{daily:900,kind:'manual'}});assert.equal(regimenPercentModel(note.rows[0],note.schemeRows[0]).limit,100);
 assert.match(render(note),/wspólna kreska/);
});
test('pending quantity never turns into a displayed 0% current dose',()=>{
 for(const field of ['dose','frequency']){
  const note=preview({input:{...input,[field]:null}});const p=regimenPercentModel(note.rows[0],note.schemeRows[0]);
  assert.equal(p.current,null);assert.equal(p.scale,125);
  assert.equal(regimenDosePercentMarkup(note.rows[0],note.schemeRows[0]),'');
 }
});
test('unconfirmed patient conditions retain neutral arithmetic without changing the underlying allowed gate',()=>{
 const note=preview();assert.equal(regimenPercentModel(note.rows[0],note.schemeRows[0],false),null);
 const html=dailyDoseMarkup({note,input,source,eligibility:{valid:false,errors:['Sprawdź wiek']}});
 assert.match(html,/dose-scheme-current within neutral/);assert.match(html,/dose-scheme-ticks/);assert.match(html,/dose-scheme-percent-axis/);
 assert.match(html,/88,9%/);assert.match(html,/Sprawdź dane pacjenta/);
 assert.doesNotMatch(html,/Dobowo w zakresie wybranego schematu/);
});
test('an absolute manual limit without weight is not placed on a per-kg percentage scale',()=>{
 const note=preview({input:{...input,weight:null},sourceCheck:{maxDailyMgPerKg:45},limit:{daily:800,kind:'manual'}});
 assert.equal(regimenPercentModel(note.rows[0],note.schemeRows[0]).limit,null);
 assert.match(regimenMeterMarkup(note.rows[0],note.schemeRows[0]),/800 mg\/dobę/);
});
test('fixed-dose sources label 100% as the dose of that source, not a fictional range',()=>{
 const note=preview();const s={...note.schemeRows[0],minimum:45,maximum:45,kind:'fixed'};
 assert.match(regimenDosePercentMarkup(note.rows[0],s),/dawki dobowej schematu/);
 const html=regimenMeterMarkup(note.rows[0],s);assert.ok(!html.includes('Początek zakresu'));assert.match(html,/Dawka schematu/);
});
test('as-needed source shows a ceiling, not a compulsory minimum',()=>{
 const note=preview();const s={...note.schemeRows[0],minimum:0,kind:'asNeeded'};
 assert.equal(regimenPercentModel(note.rows[0],s).start,0);
 assert.match(regimenDosePercentMarkup(note.rows[0],s),/pułapu dobowego schematu/);
 assert.ok(!regimenMeterMarkup(note.rows[0],s).includes('Początek zakresu'));
});
test('rounding never presents a genuine slight overshoot or undershoot as exactly 100%',()=>{
 assert.equal(formatRegimenPercent(100), '100');assert.equal(formatRegimenPercent(99.999),' >99,9'.trim());
 assert.equal(formatRegimenPercent(100.001),'>100');assert.equal(formatRegimenPercent(.0001),'<0,1');
 assert.equal(formatRegimenPercent(0),'0');assert.equal(formatRegimenPercent(88.88888),'88,9');
 for(const value of [null,undefined,NaN,Infinity,-1,'100'])assert.equal(formatRegimenPercent(value),'—');
});
test('very narrow source ranges share an annotation rather than overlapping labels',()=>{
 const note=preview();const s={...note.schemeRows[0],minimum:44.99};
 const html=regimenMeterMarkup(note.rows[0],s);
 assert.equal((html.match(/class="dose-scheme-tick"/g)||[]).length,1);assert.match(html,/Zakres schematu/);
});
test('duration does not affect percentages or patient data',()=>{
 const baseline=preview();for(const days of ['',null,1,7]){
  const note=preview({input:{...input,days}});
  assert.deepEqual(regimenPercentModel(note.rows[0],note.schemeRows[0]),regimenPercentModel(baseline.rows[0],baseline.schemeRows[0]));
 }
});
test('presentation escapes data, does not mutate or change arithmetic, and preserves derived explanation',()=>{
 const note=preview();const before=structuredClone(note);const result=calculate({...input,days:7});render(note);
 assert.deepEqual(note,before);assert.deepEqual(calculate({...input,days:7}),result);
 const html=regimenMeterMarkup({...note.rows[0],name:'<img onerror=x>',unit:'<script>'},note.schemeRows[0]);
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.match(render(note),/nie jest to niezależne maksimum/);
});
test('percent runtime files are identical in both hosted copies and cache is bumped',async()=>{
 for(const name of ['dose-regimen.js','dose-safety-view.js','dose-safety.css','sw.js'])
  assert.equal(await readFile(new URL(name,import.meta.url),'utf8'),await readFile(new URL(`../public/rxcalc/${name}`,import.meta.url),'utf8'));
 assert.match(await readFile(new URL('sw.js',import.meta.url),'utf8'),/2026-11-22\.85/);
});
