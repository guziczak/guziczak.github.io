import test from 'node:test';
import assert from 'node:assert/strict';
import {createDosePickerModel,parseDosePickerValue,createDoseWheel} from './dose-picker-model.js';

test('opening an empty dose or changing its step never supplies a dose',()=>{
  const context=Object.freeze({value:'',unit:'mg',title:'Dawka amoksycyliny na podanie'});
  for(const step of ['1','10','100']) {
    const model=createDosePickerModel({...context,step});
    assert.equal(model.title,context.title);
    assert.equal(model.initialDisplay,'');
    assert.equal(model.emptyDraft,true);
    assert.equal(model.manualRequired,false);
    const wheel=createDoseWheel(model.initialDisplay,model.step);
    assert.equal(wheel.values[wheel.index],'');
    assert.equal(wheel.values[1],step);
    assert.equal(wheel.values.length,402);
    assert.equal(wheel.values.filter(value=>value==='').length,1);
  }
  assert.equal(context.value,'');
  assert.deepEqual(parseDosePickerValue(''),{valid:true,value:'',error:''});
});

test('units choose visible steps independently of the medicine or tablet strength',()=>{
  for(const [context,steps,step] of [
    [{unit:'mg',form:'tablet',allowedFractions:[1,0.25]},['1','10','100'],'10'],
    [{unit:'mg/kg'},['0.1','1','5'],'1'],
    [{unit:'mg/kg/d'},['0.1','1','5'],'1'],
    [{unit:'ml'},['0.1','0.5','1'],'0.5'],
    [{unit:'g'},['0.1','0.5','1'],'0.5'],
    [{unit:'tabl.',allowedFractions:[1,0.5]},['0.5','1','2'],'1'],
    [{unit:'tabl.',allowedFractions:[1,0.25,0.5,0.75]},['0.25','0.5','1'],'1'],
    [{unit:'tabl.',allowedFractions:[1]},['1','2','5'],'1'],
    [{unit:'kaps.',allowedFractions:[1,0.5]},['1','2','5'],'1'],
    [{unit:'kropli'},['1','2','5'],'1'],
    [{unit:'rozp.'},['1','2','5'],'1'],
  ]) {
    const before=structuredClone(context);
    const model=createDosePickerModel(Object.freeze(context));
    assert.deepEqual(model.steps,steps,context.unit);
    assert.equal(model.step,step,context.unit);
    assert.equal(model.initialDisplay,'');
    assert.deepEqual(context,before);
  }
  assert.equal(createDosePickerModel({unit:'ml',step:'0,10'}).step,'0.1');
  assert.equal(createDosePickerModel({unit:'mg',step:'1000'}).step,'10');
});

test('changing step and returning from manual entry preserves an off-grid dose exactly',()=>{
  let display='125,25';
  for(const step of ['1','100','10','100','1']) {
    const model=createDosePickerModel({value:display,unit:'mg',step});
    const wheel=createDoseWheel(model.initialDisplay,model.step);
    assert.equal(wheel.values[wheel.index],'125.25');
    assert.equal(wheel.values[wheel.index+1],step==='100'?'225.25':step==='10'?'135.25':'126.25');
    display=parseDosePickerValue(wheel.values[wheel.index]).value;
  }
  const hundreds=createDoseWheel('125','100');
  assert.deepEqual(hundreds.values.slice(0,3),['25','125','225']);
  assert.equal(hundreds.index,1);
  assert.equal(createDosePickerModel({value:display,unit:'mg'}).initialDisplay,'125.25');
});

test('decimal motion and repeated edge recentering do not accumulate floating point errors',()=>{
  const tenths=createDoseWheel('0.2','0.1',{radius:2});
  assert.deepEqual(tenths.values,['0.1','0.2','0.3','0.4','0.5']);
  assert.equal(tenths.index,1);
  let value='0.2';
  for(let turn=0;turn<100;turn++) {
    const wheel=createDoseWheel(value,'0.1',{radius:2});
    value=wheel.values[wheel.index+1];
  }
  assert.equal(value,'10.2');
  const precise=createDoseWheel('0.123456789012345678901','0.1',{radius:1});
  assert.deepEqual(precise.values,['0.023456789012345678901','0.123456789012345678901','0.223456789012345678901']);
  assert.equal(precise.index,1);
});

