import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { resolveHumanRegimen } from './human-regimen-engine.js';
import { searchProducts } from './product-search.js';
import { calculate } from './engine.js';
import { humanDosingText, prescriptionText } from './dental-output.js';

const dental=DRUGS.filter(drug=>drug.specialties.includes('dental'));
function run(formId,regimenId,context,packageId) {
  const form=dental.flatMap(drug=>drug.forms).find(form=>form.id===formId);
  const pack=form.packOptions.find(pack=>pack.id===packageId)||form.packOptions[0];
  const source=HUMAN_REGIMENS.find(source=>source.id===regimenId);
  const resolved=resolveHumanRegimen(source,{formId,specialty:'dental',patientType:'adult',ageUnit:'years',...context});
  const result=calculate({patientKind:'human',form:form.form,unitLabel:form.unitLabel,
    doseMode:resolved.doseMode,dose:resolved.dose,frequency:resolved.frequency,
    days:context.days,weight:context.weight,age:context.age,
    strengthMg:form.strengthMg,concentrationMg:form.concentrationMg,concentrationMl:form.concentrationMl,
    allowedFractions:form.allowedFractions,packageSize:pack.quantity,
    maxDailyMg:resolved.maxDailyMg,maxSingleMg:resolved.maxSingleMg,shelfLifeDays:form.shelfLifeDays,
  });
  return {resolved,result,form};
}

test('exact Augmentin package search feeds daily/kg source and both active ingredients', () => {
  const rows=searchProducts(dental,'Augmentin 400 140');
  assert.equal(rows.length,1);
  const {resolved,result,form}=run(rows[0].form.id,'dental-augmentin-400-57-child',{
    patientType:'child',age:8,weight:24,dose:45,days:7,
  },rows[0].pack.id);
  assert.equal(resolved.valid,true);
  assert.equal(result.valid,true);
  assert.equal(result.singleUnits,6.75);
  assert.equal(result.dailyMg,1080);
  assert.equal(result.totalUnits,94.5);
  assert.equal(result.packages,1);
  assert.equal(result.singleUnits*form.ingredients[1].amountMg/form.ingredients[1].perMl,76.95);
  assert.equal(resolved.maxDailyMg,1080);
});

test('adult source does not override physical tablet subdivision after choosing the exact strength', () => {
  const allowed=run('ospamox-tablet-1000','dental-ospamox-tablet-ge40-q12',{weight:70,dose:1000,days:7},'14');
  assert.equal(allowed.result.singleUnits,1);
  assert.equal(allowed.result.packages,1);
  const quarter=run('ospamox-tablet-1000','dental-ospamox-tablet-ge40-q12',{weight:70,dose:750,days:7},'14');
  assert.equal(quarter.resolved.valid,true);
  assert.equal(quarter.result.valid,false);
  const half=run('ospamox-tablet-500','dental-ospamox-tablet-ge40-q12',{weight:70,dose:750,days:7},'14');
  assert.equal(half.result.valid,true);
  assert.equal(half.result.singleUnits,1.5);
});

test('new solid antibiotics are searchable and feed real catalogue forms into calculation and clean prescription output', () => {
  for (const item of [
    { query:'Augmentin 875 125 14', formId:'augmentin-tablet-875-125', regimenId:'dental-augmentin-tablet-875-125-ge40', dose:875, frequency:2, unit:'tabl.', total:14, packages:1 },
    { query:'klindamycyna 300 16', formId:'dalacin-c-300', regimenId:'dental-dalacin-c-300-over14-tid', dose:300, frequency:3, unit:'kaps.', total:21, packages:2 },
  ]) {
    const rows=searchProducts(dental,item.query);
    assert.equal(rows.length,1,item.query);
    assert.equal(rows[0].form.id,item.formId);
    const {resolved,result,form}=run(item.formId,item.regimenId,{age:35,weight:70,dose:item.dose,days:7},rows[0].pack.id);
    assert.equal(resolved.valid,true);
    assert.equal(result.valid,true);
    assert.equal(result.singleUnits,1);
    assert.equal(result.unitLabel,item.unit);
    assert.equal(result.totalUnits,item.total);
    assert.equal(result.packages,item.packages);
    const source=HUMAN_REGIMENS.find(source=>source.id===item.regimenId);
    const dosing=humanDosingText({source,amount:`1 ${item.unit}`,route:form.routeLabel,frequency:item.frequency,days:7});
    const header=`Rp. ${rows[0].drug.substance}\n${form.label}\n${result.packages} op. po ${rows[0].pack.label}`;
    const output=prescriptionText({header,dosing,source});
    assert.equal(output,`${header}\n${dosing}`);
    assert.ok(output.startsWith('Rp. '));
    assert.ok(!output.includes('Wskazanie:'));
    assert.ok(!output.includes('Schemat:'));
    assert.equal(prescriptionText({mode:'ds',header,dosing,source}),`Wskazanie: ${source.indication}.\n\n${dosing}`);
  }
});

test('Ospamox calculation and dosing text are available without a separate renal confirmation', () => {
  const regimenId='dental-ospamox-tablet-ge40-q8';
  const source=HUMAN_REGIMENS.find(source=>source.id===regimenId);
  const context={weight:80,dose:500,days:7};
  const {resolved,result,form}=run('ospamox-tablet-500',regimenId,context,'16');
  assert.equal(resolved.valid,true);
  assert.equal(result.valid,true);
  assert.equal(resolved.requirements.includes('renalStatus'),false);
  assert.equal(result.singleUnits,1);
  assert.equal(result.dailyMg,1500);
  assert.equal(result.totalUnits,21);
  assert.equal(result.packages,2);
  const output=humanDosingText({source,amount:'1 tabl.',route:form.routeLabel,frequency:3,days:7});
  assert.match(output,/1 tabl\./);
  assert.match(output,/7 dni/);
  for(const change of [{crcl:30},{crcl:29},{renalStatus:'impaired'}]) {
    assert.equal(run('ospamox-tablet-500',regimenId,{...context,...change},'16').resolved.valid,false);
  }
});

test('rinse packages use ml while active mg remains unspecified', () => {
  const {resolved,result}=run('eludril-care-rinse','eludril-care-adult',{age:30,dose:null,frequency:2,days:21},'500');
  assert.equal(resolved.valid,true);
  assert.equal(result.valid,true);
  assert.equal(result.totalUnits,630);
  assert.equal(result.packages,2);
  assert.equal(result.dailyMg,null);
});

test('a source-approved spray range still rejects fractional physical actuations', () => {
  const {resolved,result}=run('tantum-verde-spray','tantum-spray-over12',{age:35,dose:4.5,frequency:2,days:3},'176');
  assert.equal(resolved.valid,true);
  assert.equal(result.valid,false);
});

test('offline shell and build contain the full runtime module dependency closure', () => {
  const worker=readFileSync(new URL('./sw.js',import.meta.url),'utf8');
  const build=readFileSync(new URL('./build.mjs',import.meta.url),'utf8');
  const visited=new Set();
  function visit(name) {
    if(visited.has(name))return;
    visited.add(name);
    assert.ok(worker.includes(`'${name}'`),`${name} missing from offline assets`);
    assert.ok(build.includes(`'${name}'`),`${name} missing from build`);
    const source=readFileSync(new URL(name,import.meta.url),'utf8');
    for(const match of source.matchAll(/from\s+['"]\.\/([^'"]+\.js)['"]/g))visit(match[1]);
  }
  visit('app.js');
});
