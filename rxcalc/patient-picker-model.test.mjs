import test from 'node:test';
import assert from 'node:assert/strict';
import {createPatientPickerModel,parsePickerValue,formatWheelValue} from './patient-picker-model.js';

test('empty patient data only creates a draft and never mutates its context',()=>{
  for(const [context,expected] of [
    [{value:'',patientType:'adult'},'70'],[{value:'',patientType:'child'},'20'],
    [{value:'',veterinary:true,species:'dog'},'12'],[{value:'',veterinary:true,species:'cat'},'4'],
    [{value:'',veterinary:true,species:'horse'},'550'],
    [{value:'',veterinary:true,species:'hamster'},'80'],[{value:'',veterinary:true,species:'rat'},'300'],
  ]){
    const before=structuredClone(context);
    const model=createPatientPickerModel('weight',Object.freeze(context));
    assert.equal(model.initialDisplay,expected);
    assert.equal(model.manualRequired,false);
    assert.deepEqual(context,before);
    // Cancelling means discarding this pure draft; a subsequent opening has identical values.
    model.whole=1;
    assert.equal(createPatientPickerModel('weight',context).initialDisplay,expected);
  }
});

test('gram wheels round-trip small animal weights without binary rounding',()=>{
  for(const [canonical,display] of [['0.08','80'],['0,3','300'],['0.083123','83.123'],['0.0001','0.1']]){
    const model=createPatientPickerModel('weight',{value:canonical,veterinary:true,species:'hamster'});
    assert.equal(model.scale,1000);
    assert.equal(model.unit,'g');
    assert.equal(model.initialDisplay,display);
    assert.equal(model.manualRequired,false);
    const result=parsePickerValue(formatWheelValue(model.whole,model.fraction,model.precision),model);
    assert.equal(result.valid,true);
    assert.equal(result.value,canonical.replace(',','.'));
  }
});

test('weight wheels preserve up to three meaningful fractional digits in displayed units',()=>{
  for(const [value,precision] of [['70',1],['70.5',1],['70.2500',2],['70.125',3]]){
    const model=createPatientPickerModel('weight',{value});
    assert.equal(model.precision,precision);
    assert.equal(model.manualRequired,false);
    assert.equal(parsePickerValue(formatWheelValue(model.whole,model.fraction,model.precision),model).value,Number(value).toString());
  }
});

test('manual fallback preserves values that wheels cannot represent',()=>{
  for(const [field,context,expected] of [
    ['weight',{value:'70.123456789012345'},'70.123456789012345'],
    ['weight',{value:'0.0831234',veterinary:true,species:'rat'},'83.1234'],
    ['weight',{value:'2.345',veterinary:true,species:'rat'},'2345'],
    ['age',{value:'5.5',ageUnit:'years'},'5.5'],
    ['age',{value:'400',ageUnit:'days'},'400'],
    ['age',{value:'250',ageUnit:'months'},'250'],
  ]){
    const model=createPatientPickerModel(field,context);
    assert.equal(model.manualRequired,true);
    assert.equal(model.initialDisplay,expected);
    assert.equal(parsePickerValue(model.initialDisplay,model).value,context.value);
  }
});

test('age wheels retain the selected unit rather than converting age',()=>{
  for(const [ageUnit,unit,maxWhole,draft] of [
    ['years','lat',130,'35'],['months','mies.',240,'12'],
    ['weeks','tyg.',520,'4'],['days','dni',366,'30'],
  ]){
    const model=createPatientPickerModel('age',{value:'',ageUnit});
    assert.equal(model.unit,unit);assert.equal(model.precision,0);
    assert.equal(model.maxWhole,maxWhole);assert.equal(model.initialDisplay,draft);
    assert.equal(parsePickerValue('12',model).value,'12');
  }
  assert.equal(createPatientPickerModel('age',{patientType:'child'}).initialDisplay,'5');
  assert.equal(createPatientPickerModel('age',{veterinary:true}).initialDisplay,'5');
});

test('age zero is accepted while zero and negative weights are rejected',()=>{
  const age=createPatientPickerModel('age',{ageUnit:'years'});
  const weight=createPatientPickerModel('weight',{});
  assert.deepEqual(parsePickerValue('0',age),{valid:true,value:'0',error:''});
  assert.equal(parsePickerValue('-1',age).valid,false);
  for(const value of ['0','-0','-1','-0.1'])assert.equal(parsePickerValue(value,weight).valid,false);
});

test('manual upper bounds match canonical input limits beyond shorter wheel ranges',()=>{
  const human=createPatientPickerModel('weight',{});
  assert.equal(parsePickerValue('500',human).valid,true);
  assert.equal(parsePickerValue('500.00000000000000001',human).valid,false);
  const horse=createPatientPickerModel('weight',{veterinary:true,species:'horse'});
  assert.equal(horse.maxWhole,2000);
  assert.equal(parsePickerValue('2000',horse).valid,true);
  assert.equal(parsePickerValue('2000.1',horse).valid,false);
  const rat=createPatientPickerModel('weight',{veterinary:true,species:'rat'});
  assert.equal(rat.maxWhole,2000);assert.equal(rat.max,2000000);
  assert.equal(parsePickerValue('2500',rat).value,'2.5');
  assert.equal(parsePickerValue('2000000.1',rat).valid,false);
  for(const [context,max] of [
    [{ageUnit:'years'},130],[{ageUnit:'months'},1560],
    [{ageUnit:'days'},47482.5],[{ageUnit:'days',veterinary:true},47450],
  ]){
    const model=createPatientPickerModel('age',context);
    assert.equal(model.max,max);assert.equal(parsePickerValue(String(max),model).valid,true);
    assert.equal(parsePickerValue(String(max+1),model).valid,false);
  }
});

test('manual parsing accepts decimal comma or dot but rejects non-decimal and non-finite values',()=>{
  const model=createPatientPickerModel('weight',{});
  for(const [input,expected] of [[' 70,25 ','70.25'],['+0070.2500','70.25'],['.5','0.5'],['1.','1']]){
    assert.deepEqual(parsePickerValue(input,model),{valid:true,value:expected,error:''});
  }
  for(const invalid of ['NaN','Infinity','1e2','1,2.3','1 000','70 kg','--1','0x10','9'.repeat(400)]){
    assert.equal(parsePickerValue(invalid,model).valid,false,invalid);
  }
  assert.deepEqual(parsePickerValue(' ',model),{valid:true,value:'',error:''});
});

test('invalid existing input opens manual entry without replacing it with a draft',()=>{
  for(const value of ['NaN','-2','0','1e2','501']){
    const model=createPatientPickerModel('weight',{value});
    assert.equal(model.manualRequired,true);
    assert.equal(model.initialDisplay,value);
  }
});

test('wheel formatting retains leading fractional zeros and rejects invalid positions',()=>{
  assert.equal(formatWheelValue(70,0,1),'70.0');
  assert.equal(formatWheelValue(70,5,2),'70.05');
  assert.equal(formatWheelValue(0,8,3),'0.008');
  assert.equal(formatWheelValue(35,0,0),'35');
  for(const args of [[1,100,2],[1,-1,1],[-1,0,0],[1.5,0,0],[1,0,4]]){
    assert.throws(()=>formatWheelValue(...args),RangeError);
  }
});