test('the finite window shifts near zero and its technical maximum without clipping the value',()=>{
  const lower=createDoseWheel('0.05','0.1',{radius:2});
  assert.deepEqual(lower.values,['0.05','0.15','0.25','0.35','0.45']);
  assert.equal(lower.index,0);
  const upper=createDoseWheel('999999.99','0.1',{radius:2});
  assert.deepEqual(upper.values,['999999.59','999999.69','999999.79','999999.89','999999.99']);
  assert.equal(upper.index,4);
  const maximum=createDoseWheel('1000000','100');
  assert.equal(maximum.values.length,401);
  assert.equal(maximum.values[maximum.index],'1000000');
  assert.equal(maximum.values.at(-1),'1000000');
  const short=createDoseWheel('2','1',{max:3});
  assert.deepEqual(short.values,['1','2','3']);
  assert.equal(short.index,1);
  assert.deepEqual(createDoseWheel('','1',{max:3}).values,['','1','2','3']);
  for(const wheel of [lower,upper,maximum,short]) {
    assert.ok(wheel.values.length<=401);
    assert.ok(wheel.values.every(value=>value!==''&&Number(value)>0&&Number(value)<=1000000));
  }
});

test('manual entry retains exact values beyond display limits, leaving application limits untouched',()=>{
  for(const value of ['1000000.00000000000000001','2000000','9007199254740993','29.999999999999999','0.0000001']) {
    const model=createDosePickerModel({value,unit:'mg'});
    assert.equal(model.manualRequired,true,value);
    assert.equal(model.initialDisplay,value);
    assert.deepEqual(parseDosePickerValue(model.initialDisplay),{valid:true,value,error:''});
  }
  assert.equal(createDosePickerModel({value:'1000000',unit:'mg'}).manualRequired,false);
  assert.equal(createDosePickerModel({value:'1.000001',unit:'mg'}).manualRequired,false);
  assert.throws(()=>createDoseWheel('1000000.00000000000000001','1'),RangeError);
});

test('manual parsing accepts exact decimal notation but rejects invalid or nonpositive input',()=>{
  for(const [raw,value] of [
    [' 0070,2500 ','70.25'],['+0.12500','0.125'],['.5','0.5'],['1.','1'],
    ['9007199254740993.123456789012345','9007199254740993.123456789012345'],
  ])assert.deepEqual(parseDosePickerValue(raw),{valid:true,value,error:''});
  for(const raw of ['0','-0','-1','-0.1','NaN','Infinity','1e2','1,2.3','1 000','70 mg','--1','0x10','9'.repeat(400)]) {
    assert.equal(parseDosePickerValue(raw).valid,false,raw);
    const model=createDosePickerModel({value:raw,unit:'mg'});
    assert.equal(model.manualRequired,true,raw);
    assert.equal(model.initialDisplay,raw);
  }
  assert.deepEqual(parseDosePickerValue(' '),{valid:true,value:'',error:''});
});

test('invalid window requests fail explicitly rather than silently rounding or supplying a dose',()=>{
  for(const step of ['','0','-1','NaN'])assert.throws(()=>createDoseWheel('10',step),RangeError);
  for(const value of ['0','-1','NaN','1000001'])assert.throws(()=>createDoseWheel(value,'1'),RangeError);
  for(const radius of [-1,0.5,201,Infinity])assert.throws(()=>createDoseWheel('10','1',{radius}),RangeError);
  for(const max of ['',0,-1,Infinity])assert.throws(()=>createDoseWheel('10','1',{max}),RangeError);
  assert.deepEqual(createDoseWheel('0.25','100',{radius:0}).values,['0.25']);
  assert.deepEqual(createDoseWheel('','1',{radius:0}).values,['','1']);
});
