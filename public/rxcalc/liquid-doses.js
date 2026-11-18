/** Volume shortcuts are arithmetic controls, not recommended patient doses.
 * `allowed` means the value can be entered, NOT that it complies with a source.
 * Range/ceiling deviations are advisory here; engine/export validation is unchanged.
 */
import { calculate, formatNumber as n } from './engine.js';
import { assessDoseRounding } from './rounding-assessment.js';
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
export function supportsLiquidDoseView(form, {doseMode='fixed',veterinary=false}={}) {
  return supportsLiquidChoices(form,veterinary)&&!form.unitOnly
    &&positive(form.concentrationMg)&&positive(form.concentrationMl)
    &&['fixed','perKgDay','perKgDose'].includes(doseMode);
}
/** Default once per source/product selection; manual presentation choice lives
 * in the app's UI state and is not recomputed from patient edits or tile colors. */
export function defaultLiquidDoseView(form, {source=null,doseMode='fixed',veterinary=false}={}) {
  const low=source?.doseRange?.min??source?.dose,high=source?.doseRange?.max??source?.dose;
  return supportsLiquidDoseView(form,{doseMode,veterinary})&&source?.doseMode===doseMode
    &&(!source.formIds||source.formIds.includes(form.id))&&positive(low)&&positive(high)&&low<=high
    ?'dose':'volume';
}
export function liquidDoseChoices(form, {doseMode='fixed',weight=null,frequency=null,
  source=null,maxSingleMg=null,maxDailyMg=null,roundingStep=null,veterinary=false,
  eligibility=null,adaptive=true,page=null,volumes=null,roundingContext=null,view=null,
  roundDoseChoices=false}={}) {
  if(!supportsLiquidChoices(form,veterinary)||source?.doseMode==='instruction'
    ||!['fixed','units','perKgDay','perKgDose'].includes(doseMode))return [];
  const concentration=positive(form.concentrationMg)&&positive(form.concentrationMl)
    ?form.concentrationMg/form.concentrationMl:null;
  const weighted=['perKgDay','perKgDose'].includes(doseMode);
  const single=[form.maxSingleMg,source?.maxSingleMg,maxSingleMg].filter(present);
  const daily=[form.maxDailyMg,source?.maxDailyMg,maxDailyMg].filter(present);
  const perKg=[source?.maxSingleMgPerKg,source?.maxDailyMgPerKg].filter(present);
  const units=[source?.maxUnitsPerDose,source?.maxDailyUnits].filter(present);
  const settings={doseMode,weight,frequency,source,maxSingleMg,maxDailyMg,roundingStep,veterinary,eligibility,adaptive,roundingContext,view,roundDoseChoices};
  const roundNominalDose=roundDoseChoices===true&&view==='dose'&&supportsLiquidDoseView(form,{doseMode,veterinary});
  const key=liquidShortcutKey(form,settings)+(roundNominalDose?':decimal-dose':'');
  // Dose tiles keep their nominal source anchors. Only their actual dispensed
  // quantities are rounded; volume tiles continue to use the selected grid.
  const window=adaptive?liquidShortcutWindow(form,{...settings,
    roundingStep:roundNominalDose?null:roundingStep,page:page??shortcutPage(key)}):null;
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
    else if(present(roundingStep)&&(!positive(roundingStep)
      ||!roundNominalDose&&!equal(ml,Math.round(ml/roundingStep)*roundingStep)))reason='Zmień krok zaokrąglenia';
    let roundedDose=null;
    if(!reason&&roundNominalDose&&positive(roundingStep)) {
      // Use the same arithmetic as the result, export and package calculations.
      // One day (and one administration if frequency is not needed for a dose
      // conversion) is only a preview input, never a treatment recommendation.
      const preview=calculate({form:form.form,unitLabel:'ml',doseMode,dose:value,weight,roundingStep,
        concentrationMg:form.concentrationMg,concentrationMl:form.concentrationMl,
        frequency:positive(frequency)?frequency:doseMode==='perKgDay'?null:1,
        days:1,packageSize:1});
      if(!positive(preview.singleUnits)||!positive(preview.singleMg)) {
        reason=preview.errors.some(message=>message.includes('zerową dawkę'))
          ?'Zaokrąglenie daje zerową dawkę':'Nie można przeliczyć zaokrąglenia';
      } else if(!equal(preview.singleUnits,ml)) {
        const actualValue=doseMode==='fixed'?preview.singleMg
          :clean(preview.singleMg*(doseMode==='perKgDay'?frequency:1)/weight);
        roundedDose={ml:preview.singleUnits,mg:preview.singleMg,value:actualValue,
          deltaPercent:preview.roundingDifferencePercent};
      }
    }
    const actual=roundedDose||{ml,mg,value};
    // Missing/invalid inputs and ineligible contexts still prevent a shortcut.
    // A computable value outside the source remains selectable, like manual entry.
    const warnings=[];
    const warn=(code,severity,message)=>warnings.push({code,severity,message});
    if(!reason&&positive(value)) {
      if(source?.doseRange) {
        if(above(source.doseRange.min,actual.value))warn('below-range','warning','Poniżej zakresu schematu');
        if(above(actual.value,source.doseRange.max))warn('above-range','critical','Powyżej zakresu schematu');
      } else if(positive(source?.dose)) {
        if(above(source.dose,actual.value))warn('below-source','warning','Poniżej dawki ze źródła');
        if(above(actual.value,source.dose))warn('above-source','critical','Powyżej dawki ze źródła');
      }
      if(single.some(v=>actual.mg!==null&&above(actual.mg,v))
        ||positive(source?.maxUnitsPerDose)&&above(actual.ml,source.maxUnitsPerDose)
        ||positive(weight)&&actual.mg!==null&&positive(source?.maxSingleMgPerKg)&&above(actual.mg/weight,source.maxSingleMgPerKg))
        warn('single-limit','critical','Ponad limit jednorazowy');
      if(positive(frequency)&&(daily.some(v=>actual.mg!==null&&above(actual.mg*frequency,v))
        ||positive(source?.maxDailyUnits)&&above(actual.ml*frequency,source.maxDailyUnits)
        ||positive(weight)&&actual.mg!==null&&positive(source?.maxDailyMgPerKg)&&above(actual.mg*frequency/weight,source.maxDailyMgPerKg)))
        warn('daily-limit','critical','Ponad limit dobowy');
      if(roundedDose)warn('decimal-rounding','warning','Zaokrąglenie do oceny');
    }
    const roundingAssessment=roundingContext&&!reason?assessDoseRounding({...roundingContext,context:{...roundingContext.context,dose:value}}):null;
    if(roundingAssessment&&['needs-review','reviewed'].includes(roundingAssessment.state)){
      // The independent-limit checks in the shared assessment have passed.
      // Replace only this exact conversion's source-target duplicate warnings.
      warnings.splice(0,warnings.length,{code:'rounding-review',severity:roundingAssessment.severity,message:roundingAssessment.label});
    }
    // A breached ceiling takes precedence over a simultaneous below-range warning.
    const primary=warnings.find(w=>w.severity==='critical')||warnings[0];
    const rounded=window?.roundingShortcut;
    const roundedShortcut=rounded&&equal(ml,rounded.ml)?rounded:null;
    return {ml,mg,value,allowed:!reason&&positive(value),reason:reason||primary?.message||'',
      severity:primary?.severity||null,warnings,roundingAssessment,
      ...(roundedDose?{roundedDose}:{}),...(roundedShortcut?{roundedShortcut}:{})};
  });
  if(window)Object.defineProperty(list,'browser',{value:{key,window,form,settings},enumerable:false});
  return list;
}
export function liquidDoseChoicesMarkup(choices, {dose=null,unit='mg',basis=''}={}) {
  if(!choices.length)return '';
  const browser=choices.browser,settings=browser?.settings;
  const explicitView=['dose','volume'].includes(settings?.view);
  const doseView=explicitView?settings.view==='dose':browser?.window.anchored&&browser.window.weighted;
  const canSwitch=explicitView&&supportsLiquidDoseView(browser.form,settings);
  // Keep missing smaller slots on the left, without changing DOM/tab order.
  const lowerEdge=choices.length<3 && browser?.window.canLower===false && browser.window.canHigher===true;
  const labelNumber=(v,d=4)=>`${Math.abs(v-Number(v.toFixed(d)))>1e-10?'≈ ':''}${n(v,d)}`;
  const navigation=browser?shortcutNavigation(browser.key,browser.window,()=>liquidDoseChoicesMarkup(
    liquidDoseChoices(browser.form,browser.settings),{dose,unit,basis})):'';
  const explanation=doseView&&settings?.roundDoseChoices===true&&positive(settings.roundingStep)
    ?'Nagłówek kafelka pokazuje dawkę przed zaokrągleniem. Poniżej pokazujemy wynikową objętość, ilość mg i zmianę.'
    :browser?.window.noGridValue?'Wybrany krok objętości nie odtwarza dokładnej dawki lub zakresu. Sąsiednie wartości nie są automatycznie akceptowanym zaokrągleniem.'
    :browser?.window.exact?'Objętości są przeliczeniem źródła, nie potwierdzoną podziałką strzykawki. Sprawdź możliwość odmierzenia; ≈ oznacza skrócony zapis, nie zmianę dawki.':'';
  const rounded=browser?.window.roundingShortcut;
  const roundingNote=rounded?roundedVolumeNote(rounded):'';
  const toggle=canSwitch?`<div class="liquid-dose-view" role="group" aria-label="Widok szybkiego wyboru">${[['dose','Dawka',unit],['volume','Objętość','ml']].map(([value,label,suffix])=>`<button type="button" data-action="liquid-dose-view" data-value="${value}" aria-pressed="${settings.view===value}" class="${settings.view===value?'active':''}">${label} <small>${esc(suffix)}</small></button>`).join('')}</div>`:'';
  const current=explicitView?currentDoseMarkup(browser,{dose,unit,basis,labelNumber}):'';
  const syringe='<svg viewBox="0 0 48 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10h25v12H8zM8 16H3m30-6v12m0-6h10m0-6v12M14 10v5m6-5v5m6-5v5"/></svg>';
  return `<div class="liquid-dose-heading">${doseView?'Szybki wybór dawki <span>w jednostce schematu</span>':'Szybki wybór objętości <span>na jedno podanie</span>'}</div>${toggle}${current}<div class="liquid-dose-choices" data-align="${lowerEdge?'end':'start'}" role="group" aria-label="${doseView?'Dawka w jednostce schematu':'Objętość zawiesiny na podanie'}">${choices.map(c=>{
    const selected=c.allowed&&equal(c.value,dose);
    const tone=c.allowed&&['warning','critical','reviewed'].includes(c.severity)?c.severity:'';
    const sourceDose=doseView&&c.allowed&&!tone&&positive(settings?.source?.dose)&&equal(c.value,settings.source.dose);
    const messages=(c.warnings||[]).map(w=>w.message).join('. ');
    const actual=c.roundedDose||c;
    const label=`${n(c.ml,10)} ml${c.mg===null?'':` = ${n(c.mg,6)} mg ${basis}`}${c.roundedDose?`; po zaokrągleniu ${n(actual.ml,6)} ml = ${n(actual.mg,6)} mg`:''}`;
    const detail=messages||c.reason;
    const roundedAmount=c.roundedDose?`<small class="liquid-rounded-label">Zmiana ${actual.deltaPercent>0?'+':''}${n(actual.deltaPercent,2)}%</small>`
      :c.roundedShortcut?`<small class="liquid-rounded-label">Zaokrąglenie +${n(c.roundedShortcut.deltaPercent,2)}%</small>`:'';
    return `<button type="button" class="liquid-dose-choice ${selected?'active':''} ${tone?`liquid-dose-${tone}`:''} ${sourceDose?'liquid-dose-source':''}" data-action="liquid-dose" data-value="${c.ml}" aria-pressed="${selected}" ${c.allowed?'':'disabled'} title="${esc(label+(detail?`. ${detail}`:''))}">${selected?'<span class="liquid-dose-selected" aria-hidden="true">✓</span>':''}${syringe}<strong>${doseView&&c.value!==null?labelNumber(c.value):labelNumber(c.ml)} <small>${doseView?esc(unit):'ml'}</small></strong>${doseView?`<span>${c.roundedDose?'Po zaokrągleniu: ':''}${labelNumber(actual.ml)} ml na podanie</span>`:''}${!doseView||unit!=='mg'||c.roundedDose?`<span>${actual.mg===null?'Objętość preparatu':`${n(actual.mg,6)} mg`}</span>`:''}${!doseView&&!['mg','ml'].includes(unit)&&c.value!==null?`<small>${n(c.value,6)} ${esc(unit)}</small>`:''}${roundedAmount}<small class="liquid-dose-reason">${tone?`<span aria-hidden="true">${tone==='reviewed'?'ℹ':'⚠'} </span>`:''}${esc(c.reason|| (sourceDose?'Dawka ze źródła':browser?.window.anchored&&c.allowed?'Liczbowo w schemacie':''))}</small></button>`;
  }).join('')}</div>${explicitView&&doseView&&browser.window.exact?'<p class="liquid-dose-measurement">Objętości są obliczone. Sprawdź możliwość odmierzenia.</p>':''}${navigation}${roundingNote}${explanation?`<p class="liquid-dose-help">${esc(explanation)}</p>`:''}<p class="liquid-dose-help">${choices.some(c=>c.mg!==null)?`mg dotyczą ${esc(basis||'substancji głównej')}. `:''}Żółty: poniżej schematu lub zaokrąglenie do oceny; niebieski: ocenione indywidualnie; czerwony: inne przekroczenie schematu lub limitu. Skróty przeliczenia, nie zalecane dawki — kontrola kopiowania pozostaje aktywna.</p>`;
}

