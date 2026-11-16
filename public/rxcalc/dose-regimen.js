import { formatNumber as n } from './engine.js';

const positive = v => typeof v === 'number' && Number.isFinite(v) && v > 0;
const near = (a,b) => Math.abs(a-b) <= Number.EPSILON*64*Math.max(1,Math.abs(a),Math.abs(b));
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const frequency = v => Number.isInteger(v) && v > 0 && v <= 48;

/** Display metadata only. Never changes the source, the entered dose, or the
 * engine's limits. Source frequencies stay fixed even after a user override.
 * A variable frequency must be explicitly chosen from the source's options.
 */
export function regimenComparisonRows({source, input={}, ingredients=[], weight=null, limit=null}={}) {
  if (!source || input.patientKind==='animal' || source.doseMode==='instruction') return null;
  const primary=ingredients.find(i=>i.index===0);
  if (!primary || !positive(primary.amount) || !positive(primary.perMl)) return null;
  const low=source.doseRange?.min ?? source.dose;
  const high=source.doseRange?.max ?? source.dose;
  if (!positive(low) || !positive(high) || low>high) return null;
  const perKg=['perKgDay','perKgDose'].includes(source.doseMode);
  const knownWeight=positive(weight)?weight:null;
  const times=frequency(source.frequency)?source.frequency
    :source.frequencyOptions?.includes(input.frequency)&&frequency(input.frequency)?input.frequency:null;
  if (times===null) return null;
  const factor=source.doseMode==='perKgDay'?1
    :['fixed','perKgDose'].includes(source.doseMode)?times
    :source.doseMode==='units'?times*primary.amount/primary.perMl:null;
  if (!positive(factor) || (source.doseMode!=='units' && primary.unit!=='mg')) return null;
  let minimum=source.asNeeded?0:low*factor;
  let maximum=high*factor;
  if (!Number.isFinite(maximum)) return null;
  const limits=[];
  const add=(value,kind,unitPerKg=false)=>{
    if(!positive(value))return;
    const normalized=unitPerKg===perKg?value
      :knownWeight!==null?(perKg?value/knownWeight:value*knownWeight):null;
    limits.push({value:normalized,kind,daily:unitPerKg?(knownWeight===null?null:value*knownWeight):value});
  };
  if(primary.unit==='mg') {
    add(source.maxDailyMg,'source');
    add(source.maxDailyMgPerKg,'source',true);
  }
  add(positive(source.maxDailyUnits)?source.maxDailyUnits*primary.amount/primary.perMl:null,'source');
  // Do not invent a compulsory daily minimum for as-needed treatments.
  const sourceCaps=limits.filter(l=>positive(l.value)).map(l=>l.value);
  if(source.asNeeded && sourceCaps.length) maximum=Math.min(maximum,...sourceCaps);
  if(primary.unit==='mg') add(limit?.daily,limit?.kind==='manual'?'manual':'catalogue');
  const comparable=limits.filter(l=>positive(l.value)).sort((a,b)=>a.value-b.value || (a.kind==='manual'?-1:b.kind==='manual'?1:0));
  const chosen=limits.find(l=>l.kind==='manual'&&!positive(l.value)&&positive(l.daily)) || comparable[0] || null;
  // A source ceiling identical to the range endpoint is not a second maximum.
  const extra=chosen && (!near(chosen.value,maximum) || chosen.kind==='manual')?chosen:null;
  return ingredients.map(i=>{
    const ratio=i.amount*primary.perMl/(primary.amount*i.perMl);
    if(!positive(ratio))return null;
    return {
      minimum:minimum*ratio,maximum:maximum*ratio,perKg,
      dailyMin:perKg?(knownWeight===null?null:minimum*knownWeight*ratio):minimum*ratio,
      dailyMax:perKg?(knownWeight===null?null:maximum*knownWeight*ratio):maximum*ratio,
      kind:source.asNeeded?'asNeeded':near(minimum,maximum)?'fixed':'range',
      frequency:times,derived:i.index>0,
      limit:extra?{value:positive(extra.value)?extra.value*ratio:null,daily:positive(extra.daily)?extra.daily*ratio:null,kind:extra.kind}:null,
    };
  });
}

