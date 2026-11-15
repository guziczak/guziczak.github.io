/** Volume shortcuts are arithmetic controls, not recommended patient doses.
 * `allowed` means the value can be entered, NOT that it complies with a source.
 * Range/ceiling deviations are advisory here; engine/export validation is unchanged.
 */
import { formatNumber as n } from './engine.js';
const positive = v => typeof v === 'number' && Number.isFinite(v) && v > 0;
const present = v => v !== null && v !== undefined && v !== '';
const clean = v => Number(v.toPrecision(14));
const above = (a,b) => a-b > Number.EPSILON*64*Math.max(1,Math.abs(a),Math.abs(b));
const equal = (a,b) => Number.isFinite(a)&&Number.isFinite(b)&&!above(a,b)&&!above(b,a);
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function supportsLiquidChoices(form, veterinary=false) {
  return !veterinary && form?.form==='suspension' && form.unitLabel==='ml'
    && !form.calculationBlocked && !form.referenceOnly && form.calculationMode!=='instruction';
}
export function liquidDoseChoices(form, {doseMode='fixed',weight=null,frequency=null,
  source=null,maxSingleMg=null,maxDailyMg=null,roundingStep=null,veterinary=false,
  eligibility=null}={}) {
  if(!supportsLiquidChoices(form,veterinary)||source?.doseMode==='instruction'
    ||!['fixed','units','perKgDay','perKgDose'].includes(doseMode))return [];
  const concentration=positive(form.concentrationMg)&&positive(form.concentrationMl)
    ?form.concentrationMg/form.concentrationMl:null;
  const weighted=['perKgDay','perKgDose'].includes(doseMode);
  const single=[form.maxSingleMg,source?.maxSingleMg,maxSingleMg].filter(present);
  const daily=[form.maxDailyMg,source?.maxDailyMg,maxDailyMg].filter(present);
  const perKg=[source?.maxSingleMgPerKg,source?.maxDailyMgPerKg].filter(present);
  const units=[source?.maxUnitsPerDose,source?.maxDailyUnits].filter(present);
  return [2.5,5,10].map(ml=>{
    const mg=concentration===null?null:clean(ml*concentration);
    const value=doseMode==='units'?ml:doseMode==='fixed'?mg
      :positive(weight)&&weight<=500&&mg!==null
        ?doseMode==='perKgDay'?(positive(frequency)?clean(mg*frequency/weight):null):clean(mg/weight):null;
    let reason='';
    if(doseMode!=='units'&&mg===null)reason='Brak stężenia w mg/ml';
    else if(weighted&&(!positive(weight)||weight>500))reason='Uzupełnij poprawną masę';
    else if(doseMode==='perKgDay'&&!positive(frequency))reason='Wybierz częstotliwość';
    else if(source&&(source.doseMode!==doseMode||source.formIds&&!source.formIds.includes(form.id)))reason='Inny sposób przeliczenia';
    else if(source&&eligibility&&eligibility.valid!==true)reason='Sprawdź dane pacjenta';
    else if([...single,...daily,...perKg,...units].some(v=>!positive(v)))reason='Nieprawidłowy limit';
    else if(present(frequency)&&(!Number.isSafeInteger(frequency)||frequency<=0||frequency>48))reason='Sprawdź częstotliwość';
    else if(positive(frequency)&&(source?.frequencyOptions&&!source.frequencyOptions.includes(frequency)
      ||positive(source?.minIntervalHours)&&above(frequency*source.minIntervalHours,24)))reason='Sprawdź częstotliwość';
    else if(present(roundingStep)&&(!positive(roundingStep)||!equal(ml,Math.round(ml/roundingStep)*roundingStep)))reason='Zmień krok zaokrąglenia';
    // Missing/invalid inputs and ineligible contexts still prevent a shortcut.
    // A computable value outside the source remains selectable, like manual entry.
    const warnings=[];
    const warn=(code,severity,message)=>warnings.push({code,severity,message});
    if(!reason&&positive(value)) {
      if(source?.doseRange) {
        if(above(source.doseRange.min,value))warn('below-range','warning','Poniżej zakresu schematu');
        if(above(value,source.doseRange.max))warn('above-range','critical','Powyżej zakresu schematu');
      } else if(positive(source?.dose)) {
        if(above(source.dose,value))warn('below-source','warning','Poniżej dawki ze źródła');
        if(above(value,source.dose))warn('above-source','critical','Powyżej dawki ze źródła');
      }
      if(single.some(v=>mg!==null&&above(mg,v))
        ||positive(source?.maxUnitsPerDose)&&above(ml,source.maxUnitsPerDose)
        ||positive(weight)&&mg!==null&&positive(source?.maxSingleMgPerKg)&&above(mg/weight,source.maxSingleMgPerKg))
        warn('single-limit','critical','Ponad limit jednorazowy');
      if(positive(frequency)&&(daily.some(v=>mg!==null&&above(mg*frequency,v))
        ||positive(source?.maxDailyUnits)&&above(ml*frequency,source.maxDailyUnits)
        ||positive(weight)&&mg!==null&&positive(source?.maxDailyMgPerKg)&&above(mg*frequency/weight,source.maxDailyMgPerKg)))
        warn('daily-limit','critical','Ponad limit dobowy');
    }
    // A breached ceiling takes precedence over a simultaneous below-range warning.
    const primary=warnings.find(w=>w.severity==='critical')||warnings[0];
    return {ml,mg,value,allowed:!reason&&positive(value),reason:reason||primary?.message||'',
      severity:primary?.severity||null,warnings};
  });
}
export function liquidDoseChoicesMarkup(choices, {dose=null,unit='mg',basis=''}={}) {
  if(!choices.length)return '';
  const syringe='<svg viewBox="0 0 48 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10h25v12H8zM8 16H3m30-6v12m0-6h10m0-6v12M14 10v5m6-5v5m6-5v5"/></svg>';
  return `<div class="liquid-dose-heading">Szybki wybór objętości <span>na jedno podanie</span></div><div class="liquid-dose-choices" role="group" aria-label="Objętość zawiesiny na podanie">${choices.map(c=>{
    const selected=c.allowed&&equal(c.value,dose);
    const tone=c.allowed&&['warning','critical'].includes(c.severity)?c.severity:'';
    const messages=(c.warnings||[]).map(w=>w.message).join('. ');
    const label=`${n(c.ml)} ml${c.mg===null?'':` = ${n(c.mg,6)} mg ${basis}`}`;
    const detail=messages||c.reason;
    return `<button type="button" class="liquid-dose-choice ${selected?'active':''} ${tone?`liquid-dose-${tone}`:''}" data-action="liquid-dose" data-value="${c.ml}" aria-pressed="${selected}" ${c.allowed?'':'disabled'} title="${esc(label+(detail?`. ${detail}`:''))}">${selected?'<span class="liquid-dose-selected" aria-hidden="true">✓</span>':''}${syringe}<strong>${n(c.ml)} <small>ml</small></strong><span>${c.mg===null?'Objętość preparatu':`${n(c.mg,6)} mg`}</span>${!['mg','ml'].includes(unit)&&c.value!==null?`<small>${n(c.value,6)} ${esc(unit)}</small>`:''}<small class="liquid-dose-reason">${tone?'<span aria-hidden="true">⚠ </span>':''}${esc(c.reason)}</small></button>`;
  }).join('')}</div><p class="liquid-dose-help">${choices.some(c=>c.mg!==null)?`mg dotyczą ${esc(basis||'substancji głównej')}. `:''}Żółty: poniżej schematu; czerwony: powyżej schematu lub limitu. Skróty przeliczenia, nie zalecane dawki — kontrola kopiowania pozostaje aktywna.</p>`;
}
