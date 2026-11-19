import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from './engine.js';
import {DRUGS} from './catalogue.js';
import {LIQUID_STARTER_REGIMENS} from './liquid-starters.js';
import {automaticRoundingStep,assessDoseRounding,resolveRoundingRegimen,applyRoundingPresentation} from './rounding-assessment.js';
import {normalizeRoundingMode} from './decimal-rounding.js';
import {createPrescriptionCart,savePrescriptionItem,prescriptionCartText,preparePrescriptionEdit} from './prescription-cart.js';
import {humanDosingText,prescriptionText} from './dental-output.js';

const form=DRUGS.find(d=>d.id==='amoxicillin-clavulanate').forms.find(f=>f.id==='augmentin-400-57');
const source=LIQUID_STARTER_REGIMENS.find(s=>s.id==='dental-augmentin-suspension-adult-substitution');
const context={formId:form.id,patientKind:'human',patientType:'adult',specialty:'dental',
  weight:70,age:35,ageUnit:'years',renalStatus:'normal',crcl:90,
  doseMode:'fixed',dose:875,frequency:2,days:7,roundingMode:'auto'};
const options={form,source,context:{...context,roundingStep:automaticRoundingStep({form,source,context})},
  limits:{single:null,daily:null}};
const resolved=resolveRoundingRegimen(options),assessment=assessDoseRounding(options);
const input={...form,form:'suspension',unitLabel:'ml',doseMode:'fixed',dose:875,
  frequency:2,days:7,weight:70,packageSize:35,roundingStep:1,
  maxSingleMg:resolved.maxSingleMg,maxDailyMg:resolved.maxDailyMg};

test('a documented conversion reclassifies only identified arithmetic notices',()=>{
  const raw=calculate(input),before=structuredClone(raw);
  assert.equal(raw.status,'warning');
  assert.deepEqual(raw.warningDetails.map(item=>item.code),['dose-rounded','daily-limit-unspecified']);
  const presented=applyRoundingPresentation(raw,assessment);
  assert.equal(presented.valid,true);assert.equal(presented.status,'ok');
  assert.deepEqual(presented.warnings,[]);
  assert.equal(presented.notices.length,2);
  assert.equal(presented.singleUnits,11);assert.equal(presented.singleMg,880);
  assert.equal(presented.dailyMg,1760);assert.equal(presented.totalUnits,154);
  assert.equal(presented.packages,5);assert.equal(presented.leftoverUnits,21);
  assert.deepEqual(raw,before,'Arithmetic and original warning record remain unchanged');
});

test('unrelated supply warnings retain yellow status after recognized rounding',()=>{
  const raw=calculate({...input,packageSize:70,shelfLifeDays:1});
  assert.ok(raw.warnings.some(text=>text.includes('trwałość')));
  const presented=applyRoundingPresentation(raw,assessment);
  assert.equal(presented.status,'warning');
  assert.ok(presented.warnings.some(text=>text.includes('trwałość')));
  assert.equal(presented.warnings.length,1);
});

test('a rule cannot reclassify an actual independent-limit failure or different quantity',()=>{
  for(const change of [{maxSingleMg:875},{maxDailyMg:1750}]) {
    const raw=calculate({...input,...change});
    assert.equal(raw.status,'critical');assert.equal(raw.valid,false);
    assert.equal(applyRoundingPresentation(raw,assessment),raw);
  }
  for(const change of [{roundingStep:.1},{roundingStep:null},{frequency:3},{dose:800}]) {
    const raw=calculate({...input,...change});
    assert.equal(applyRoundingPresentation(raw,assessment),raw);
  }
  const raw=calculate(input);
  for(const change of [{state:'blocked'},{state:'needs-review'},{ruleId:'unknown'},{revision:'old'}])
    assert.equal(applyRoundingPresentation(raw,{...assessment,...change}),raw);
});

test('unidentified warnings are never removed just because their wording resembles arithmetic',()=>{
  const raw=calculate(input),extra='Zaokrąglono ilość — niezależna uwaga źródła.';
  raw.warnings.push(extra);
  const result=applyRoundingPresentation(raw,assessment);
  assert.deepEqual(result.warnings,[extra]);assert.equal(result.status,'warning');
});

test('actual rounded output and rule version stay together in an immutable basket item',()=>{
  const result=applyRoundingPresentation(calculate(input),assessment);
  const dosing=humanDosingText({source,amount:'11 ml',route:'doustnie',frequency:2,days:7});
  const full=prescriptionText({mode:'full',header:'Rp. Augmentin 400 + 57 mg/5 ml\n5 op. po 35 ml',dosing,source});
  const ds=prescriptionText({mode:'ds',header:'',dosing,source});
  const state={specialty:'dental',patientType:'adult',weight:'70',age:'35',humanAgeUnit:'years',
    renalStatus:'normal',humanCrCl:'90',drugId:'amoxicillin-clavulanate',formId:form.id,
    dose:'875',frequency:'2',days:'7',roundingMode:'auto',roundDoses:false,roundingPlaces:'1'};
  const draft={snapshot:{...state,roundingPolicy:structuredClone(assessment.policy),
    calculation:{singleUnits:result.singleUnits,singleMg:result.singleMg,dailyMg:result.dailyMg,
      totalUnits:result.totalUnits,packages:result.packages,packageSize:35}},
    label:form.label,summary:'11 ml · 5 op. × 35 ml',texts:{full,ds},valid:true,confirmed:true};
  const saved=savePrescriptionItem(createPrescriptionCart(),draft);
  assert.equal(saved.ok,true);assert.equal(saved.item.snapshot.dose,'875');
  assert.equal(saved.item.snapshot.calculation.singleMg,880);
  assert.equal(saved.item.snapshot.calculation.totalUnits,154);
  assert.equal(saved.item.snapshot.roundingPolicy.revision,assessment.policy.revision);
  draft.snapshot.calculation.singleUnits=10;draft.snapshot.roundingPolicy.ml=10;
  assert.equal(saved.item.snapshot.calculation.singleUnits,11);
  assert.equal(saved.item.snapshot.roundingPolicy.ml,11);
  assert.match(prescriptionCartText(saved.cart,state).text,/Stosować 11 ml/);
  assert.match(prescriptionCartText(saved.cart,state).text,/5 op\. po 35 ml/);
  const edited=preparePrescriptionEdit(saved.item,{...state,weight:'71'});
  assert.equal(edited.state.roundingMode,'auto');assert.equal(edited.state.dose,'875');
  assert.equal(edited.state.weight,'71');assert.equal(edited.state.confirmed,false);
  assert.equal(prescriptionCartText(saved.cart,{...state,weight:'71'}).ok,false);
});

test('rounding modes default to Auto while legacy cart preferences can be preserved',()=>{
  assert.equal(normalizeRoundingMode(undefined),'auto');
  assert.equal(normalizeRoundingMode(undefined,'off'),'off');
  assert.equal(normalizeRoundingMode(undefined,'custom'),'custom');
  for(const mode of ['auto','custom','off'])assert.equal(normalizeRoundingMode(mode),mode);
  assert.equal(normalizeRoundingMode('unknown','unknown'),'auto');
});