export function regimenMeterModel(row, scheme, allowed=true) {
  if(!scheme || !positive(scheme.maximum) || !Number.isFinite(scheme.minimum) || scheme.minimum<0 || scheme.minimum>scheme.maximum)return null;
  const value=scheme.perKg?row.perKg:row.daily;
  const cap=positive(scheme.limit?.value)?scheme.limit.value:null;
  const scale=Math.max(scheme.maximum,cap||0)*1.25;
  const position=v=>v/scale*100;
  let state=!allowed?'unconfirmed':!positive(value)?'pending'
    :near(value,scheme.maximum)?(scheme.kind==='fixed'?'same':'upper')
    :value>scheme.maximum?'above':value<scheme.minimum&&!near(value,scheme.minimum)?'below':'within';
  const limitExceeded=allowed&&positive(value)&&cap!==null&&value>cap&&!near(value,cap);
  const comparable=!['unconfirmed','pending'].includes(state);
  return {state,value:comparable?value:null,limitExceeded,scale,
    start:position(scheme.minimum),end:position(scheme.maximum),
    wall:cap===null?null:position(cap),fill:comparable?Math.min(100,position(value)):null,
    clipped:comparable&&value>scale,sharedWall:cap!==null&&near(cap,scheme.maximum),
  };
}

/** All percentages have one denominator: the unchanged upper source endpoint.
 * A separate cap is never silently promoted to 100%. Rendering precision is
 * independent from arithmetic; values just below/above 100 never round to 100.
 */
export function regimenPercentModel(row, scheme, allowed=true) {
  const meter=regimenMeterModel(row,scheme,allowed);
  if(!meter || !allowed)return null;
  const percent=value=>{
    if(typeof value!=='number'||!Number.isFinite(value)||value<0)return null;
    const result=near(value,scheme.maximum)?100:value/scheme.maximum*100;
    return Number.isFinite(result)?result:null;
  };
  return {
    current:meter.value===null?null:percent(meter.value),
    start:percent(scheme.minimum),end:100,
    limit:positive(scheme.limit?.value)?percent(scheme.limit.value):null,
    scale:percent(meter.scale),
  };
}

export function formatRegimenPercent(value) {
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)return '—';
  if(value>0&&value<.1)return '<0,1';
  if(value>99.9&&value<100)return '>99,9';
  if(value>100&&value<100.1)return '>100';
  return n(value,1);
}
const percentBasis=scheme=>scheme.kind==='fixed'?'dawki dobowej schematu'
  :scheme.kind==='asNeeded'?'pułapu dobowego schematu':'górnej granicy schematu';

export function regimenDosePercentMarkup(row,scheme,allowed=true,roundingAssessment=null) {
  const percentages=regimenPercentModel(row,scheme,allowed);
  if(percentages?.current==null)return '';
  const meter=regimenMeterModel(row,scheme,allowed);
  return `<span class="dose-scheme-current ${roundingAssessment&&allowed&&!meter.limitExceeded?['needs-review','reviewed'].includes(roundingAssessment.state)?roundingAssessment.state:meter.state:meter.state} ${meter.limitExceeded?'limit-exceeded':''}"><b>${esc(formatRegimenPercent(percentages.current))}%</b><small>${esc(percentBasis(scheme))}</small></span>`;
}

function percentTicks(scheme,model,percentages) {
  if(!percentages)return '';
  const tick=(position,text,label)=>`<span class="dose-scheme-tick" style="left:clamp(38px,${position}%,calc(100% - 38px))"><b>${esc(text)}%</b><small>${esc(label)}</small></span>`;
  const endLabel=scheme.kind==='fixed'?'Dawka schematu':'Górna granica';
  // Narrow source ranges get one combined annotation, not overlapping labels.
  const content=scheme.kind==='range'&&model.end-model.start<28
    ?tick((model.start+model.end)/2,`${formatRegimenPercent(percentages.start)}–100`,'Zakres schematu')
    :(scheme.kind==='range'?tick(model.start,formatRegimenPercent(percentages.start),'Początek zakresu'):'')+tick(model.end,'100',endLabel);
  return `<div class="dose-scheme-ticks" aria-hidden="true">${content}</div>`;
}

