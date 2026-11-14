/** Exact display values for a dose wheel; clinical validation stays in the app. */
const WHEEL_MAX = 1000000;
const MAX_RADIUS = 200;
const WHEEL_FRACTION_DIGITS = 6;

function decimal(raw) {
  const text=String(raw??'').trim().replace(',', '.');
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))return null;
  const negative=text.startsWith('-');
  let [whole='',fraction='']=text.replace(/^[+-]/,'').split('.');
  whole=whole.replace(/^0+(?=\d)/,'')||'0';
  fraction=fraction.replace(/0+$/,'');
  const value=`${whole}${fraction?'.'+fraction:''}`;
  return negative&&value!=='0'?'-'+value:value;
}

/** Number is used only for finite/positive checks, never to rewrite a decimal. */
export function parseDosePickerValue(raw) {
  const text=String(raw??'').trim();
  if(text==='')return {valid:true,value:'',error:''};
  const value=decimal(text);
  if(value===null||!Number.isFinite(Number(value)))return {
    valid:false,value:'',error:'Podaj liczbę, używając przecinka lub kropki.',
  };
  if(Number(value)<=0)return {valid:false,value:'',error:'Podaj dawkę większą od zera.'};
  return {valid:true,value,error:''};
}

const fractionDigits=value=>value.split('.')[1]?.length??0;
function integerUnits(value,precision) {
  const [whole,fraction='']=value.split('.');
  return BigInt(whole+fraction.padEnd(precision,'0'));
}
function decimalUnits(value,precision) {
  const digits=value.toString().padStart(precision+1,'0');
  if(!precision)return digits;
  const fraction=digits.slice(-precision).replace(/0+$/,'');
  return digits.slice(0,-precision)+(fraction?'.'+fraction:'');
}
function exceeds(value,max) {
  const precision=Math.max(fractionDigits(value),fractionDigits(max));
  return integerUnits(value,precision)>integerUnits(max,precision);
}

function stepOptions(unit,allowedFractions) {
  const key=unit.toLowerCase().replace(/\s+/g,'');
  // Dose units take precedence over the preparation's form: mg of a tablet is mg.
  if(key==='mg')return {steps:['10','100','1000'],step:'10'};
  if(key.startsWith('mg/kg'))return {steps:['0.1','1','5'],step:'1'};
  if(key==='ml'||key==='g')return {steps:['0.1','0.5','1'],step:'0.5'};
  if(['tabl.','tabl','tabletka','tabletki','tabletek'].includes(key)) {
    if(allowedFractions?.includes(0.25))return {steps:['0.25','0.5','1'],step:'1'};
    if(allowedFractions?.includes(0.5))return {steps:['0.5','1','2'],step:'1'};
  }
  // Capsules, drops, sprays and other counted units have whole-number steps.
  return {steps:['1','2','5'],step:'1'};
}

export function createDosePickerModel(context={}) {
  const raw=String(context.value??'').trim();
  const parsed=parseDosePickerValue(raw);
  const unit=String(context.unit??'mg').trim();
  const options=stepOptions(unit,Array.isArray(context.allowedFractions)?context.allowedFractions:null);
  const requestedStep=decimal(context.step);
  const initialDisplay=parsed.valid?parsed.value:raw;
  return {
    title:context.title||'Dawka jednorazowa',unit,
    steps:options.steps,step:options.steps.includes(requestedStep)?requestedStep:options.step,
    initialDisplay,emptyDraft:raw==='',
    // These limits keep the wheel compact/readable; exact manual entry is preserved.
    max:WHEEL_MAX,
    manualRequired:raw!==''&&(!parsed.valid||exceeds(parsed.value,String(WHEEL_MAX))
      ||fractionDigits(parsed.value)>WHEEL_FRACTION_DIGITS),
  };
}

/**
 * A finite window anchored on the exact current value, not multiples of the step.
 * Recreate it around the selected value after an edge settles. Empty drafts get a
 * separate blank row; a step selection alone therefore never supplies a dose.
 */
export function createDoseWheel(value,step,{radius=MAX_RADIUS,max=WHEEL_MAX}={}) {
  if(!Number.isSafeInteger(radius)||radius<0||radius>MAX_RADIUS)throw new RangeError('Invalid dose wheel radius');
  const current=parseDosePickerValue(value);
  const increment=parseDosePickerValue(step);
  const ceiling=parseDosePickerValue(max);
  if(!current.valid||!increment.valid||increment.value===''||!ceiling.valid||ceiling.value==='') {
    throw new RangeError('Invalid dose wheel value, step or maximum');
  }
  if(current.value!==''&&exceeds(current.value,ceiling.value))throw new RangeError('Dose exceeds wheel range');
  const precision=Math.max(fractionDigits(current.value),fractionDigits(increment.value),fractionDigits(ceiling.value));
  const stride=integerUnits(increment.value,precision);
  const limit=integerUnits(ceiling.value,precision);
  const capacity=BigInt(2*radius+1);
  const min=(a,b)=>a<b?a:b;
  if(current.value==='') {
    const count=Number(min(capacity,limit/stride));
    return {
      values:['',...Array.from({length:count},(_,index)=>decimalUnits(BigInt(index+1)*stride,precision))],
      index:0,step:increment.value,
    };
  }
  const anchor=integerUnits(current.value,precision);
  const availableBelow=(anchor-1n)/stride; // Strictly positive; zero is never selectable.
  const availableAbove=(limit-anchor)/stride;
  let below=min(BigInt(radius),availableBelow);
  const above=min(capacity-1n-below,availableAbove);
  below=min(capacity-1n-above,availableBelow); // Fill towards the available side near a boundary.
  const first=anchor-below*stride;
  const count=Number(below+above+1n);
  return {
    values:Array.from({length:count},(_,index)=>decimalUnits(first+BigInt(index)*stride,precision)),
    index:Number(below),step:increment.value,
  };
}
