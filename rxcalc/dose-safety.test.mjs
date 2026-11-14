import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ingredientDailyDose, suspensionDailyDose } from './daily-dose.js';
import { doseMeterModel, dailyDoseMarkup } from './dose-safety-view.js';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { resolveHumanRegimen } from './human-regimen-engine.js';

const drug = DRUGS.find(drug => drug.id === 'amoxicillin-clavulanate');
const suspension = drug.forms.find(form => form.id === 'augmentin-400-57');
const source = HUMAN_REGIMENS.find(source => source.id === 'dental-augmentin-400-57-child');
const input = { form:'suspension', patientKind:'human', doseMode:'fixed', dose:1300, frequency:2,
  days:null, weight:null, concentrationMg:400, concentrationMl:5, packageSize:70, unitLabel:'ml', roundingStep:.1 };
const context = { formId:suspension.id, specialty:'dental', patientType:'child', age:8,
  ageUnit:'years', weight:20, days:1, dose:45, frequency:2, renalStatus:'unknown' };
const report = (options={}) => ingredientDailyDose({form:suspension,drug,input,...options});
const row = {name:'Amoksycylina',unit:'mg',daily:450,perKg:22.5,ceiling:900,ceilingPerKg:45};
const valid = {valid:true,errors:[]};

test('the screenshot case preserves rounded doses and explains the volume change',()=>{
  const note=report();
  assert.equal(note.rows[0].daily,2608);
  assert.equal(note.rows[1].daily,371.64);
  assert.deepEqual(note.rounding,{from:16.25,to:16.3});
  assert.equal(note.ceilingKind,null);
  const html=dailyDoseMarkup({note,input,context:'Sprawdź właściwą postać.'});
  assert.equal((html.match(/class="dose-safety-row"/g)||[]).length,2);
  assert.ok(html.includes('16,25 → 16,3 ml'));
  assert.ok(html.includes('Brak limitu nie oznacza bezpieczeństwa'));
  assert.ok(!html.includes('dose-safety-wall'));
  assert.ok(!html.includes('% granicy'));
});

test('rounding is absent when not used and an empty duration never blocks the preview',()=>{
  for(const days of ['',null,undefined,7]) {
    const note=report({input:{...input,roundingStep:null,days}});
    assert.equal(note.rounding,null);
    assert.equal(note.rows[0].daily,2600);
    assert.equal(note.rows[1].daily,370.5);
  }
});

test('fixed scale leaves 25% headroom and does not move the 100% wall',()=>{
  for(const [daily,fill,excess,state,clipped] of [
    [450,40,0,'below',false],[900,80,0,'boundary',false],
    [990,80,8,'exceeded',false],[1125,80,20,'exceeded',false],
    [1800,80,20,'exceeded',true],
  ]) {
    const meter=doseMeterModel({...row,daily});
    assert.equal(meter.state,state);
    assert.equal(meter.fill,fill);
    assert.ok(Math.abs(meter.excess-excess)<1e-10);
    assert.equal(meter.clipped,clipped);
  }
});

test('missing and non-finite values are not shown as zero progress',()=>{
  for(const value of [null,undefined,NaN,Infinity,0,-1,'']) {
    assert.equal(doseMeterModel({...row,ceiling:value,ceilingPerKg:null}).state,'unknown');
    const meter=doseMeterModel({...row,daily:value});
    assert.equal(meter.state,'pending');
    assert.equal(meter.fill,null);
    assert.equal(meter.ratio,null);
  }
});

test('source per-kg ceilings wait for weight and unavailable eligibility disables percentages',()=>{
  const pending=doseMeterModel({...row,ceiling:null,perKg:null});
  assert.equal(pending.perKg,true);
  assert.equal(pending.state,'pending');
  assert.equal(pending.ceiling,45);
  const disabled=doseMeterModel(row,{comparisonAllowed:false});
  assert.equal(disabled.state,'unconfirmed');
  assert.equal(disabled.ratio,null);
});

test('400:57 ratios do not invent a false independent clavulanate maximum',()=>{
  const sourceCheck=resolveHumanRegimen(source,context);
  const note=report({input:{...input,doseMode:'perKgDay',dose:45,weight:20,roundingStep:null},source,sourceCheck});
  assert.equal(note.rows[1].ceilingPerKg,6.4125);
  assert.equal(note.rows[1].daily,128.25);
  for(const current of note.rows)assert.equal(doseMeterModel(current).state,'boundary');
  const html=dailyDoseMarkup({note,source,eligibility:valid,input});
  assert.equal((html.match(/class="dose-safety-wall"/g)||[]).length,2);
  assert.ok(html.includes('nie jest to niezależne maksimum'));
  assert.ok(html.includes('128,25 mg/dobę'));
});

test('a genuinely excessive input turns both ingredient comparisons red',()=>{
  const sourceCheck=resolveHumanRegimen(source,{...context,dose:46});
  assert.equal(sourceCheck.valid,false);
  const note=report({input:{...input,doseMode:'perKgDay',dose:46,weight:20,roundingStep:null},source,sourceCheck});
  const eligibility=resolveHumanRegimen(source,{...context,dose:source.doseRange.min});
  assert.equal(eligibility.valid,true);
  for(const current of note.rows)assert.equal(doseMeterModel(current).state,'exceeded');
  const html=dailyDoseMarkup({note,input,source,eligibility,doseProblems:sourceCheck.errors});
  assert.equal((html.match(/class="dose-safety-excess"/g)||[]).length,2);
  assert.ok(html.includes('Przekroczenie o 2,22%'));
  assert.ok(html.includes('Dawka jest poza zakresem'));
});

