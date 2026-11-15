/** Volume shortcuts are arithmetic controls, not recommended patient doses.
 * `allowed` means the value can be entered, NOT that it complies with a source.
 * Range/ceiling deviations are advisory here; engine/export validation is unchanged.
 */
import { formatNumber as n } from './engine.js';
import { liquidShortcutWindow, liquidShortcutKey } from './adaptive-dose-choices.js';
import { shortcutPage, shortcutNavigation } from './shortcut-browser.js';
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
  eligibility=null,adaptive=true,page=null,volumes=null}={}) {
  if(!supportsLiquidChoices(form,veterinary)||source?.doseMode==='instruction'
    ||!['fixed','units','perKgDay','perKgDose'].includes(doseMode))return [];
  const concentration=positive(form.concentrationMg)&&positive(form.concentrationMl)
    ?form.concentrationMg/form.concentrationMl:null;
  const weighted=['perKgDay','perKgDose'].includes(doseMode);
  const single=[form.maxSingleMg,source?.maxSingleMg,maxSingleMg].filter(present);
  const daily=[form.maxDailyMg,source?.maxDailyMg,maxDailyMg].filter(present);
  const perKg=[source?.maxSingleMgPerKg,source?.maxDailyMgPerKg].filter(present);
  const units=[source?.maxUnitsPerDose,source?.maxDailyUnits].filter(present);
  const settings={doseMode,weight,frequency,source,maxSingleMg,maxDailyMg,roundingStep,veterinary,eligibility,adaptive};
  const key=liquidShortcutKey(form,settings);
  const window=adaptive?liquidShortcutWindow(form,{...settings,page:page??shortcutPage(key)}):null;
  const list=(volumes||window?.volumes||[2.5,5,10]).map(ml=>{
    const mg=concentration===null?null:clean(ml*concentration);
    const value=doseMode==='units'?ml:doseMode==='fixed'?mg
      :positive(weight)&&weight<=500&&mg!==null
        ?doseMode==='perKgDay'?(positive(frequency)?clean(mg*frequency/weight):null):clean(mg/weight):null;
    let reason='';
    if(doseMode!=='units'&&mg===null)reason='Brak stężenia w mg/ml';
    else if(weighted&&(!positive(weight)||weight>500))reason='Uzupełnij poprawną masę';
    else if(doseMode==='perKgDay'&&!positive(frequency))reason='Wybierz częstotliwość';
    else if(!positive(value)||value>1e6)reason='Wartość poza zakresem technicznym';
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
    const rounded=window?.roundingShortcut;
    const roundedShortcut=rounded&&equal(ml,rounded.ml)?rounded:null;
    return {ml,mg,value,allowed:!reason&&positive(value),reason:reason||primary?.message||'',
      severity:primary?.severity||null,warnings,...(roundedShortcut?{roundedShortcut}:{})};
  });
  if(window)Object.defineProperty(list,'browser',{value:{key,window,form,settings},enumerable:false});
  return list;
}
export function liquidDoseChoicesMarkup(choices, {dose=null,unit='mg',basis=''}={}) {
  if(!choices.length)return '';
  const browser=choices.browser,weighted=browser?.window.anchored&&browser.window.weighted;
  const labelNumber=(v,d=4)=>`${Math.abs(v-Number(v.toFixed(d)))>1e-10?'≈ ':''}${n(v,d)}`;
  const navigation=browser?shortcutNavigation(browser.key,browser.window,()=>liquidDoseChoicesMarkup(
    liquidDoseChoices(browser.form,browser.settings),{dose,unit,basis})):'';
  const explanation=browser?.window.noGridValue?'Wybrany krok objętości nie odtwarza dokładnej dawki lub zakresu. Sąsiednie wartości nie są automatycznie akceptowanym zaokrągleniem.'
    :browser?.window.exact?'Objętości są przeliczeniem źródła, nie potwierdzoną podziałką strzykawki. Sprawdź możliwość odmierzenia; ≈ oznacza skrócony zapis, nie zmianę dawki.':'';
  const rounded=browser?.window.roundingShortcut;
  const roundingNote=rounded?roundedVolumeNote(rounded):'';
  const syringe='<svg viewBox="0 0 48 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10h25v12H8zM8 16H3m30-6v12m0-6h10m0-6v12M14 10v5m6-5v5m6-5v5"/></svg>';
  return `<div class="liquid-dose-heading">${weighted?'Szybki wybór dawki <span>w jednostce schematu</span>':'Szybki wybór objętości <span>na jedno podanie</span>'}</div><div class="liquid-dose-choices" role="group" aria-label="Objętość zawiesiny na podanie">${choices.map(c=>{
    const selected=c.allowed&&equal(c.value,dose);
    const tone=c.allowed&&['warning','critical'].includes(c.severity)?c.severity:'';
    const messages=(c.warnings||[]).map(w=>w.message).join('. ');
    const label=`${n(c.ml)} ml${c.mg===null?'':` = ${n(c.mg,6)} mg ${basis}`}`;
    const detail=messages||c.reason;
    const roundedAmount=c.roundedShortcut?`<small class="liquid-rounded-label">Zaokrąglenie +${n(c.roundedShortcut.deltaPercent,2)}%</small>`:'';
    return `<button type="button" class="liquid-dose-choice ${selected?'active':''} ${tone?`liquid-dose-${tone}`:''}" data-action="liquid-dose" data-value="${c.ml}" aria-pressed="${selected}" ${c.allowed?'':'disabled'} title="${esc(label+(detail?`. ${detail}`:''))}">${selected?'<span class="liquid-dose-selected" aria-hidden="true">✓</span>':''}${syringe}<strong>${weighted&&c.value!==null?labelNumber(c.value):labelNumber(c.ml)} <small>${weighted?esc(unit):'ml'}</small></strong>${weighted?`<span>${labelNumber(c.ml)} ml na podanie</span>`:''}<span>${c.mg===null?'Objętość preparatu':`${n(c.mg,6)} mg`}</span>${!weighted&&!['mg','ml'].includes(unit)&&c.value!==null?`<small>${n(c.value,6)} ${esc(unit)}</small>`:''}${roundedAmount}<small class="liquid-dose-reason">${tone?'<span aria-hidden="true">⚠ </span>':''}${esc(c.reason|| (browser?.window.anchored&&c.allowed?'Liczbowo w schemacie':''))}</small></button>`;
  }).join('')}</div>${navigation}${roundingNote}${explanation?`<p class="liquid-dose-help">${esc(explanation)}</p>`:''}<p class="liquid-dose-help">${choices.some(c=>c.mg!==null)?`mg dotyczą ${esc(basis||'substancji głównej')}. `:''}Żółty: poniżej schematu; czerwony: powyżej schematu lub limitu. Skróty przeliczenia, nie zalecane dawki — kontrola kopiowania pozostaje aktywna.</p>`;
}