/** A current value remains visible when it is outside the three shortcuts.
 * The engine supplies the actual volume/mg after an explicit rounding step;
 * changing views never substitutes a source target for that calculated amount.
 * One day and, for non-daily dose units, one administration are arithmetic-only
 * preview inputs. Neither is written back or presented as a treatment schedule. */
function currentDoseMarkup(browser,{dose,unit,labelNumber}) {
  if(!positive(dose))return '';
  const {form,settings}=browser;
  const {doseMode,weight,frequency,roundingStep,source,roundingContext}=settings;
  const preview=calculate({form:form.form,unitLabel:'ml',doseMode,dose,weight,roundingStep,
    concentrationMg:form.concentrationMg??null,concentrationMl:form.concentrationMl??null,
    frequency:Number.isSafeInteger(frequency)&&positive(frequency)?frequency:doseMode==='perKgDay'?null:1,
    days:1,packageSize:1});
  if(!positive(preview.singleUnits))return '';
  const assessment=roundingContext?assessDoseRounding({...roundingContext,
    context:{...roundingContext.context,dose}}):null;
  const changed=Number.isFinite(preview.roundingDifferencePercent)&&Math.abs(preview.roundingDifferencePercent)>1e-7;
  const delta=assessment?.deltaPercent??(source?.doseMode===doseMode&&positive(source.dose)&&!equal(dose,source.dose)
    ?(dose/source.dose-1)*100:null);
  const difference=Number.isFinite(delta)?`${assessment?'Zaokrąglenie':'Różnica względem źródła'} ${delta>0?'+':''}${n(delta,2)}%${assessment?` · ${assessment.label}`:''}`:'';
  const equivalent=`${labelNumber(preview.singleUnits,6)} ml${preview.singleMg===null?'':` · ${n(preview.singleMg,6)} mg`} na podanie`;
  return `<div class="liquid-dose-current"><span>Wpisana dawka: <strong>${labelNumber(dose,6)} ${esc(unit)}</strong></span><span>${changed?'Po zaokrągleniu: ':''}${equivalent}</span>${difference?`<small class="liquid-current-difference">${esc(difference)}</small>`:''}${changed?`<small class="liquid-current-difference">Zmiana przez krok zaokrąglenia: ${preview.roundingDifferencePercent>0?'+':''}${n(preview.roundingDifferencePercent,2)}%.</small>`:''}</div>`;
}