test('patient mismatch or explicit renal exclusion does not display a reassuring comparison',()=>{
  for(const change of [{patientType:'adult'},{weight:40},{age:1/12},{crcl:20},{renalStatus:'impaired'}]) {
    const eligibility=resolveHumanRegimen(source,{...context,...change});
    assert.equal(eligibility.valid,false);
    const sourceCheck=resolveHumanRegimen(source,context);
    const note=report({input:{...input,dose:450,weight:20,roundingStep:null},source,sourceCheck});
    const html=dailyDoseMarkup({note,input,source,eligibility});
    assert.ok(html.includes('Warunki porównania niepotwierdzone'));
    assert.ok(!html.includes('dose-safety-wall'));
    assert.ok(!html.includes('% granicy'));
  }
});

test('manual limits stay explicitly manual and cannot raise an available source ceiling',()=>{
  const sourceCheck=resolveHumanRegimen(source,context);
  const current={...input,dose:450,weight:20,roundingStep:null};
  const lower=report({input:current,source,sourceCheck,limit:{daily:800,kind:'manual'}});
  assert.equal(lower.ceilingKind,'manual');
  assert.equal(lower.rows[1].ceiling,114);
  const html=dailyDoseMarkup({note:lower,input:current,source,eligibility:valid});
  assert.ok(html.includes('Limit wpisany przez lekarza'));
  assert.ok(html.includes('Limit ręczny nie jest automatycznie weryfikowany w ChPL'));
  const higher=report({input:current,source,sourceCheck,limit:{daily:2000,kind:'manual'}});
  assert.equal(higher.ceilingKind,'source');
  assert.equal(higher.rows[0].ceiling,900);
});

test('tablets use actual per-tablet ingredient proportions, not the suspension ratio',()=>{
  for(const [strength,frequency] of [[500,3],[875,2]]) {
    const form=drug.forms.find(form=>form.id===`augmentin-tablet-${strength}-125`);
    const selected=HUMAN_REGIMENS.find(item=>item.id===`dental-augmentin-tablet-${strength}-125-ge40`);
    const sourceCheck=resolveHumanRegimen(selected,{...context,formId:form.id,patientType:'adult',weight:70,age:35,dose:strength,frequency});
    const current={...input,form:'tablet',strengthMg:strength,concentrationMg:null,concentrationMl:null,
      unitLabel:'tabl.',dose:strength,frequency,weight:70,roundingStep:null,allowedFractions:[1],packageSize:14};
    const note=ingredientDailyDose({form,drug,input:current,source:selected,sourceCheck});
    assert.equal(note.rows[0].daily,strength*frequency);
    assert.equal(note.rows[1].daily,125*frequency);
    assert.equal(note.rows[1].ceiling,125*frequency);
    assert.equal(note.rows[1].derivedCeiling,true);
    assert.equal(suspensionDailyDose({form,drug,input:current}),null);
  }
});

test('an unrounded source boundary is compared with a floating-point tolerance',()=>{
  const current={...row,daily:900+Number.EPSILON*900};
  assert.equal(doseMeterModel(current).state,'boundary');
  assert.equal(doseMeterModel({...row,daily:900.001}).state,'exceeded');
});

test('clipped and near-boundary percentages are truthful, not silently clamped to 100%',()=>{
  for(const [daily,expected] of [[1800,'200% granicy'],[900.00001,'&gt;100% granicy'],[899.99999,'&gt;99,99% granicy']]) {
    const note={...report(),rows:[{...row,daily}],ceilingKind:'manual'};
    const html=dailyDoseMarkup({note,input});
    // Visible comparison is generated from a controlled formatter; accessible text is escaped.
    assert.ok(html.includes(expected)||html.includes(expected.replaceAll('&gt;','>')));
    if(daily===1800)assert.ok(html.includes('dose-safety-overflow'));
  }
});

test('unknown source offers a deliberate selector without automatically picking a regimen',()=>{
  const note=report();
  const html=dailyDoseMarkup({note,input,canChooseSource:true});
  assert.ok(html.includes('data-action="daily-dose-source"'));
  assert.ok(!html.includes('375 mg'));
  assert.ok(!html.includes('400 mg'));
  assert.equal(note.ceilingKind,null);
});

test('nystatin IU are never mistaken for mg',()=>{
  const form={form:'suspension',concentrationMg:null,concentrationMl:null};
  const current={...input,doseMode:'units',dose:2,frequency:4,concentrationMg:null,concentrationMl:null,roundingStep:null};
  const note=ingredientDailyDose({form,input:current,ingredientOverride:[{name:'Nystatyna',amount:100000,perMl:1,unit:'j.m.'}]});
  const html=dailyDoseMarkup({note,input:current});
  assert.ok(html.includes('800000'));
  assert.ok(html.includes('j.m./dobę'));
  assert.ok(!html.includes('mg/dobę'));
});

test('renderer escapes text, rejects unsafe source links and does not mutate its arguments',()=>{
  const note=report();note.rows[0].name='<img src=x onerror=alert(1)>';
  note.sourceUrl='javascript:alert(1)';
  const args={note,input,context:'<script>no</script>'};
  const before=structuredClone(args);
  const html=dailyDoseMarkup(args);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('&lt;img'));
  assert.deepEqual(args,before);
});

test('all new runtime files are included in the build and offline shell',async()=>{
  const build=await readFile(new URL('./build.mjs',import.meta.url),'utf8');
  const worker=await readFile(new URL('./sw.js',import.meta.url),'utf8');
  for(const path of ['daily-dose.js','dose-safety-view.js','dose-safety.css']) {
    assert.ok(build.includes(`'${path}'`));assert.ok(worker.includes(`'${path}'`));
  }
  const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
  assert.ok(app.includes('dailyDoseMarkup'));
  assert.ok(app.includes("case 'daily-dose-source':ui.manualRegimen=false;"));
});