const amount=(min,max,unit,kind)=>`${kind==='asNeeded'?'do ':''}${kind==='range'?`${n(min,4)}–`:''}${n(max,4)} ${unit}`;
const delta=(value,reference)=>Math.abs(value-reference)/reference*100<.01?'<0,01':n(Math.abs(value-reference)/reference*100,2);

/** A source band is not a target or a safe zone. Solid limits are separate and
 * explicitly named; companion-ingredient values are proportional, not maxima. */
export function regimenMeterMarkup(row, scheme, allowed=true,roundingAssessment=null) {
  const model=regimenMeterModel(row,scheme,allowed);
  if(!model)return '';
  const unit=`${row.unit}/${scheme.perKg?'kg/':''}dobę`;
  const percentages=regimenPercentModel(row,scheme,allowed);
  const label=scheme.derived?'Ilość odpowiadająca schematowi'
    :scheme.kind==='fixed'?'Dawka dobowa wybranego schematu'
    :scheme.kind==='asNeeded'?'Zakres dobowy przy stosowaniu doraźnym':'Zakres wybranego schematu';
  const range=amount(scheme.minimum,scheme.maximum,unit,scheme.kind);
  const equivalent=scheme.perKg&&scheme.dailyMax!==null?`<small>${esc(amount(scheme.dailyMin,scheme.dailyMax,`${row.unit}/dobę`,scheme.kind))}</small>`:'';
  const limitLabel=scheme.limit?.kind==='manual'?'Limit wpisany przez lekarza'
    :scheme.limit?.kind==='source'?'Limit dobowy ze źródła':'Limit z danych preparatu';
  const limitValue=positive(scheme.limit?.value)?`${n(scheme.limit.value,4)} ${unit}`
    :positive(scheme.limit?.daily)?`${n(scheme.limit.daily,4)} ${row.unit}/dobę`:'';
  const limitPercent=percentages?.limit==null?'':`<small>${esc(formatRegimenPercent(percentages.limit))}% ${esc(percentBasis(scheme))}</small>`;
  const extra=scheme.limit?`<div class="dose-scheme-values limit"><span>${scheme.derived?'Ilość przy limicie składnika głównego':esc(limitLabel)}</span><strong>${esc(limitValue)}${limitPercent}</strong></div>${model.sharedWall?'<p class="dose-scheme-small">Limit pokrywa się z górną granicą schematu — wspólna kreska.</p>':''}`:'';
  let status=model.state==='unconfirmed'?'Warunki porównania niepotwierdzone'
    :model.state==='pending'?'Uzupełnij dawkę, częstotliwość i wymagane dane'
    :model.state==='same'?'Taka sama ilość dobowa jak w schemacie'
    :model.state==='upper'?'Na górnej granicy wybranego schematu'
    :model.state==='above'?`Powyżej ${scheme.kind==='fixed'?'dawki dobowej':'górnej granicy'} schematu o ${delta(model.value,scheme.maximum)}%`
    :model.state==='below'?`Poniżej ${scheme.kind==='fixed'?'dawki dobowej':'dolnej granicy'} schematu`
    :scheme.kind==='asNeeded'?'Nie przekracza zakresu dobowego; stosowanie doraźne':'Dobowo w zakresie wybranego schematu';
  if(roundingAssessment&&allowed&&model.value!==null&&!model.limitExceeded&&['needs-review','reviewed'].includes(roundingAssessment.state))status=`${roundingAssessment.label} · +${n(roundingAssessment.deltaPercent,2)}% względem dawki źródłowej`;
  const tone=roundingAssessment&&allowed&&!model.limitExceeded&&['needs-review','reviewed'].includes(roundingAssessment.state)?roundingAssessment.state:model.state;
  if(model.limitExceeded)status+=' · Przekroczony dodatkowy limit';
  const scaled=allowed;
  const sourceMarkers=scheme.kind==='range'
    ?`<span class="dose-scheme-band" style="left:${model.start}%;width:${model.end-model.start}%"></span><span class="dose-scheme-marker" style="left:${model.start}%"></span>`:'';
  const percentDescription=percentages?` Wartość 100% jest odniesieniem do ${percentBasis(scheme)}. ${scheme.kind==='range'?`Początek zakresu: ${formatRegimenPercent(percentages.start)}%. `:''}${percentages.current===null?'':`Wpisana dawka: ${formatRegimenPercent(percentages.current)}%. `}${percentages.limit===null?'':`${limitLabel}: ${formatRegimenPercent(percentages.limit)}%. `}Koniec skali: ${formatRegimenPercent(percentages.scale)}%; nie jest limitem dawki.`:'';
  const graphicLabel=`${row.name}. ${label}: ${range}. ${scheme.limit?`${limitLabel}: ${limitValue}. `:''}${status}.${model.value!==null?` Wpisana ilość: ${n(model.value,6)} ${unit}.`:''}${percentDescription}`;
  const graphic=`${percentTicks(scheme,model,percentages)}<div class="dose-scheme-meter ${scaled?'':'unscaled'} ${tone} ${model.limitExceeded?'limit-exceeded':''}" role="img" aria-label="${esc(graphicLabel)}"><span class="dose-scheme-track"></span>${scaled?`${sourceMarkers}${model.fill===null?'':`<span class="dose-scheme-fill" style="width:${model.fill}%"></span>`}<span class="dose-scheme-marker" style="left:${model.end}%"></span>${model.wall===null?'':`<span class="dose-scheme-wall" style="left:${model.wall}%"></span>`}${model.clipped?'<span class="dose-scheme-overflow">›</span>':''}`:''}</div>`;
  const axis=percentages?`<div class="dose-scheme-axis dose-scheme-percent-axis"><span>0%</span><span><b>${esc(formatRegimenPercent(percentages.scale))}%</b><small>Koniec skali · nie limit</small></span></div>`:'';
  const derived=scheme.derived?'<p class="dose-safety-derived">Z proporcji składników preparatu — nie jest to niezależne maksimum tej substancji.</p>':'';
  return `<div class="dose-scheme-values"><span>${esc(label)}</span><strong>${esc(range)}${equivalent}</strong></div>${extra}${graphic}${axis}<div class="dose-scheme-status ${tone} ${model.limitExceeded?'limit-exceeded':''}">${esc(status)}</div>${model.clipped?'<p class="dose-scheme-small">Wartość wykracza poza skalę paska; pełna dawka jest podana powyżej.</p>':''}${derived}`;
}

export function regimenLegendMarkup(schemes) {
  const rows=(schemes||[]).filter(Boolean);
  if(!rows.length)return '';
  const hasLimit=rows.some(r=>r.limit);
  const hasRange=rows.some(r=>r.kind==='range');
  return `<div class="dose-scheme-legend"><span><i class="legend-fill"></i>Wpisana dawka</span><span><i class="legend-range"></i>${hasRange?'Zakres':'Dawka'} schematu</span>${hasLimit?'<span><i class="legend-limit"></i>Dodatkowy limit</span>':''}</div><p class="dose-scheme-caption">${rows[0].kind==='asNeeded'?'Doraźnie — brak wymaganej dawki minimalnej na dobę. ':''}Częstość ze źródła: ${rows[0].kind==='asNeeded'?'do ':''}${n(rows[0].frequency)} ×/dobę. Przerywane kreski nie są progami toksyczności.${hasLimit?'':' Nie wyznaczono osobnego maksimum poza schematem.'}</p>`;
}