/** Keep evidence and exact arithmetic available without presenting this as a new
 * clinical regimen or widening the original comparison/copy limits. */
function roundedVolumeNote(p) {
  return `<div class="liquid-rounded-note"><p><strong>11 ml = 880 mg + 125,4 mg na podanie.</strong> Jawne zaokrąglenie: +${n(p.deltaPercent,2)}% amoksycyliny względem 875 mg. Dopiero kliknięcie kafelka zmienia dawkę.</p><details class="liquid-rounded-details"><summary>Zaokrąglenie i źródła</summary><p>Dokładne przeliczenie źródłowych 875 mg to 10,9375 ml. Kafelek wpisuje 880 mg, nie 875 mg; oba składniki i dawki dobowe są liczone z 11 ml. Użyj urządzenia pozwalającego odmierzyć wybraną objętość.</p><p>HSE opisuje 11 ml jako zamianę tabletki 875/125 mg u osób z trudnością połykania (off-label), w wytycznych dotyczących zapalenia płuc w placówkach opieki. Cleveland Clinic dokumentuje taką zamianę w standardzie instytucjonalnym z 2020 r. Nie jest to nowy schemat stomatologiczny z polskiej ChPL ani ogólna tolerancja zaokrąglania.</p><p>Oryginalne 875 mg i limity schematu pozostają bez zmian. 880 mg nadal przekracza jego granicę liczbową; wybór kafelka nie znosi ostrzeżeń ani blokady kopiowania niezgodnego wyniku.</p>${p.references.map(r=>`<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.label)} ↗</a>`).join('')}<small>Źródła sprawdzone: ${esc(p.checkedAt)}.</small></details></div>`;
}