/** Keep evidence and exact arithmetic available without presenting this as a new
 * clinical regimen or widening the original comparison/copy limits. */
function roundedVolumeNote(p) {
  return `<div class="liquid-rounded-note"><p><strong>11 ml = 880 mg + 125,4 mg na podanie.</strong> Jawne zaokrąglenie: +${n(p.deltaPercent,2)}% amoksycyliny względem 875 mg. Dopiero kliknięcie kafelka zmienia dawkę.</p><details class="liquid-rounded-details"><summary>Zaokrąglenie i źródła</summary><p>Dokładne przeliczenie źródłowych 875 mg to 10,9375 ml. Kafelek wpisuje 880 mg, nie 875 mg; oba składniki i dawki dobowe są liczone z 11 ml. Użyj urządzenia pozwalającego odmierzyć wybraną objętość.</p><p>HSE opisuje 11 ml jako zamianę tabletki 875/125 mg u osób z trudnością połykania (off-label), w wytycznych dotyczących zapalenia płuc w placówkach opieki. Cleveland Clinic dokumentuje taką zamianę w standardzie instytucjonalnym z 2020 r. Nie jest to nowy schemat stomatologiczny z polskiej ChPL ani ogólna tolerancja zaokrąglania.</p><p>Oryginalne 875 mg pozostaje punktem odniesienia. Dla 11 ml wymagana jest odrębna indywidualna ocena lekarza i potwierdzenie możliwości odmierzenia. Nie ma automatycznej tolerancji procentowej ani automatycznie zweryfikowanej reguły stomatologicznej. Niezależne limity nadal blokują zatwierdzenie. Bez oceny zaokrąglenia i końcowego potwierdzenia kopiowanie pozostaje niedostępne.</p>${p.references.map(r=>`<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.label)} ↗</a>`).join('')}<small>Źródła sprawdzone: ${esc(p.checkedAt)}.</small></details></div>`;
}
