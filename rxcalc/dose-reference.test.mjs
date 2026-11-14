import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculate } from './engine.js';
import { DRUGS } from './catalogue.js';
import { ingredientDailyDose } from './daily-dose.js';
import { dailyDoseMarkup } from './dose-safety-view.js';
import { AUGMENTIN_TABLET_REFERENCES, adultAugmentinReference, referenceMeterModel, referenceMeterMarkup } from './dose-reference.js';
const drug=DRUGS.find(d=>d.id==='amoxicillin-clavulanate');
const form=drug.forms.find(f=>f.id==='augmentin-400-57');
const input={patientKind:'human',form:'suspension',doseMode:'fixed',dose:500,frequency:2,days:null,
  weight:null,age:null,concentrationMg:400,concentrationMl:5,unitLabel:'ml',roundingStep:.1,packageSize:35};
const referenceContext={formId:form.id,patientType:'adult'};
const ref=(changes={})=>adultAugmentinReference({...referenceContext,input,...changes});
const report=(current=input,changes={})=>ingredientDailyDose({form,drug,input:current,...changes});
const render=(current=input,changes={})=>dailyDoseMarkup({note:report(current),input:current,referenceContext,...changes});

test('references preserve the two literal paired daily totals from the tablet source',()=>{
  assert.deepEqual(AUGMENTIN_TABLET_REFERENCES.rows.amoksycylina,{a:1750,b:2625});
  assert.deepEqual(AUGMENTIN_TABLET_REFERENCES.rows['kwas klawulanowy'],{a:250,b:375});
  assert.match(AUGMENTIN_TABLET_REFERENCES.sourceUrl,/7496\/characteristic$/);
  assert.match(AUGMENTIN_TABLET_REFERENCES.productSourceUrl,/8695\/characteristic$/);
  assert.equal(AUGMENTIN_TABLET_REFERENCES.checkedAt,'2026-11-14');
});

