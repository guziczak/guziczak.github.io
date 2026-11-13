/** Presentation values for patient wheels. No patient state or clinical rules live here. */
const AGE_UNITS = { years:'lat', months:'mies.', weeks:'tyg.', days:'dni' };
const AGE_WHEEL_MAX = { years:130, months:240, weeks:520, days:366 };

function decimal(value) {
  const text=String(value??'').trim().replace(',', '.');
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))return null;
  const negative=text.startsWith('-');
  const unsigned=text.replace(/^[+-]/,'');
  let [whole='',fraction='']=unsigned.split('.');
  whole=whole.replace(/^0+(?=\d)/,'')||'0';
  fraction=fraction.replace(/0+$/,'');
  const result=`${whole}${fraction?'.'+fraction:''}`;
  const signed=negative&&result!=='0'?'-'+result:result;
  return Number.isFinite(Number(signed))?signed:null;
}

/** Move the decimal point as text, avoiding floating point rounding during g↔kg conversion. */
function shiftDecimal(value, places) {
  const negative=value.startsWith('-');
  const [whole,fraction='']=value.replace(/^-/,'').split('.');
  const digits=whole+fraction;
  const point=whole.length+places;
  const shifted=point<=0?`0.${'0'.repeat(-point)}${digits}`
    : point>=digits.length?digits+'0'.repeat(point-digits.length)
    : digits.slice(0,point)+'.'+digits.slice(point);
  return decimal((negative?'-':'')+shifted);
}

function greaterThan(value, limit) {
  const [whole,fraction='']=value.split('.');
  const [limitWhole,limitFraction='']=String(limit).split('.');
  if(whole.length!==limitWhole.length)return whole.length>limitWhole.length;
  if(whole!==limitWhole)return whole>limitWhole;
  const length=Math.max(fraction.length,limitFraction.length);
  return fraction.padEnd(length,'0')>limitFraction.padEnd(length,'0');
}

export function createPatientPickerModel(field, context={}) {
  if(!['age','weight'].includes(field))throw new RangeError('Unknown patient picker field');
  const veterinary=context.veterinary===true;
  const ageUnit=Object.hasOwn(AGE_UNITS,context.ageUnit)?context.ageUnit:'years';
  const grams=field==='weight'&&veterinary&&['hamster','rat'].includes(context.species);
  const scale=grams?1000:1;
  const unit=field==='weight'?(grams?'g':'kg'):AGE_UNITS[ageUnit];
  const daysPerYear=veterinary?365:365.25;
  const max=field==='weight'?(veterinary?2000:500)*scale
    : ({years:130,months:1560,weeks:130*daysPerYear/7,days:130*daysPerYear})[ageUnit];
  const maxWhole=field==='age'?AGE_WHEEL_MAX[ageUnit]:grams?2000:veterinary?2000:500;
  const defaultWeight=veterinary
    ? ({dog:12,cat:4,horse:550,hamster:80,rat:300})[context.species]??12
    : context.patientType==='child'?20:70;
  const defaultAge=({years:veterinary?5:context.patientType==='child'?5:35,months:12,weeks:4,days:30})[ageUnit];
  const empty=String(context.value??'').trim()==='';
  const parsed=empty?null:decimal(context.value);
  const existing=parsed===null?null:grams?shiftDecimal(parsed,3):parsed;
  const initialDisplay=empty?String(field==='weight'?defaultWeight:defaultAge)
    : existing??String(context.value).trim();
  const fractionDigits=existing?.split('.')[1]?.length??0;
  const precision=field==='age'?0:Math.min(3,Math.max(1,fractionDigits));
  const value=decimal(initialDisplay);
  const manualRequired=!empty&&(value===null||value.startsWith('-')
    ||field==='weight'&&Number(value)<=0
    ||greaterThan(value,maxWhole)
    ||fractionDigits>(field==='age'?0:3));
  // Wheel positions are a draft only. Exact values beyond the wheel go straight to manual entry.
  const position=value!==null&&!value.startsWith('-')?value:String(field==='weight'?defaultWeight:defaultAge);
  const [integer,fractionText='']=position.split('.');
  const whole=Math.min(maxWhole,Number(integer));
  const fraction=precision?Number(fractionText.slice(0,precision).padEnd(precision,'0')):0;
  return {
    title:field==='weight'?'Masa ciała':veterinary?'Wiek zwierzęcia':'Wiek pacjenta',
    unit,scale,min:0,max,maxWhole,precision,whole,fraction,manualRequired,initialDisplay,
  };
}

/** Validate display units and return exact canonical kg or age in the unchanged current unit. */
export function parsePickerValue(display, model) {
  const raw=String(display??'').trim();
  if(raw==='')return {valid:true,value:'',error:''};
  const value=decimal(raw);
  if(value===null)return {valid:false,value:'',error:'Podaj liczbę, używając przecinka lub kropki.'};
  const weight=['kg','g'].includes(model.unit);
  if(value.startsWith('-')||weight&&Number(value)<=0)return {
    valid:false,value:'',error:weight?'Podaj masę większą od zera.':'Wiek nie może być ujemny.',
  };
  if(greaterThan(value,model.max))return {
    valid:false,value:'',error:weight?`Podaj masę nie większą niż ${model.max/model.scale} kg.`:'Wiek przekracza zakres pola (130 lat).',
  };
  return {valid:true,value:model.scale===1000?shiftDecimal(value,-3):value,error:''};
}

export function formatWheelValue(whole, fraction, precision) {
  if(!Number.isInteger(precision)||precision<0||precision>3
    ||!Number.isSafeInteger(whole)||whole<0
    ||!Number.isInteger(fraction)||fraction<0||fraction>=10**precision) {
    throw new RangeError('Invalid wheel position');
  }
  return String(whole)+(precision?'.'+String(fraction).padStart(precision,'0'):'');
}