test('the actual adult screenshot produces both filled reference bars without duration or weight',()=>{
  const note=report();
  assert.equal(note.rows[0].daily,1008);assert.equal(note.rows[1].daily,143.64);
  const html=render();
  assert.equal((html.match(/class="dose-reference-meter /g)||[]).length,2);
  assert.equal((html.match(/class="dose-reference-fill"/g)||[]).length,2);
  for(const text of ['1750','2625','250','375','Masa niepodana','Porównanie · nie limit pacjenta','57,6% A','38,4% B'])assert.ok(html.includes(text));
  assert.ok(!html.includes('Brak zweryfikowanego limitu'));
  assert.ok(!html.includes('dose-safety-wall'));
  assert.equal(note.ceilingKind,null);assert.equal(note.exceeded,false);
  assert.ok(note.rows.every(r=>r.ceiling===null&&r.ceilingPerKg===null));
});

test('only the exact human formulation and explicit adult context receive the fallback',()=>{
  assert.equal(ref({formId:'augmentin-tablet-875-125'}),null);
  assert.equal(ref({formId:'augmentin-tablet-500-125'}),null);
  assert.equal(ref({formId:'ospamox-250'}),null);
  assert.equal(ref({input:{...input,patientKind:'animal'}}),null);
  assert.equal(ref({patientType:undefined}),null);
  assert.equal(ref({source:{id:'selected'}}),null);
  assert.equal(ref({patientType:'child'}),null);
  assert.equal(ref({patientType:'child',input:{...input,weight:39.999}}),null);
  assert.ok(ref({patientType:'child',input:{...input,weight:40}}));
});

test('source or physician limits retain the original solid limit bar instead of reference fallback',()=>{
  const note=report(input,{limit:{daily:800,kind:'manual'}});
  const html=render(input,{note});
  assert.ok(html.includes('dose-safety-wall'));
  assert.ok(html.includes('Limit wpisany przez lekarza'));
  assert.ok(html.includes('Przekroczenie'));
  assert.ok(!html.includes('dose-reference-meter'));
  const sourceHtml=render(input,{source:{label:'Wybrany',phaseLabel:'Schemat'},eligibility:{valid:true}});
  assert.ok(!sourceHtml.includes('dose-reference-meter'));
});

test('an unknown adult weight is disclosed while a known out-of-range or invalid weight disables comparison',()=>{
  assert.equal(ref().compare,true);
  assert.ok(ref().warnings.some(w=>w.includes('Masa niepodana')));
  assert.equal(ref({input:{...input,weight:70}}).warnings.length,0);
  for(const weight of [39.9,0,-1,NaN,Infinity,501,'70']) {
    const value=ref({input:{...input,weight}});
    assert.equal(value.compare,false);
    const meter=referenceMeterModel(report().rows[0],value);
    assert.equal(meter.state,'unconfirmed');assert.equal(meter.fill,null);assert.equal(meter.ratioA,null);
  }
});

test('known renal concerns are not treated as an approved reference regimen',()=>{
  for(const changes of [{renalStatus:'impaired'},{crcl:30},{crcl:29},{crcl:0},{crcl:NaN}]) {
    const value=ref(changes);
    assert.equal(value.compare,false);
    assert.ok(value.warnings.some(w=>w.includes('nerkowe')));
  }
  assert.equal(ref({crcl:31}).compare,true);
  assert.equal(ref({crcl:null}).compare,true);
});

test('markers remain fixed at A and B while the amount changes or exceeds the visible scale',()=>{
  const row=report().rows[0];
  for(const daily of [1,1008,1750,2608,2625,3000,6000]) {
    const m=referenceMeterModel({...row,daily},ref());
    assert.equal(m.markerA,1750/2625*80);assert.equal(m.markerB,80);
    assert.equal(m.ratioA,daily/1750);assert.equal(m.ratioB,daily/2625);
    assert.ok(m.fill<=100);assert.equal(m.clipped,daily>3281.25);
  }
  const m=referenceMeterModel({...row,daily:6000},ref());
  assert.equal(m.state,'above-b');assert.ok(m.ratioB>2);
  const html=referenceMeterMarkup({...row,daily:6000},ref());
  assert.ok(html.includes('228,57% B'));assert.ok(html.includes('dose-reference-overflow'));
  assert.ok(html.includes('Powyżej odniesienia B'));assert.ok(!html.includes('Przekroczona dawka maksymalna'));
});

test('missing amounts keep reference markers without zero fill or an invented percentage',()=>{
  for(const changes of [{dose:null},{dose:0},{frequency:null},{doseMode:'perKgDay',weight:null}]) {
    const current={...input,...changes};const note=report(current);
    for(const row of note.rows) {
      const m=referenceMeterModel(row,ref({input:current}));
      assert.equal(m.state,'pending');assert.equal(m.fill,null);assert.equal(m.ratioA,null);
    }
    const html=render(current);
    assert.ok(html.includes('dose-reference-marker'));assert.ok(!html.includes('class="dose-reference-fill"'));
    assert.ok(!html.includes('0% A'));
  }
});

test('all dose modes and durations use the existing actual rounded amounts, not tablet proportions',()=>{
  for(const days of [null,'',7])for(const [doseMode,dose,weight] of [['fixed',500,null],['units',6.25,null],['perKgDay',50,20],['perKgDose',25,20]]) {
    const current={...input,days,doseMode,dose,weight};const note=report(current);
    assert.equal(note.rows[0].daily,1008);assert.equal(note.rows[1].daily,143.64);
    const primary=referenceMeterModel(note.rows[0],ref({input:current}));
    const companion=referenceMeterModel(note.rows[1],ref({input:{...current,weight:null}}));
    assert.equal(companion.ratioA,143.64/250);
    // The tablet and suspension ratios differ; never manufacture 144 mg here.
    assert.notEqual(note.rows[1].daily,144);
    if(weight===null)assert.notEqual(primary.ratioA,companion.ratioA);
  }
});

test('unsupported units and ingredients never acquire reference thresholds',()=>{
  assert.equal(referenceMeterModel({name:'Nystatyna',unit:'j.m.',daily:1000},ref()),null);
  assert.equal(referenceMeterModel({name:'Amoksycylina',unit:'j.m.',daily:1000},ref()),null);
  assert.equal(referenceMeterModel({name:'inna substancja',unit:'mg',daily:1000},ref()),null);
  assert.equal(referenceMeterModel({name:'Amoksycylina',unit:'mg',daily:1000},null),null);
});

test('references never alter arithmetic, limits, prescription eligibility, or inputs',()=>{
  const args={note:report(),input:structuredClone(input),referenceContext};
  const before=structuredClone(args),resultBefore=calculate(args.input);
  const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
  dailyDoseMarkup(freeze(args));
  assert.deepEqual(args,before);assert.deepEqual(calculate(args.input),resultBefore);
  assert.equal(calculate(args.input).valid,false); // duration is still required for the final result
  const complete={...input,days:5,dose:4000};const completeBefore=calculate(complete);
  render(complete);assert.deepEqual(calculate(complete),completeBefore);
});

test('source references and incomplete patient data do not claim safety or recommend escalation',()=>{
  const html=render();
  assert.ok(html.includes('Kreski nie wyznaczają dawki docelowej'));
  assert.ok(html.includes('niezależnymi maksymalnymi dawkami'));
  assert.ok(html.includes('Nie wybieramy go automatycznie'));
  assert.ok(html.includes('nie zalecenie zamiany postaci'));
  assert.ok(!html.includes('Dawka bezpieczna'));
  assert.ok(!html.includes('% granicy'));
});

test('new runtime module is cached and built, and the view receives explicit patient/form context',async()=>{
  for(const file of ['build.mjs','sw.js'])assert.ok((await readFile(new URL(file,import.meta.url),'utf8')).includes("'dose-reference.js'"));
  const app=await readFile(new URL('app.js',import.meta.url),'utf8');
  assert.ok(app.includes('referenceContext:{formId:form.id,patientType:state.patientType'));
  assert.ok((await readFile(new URL('sw.js',import.meta.url),'utf8')).includes('2026-11-14.47'));
});
