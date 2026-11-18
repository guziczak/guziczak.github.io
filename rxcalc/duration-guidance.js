import { supplementaryDurationReference } from './duration-reference.js';
import { assessDurationRegimen } from './duration-regimen.js';
import { resolveHumanRegimen } from './human-regimen-engine.js';
import { resolveRegimen } from './regimen-engine.js';
import { auditedDurationPolicy, DURATION_REVIEW_DATE } from './duration-rules.js';
import { reviewedDurationSources } from './duration-source-review.js';

/** One regimen-aware duration assessment for entry, shortcuts and result warnings.
 * No mutation of treatment, catalogue constraints, rounding review or exports.
 */
const positiveDay=v=>Number.isSafeInteger(v)&&v>0&&v<=3660;
const has=v=>v!==null&&v!==undefined&&v!=='';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const httpUrl=v=>typeof v==='string'&&/^https:\/\/[^\s]+$/.test(v);
const rangeLabel=r=>r.fixed?`${r.minimum} dni`:r.minimum&&r.maximum?`${r.minimum}–${r.maximum} dni`:r.minimum?`od ${r.minimum} dni`:r.maximum?`do ${r.maximum} dni`:'';

export function durationPatientEligibility(source,context={}) {
  if(!source||context.custom||context.calculationBlocked)return false;
  const veterinary=context.specialty==='veterinary';
  if(veterinary!==Array.isArray(source.species))return false;
  const sample={...context,dose:source.dose??source.doseRange?.min??null,
    frequency:source.frequency??source.frequencyOptions?.[0]??null,
    days:source.fixedDays??source.minDays??1};
  return (veterinary?resolveRegimen(source,sample):resolveHumanRegimen(source,sample)).valid;
}
function sdcepPatientScope(c) {
  if(!has(c.age))return c.patientType==='adult';
  if(!finite(c.age)||c.age<0)return false;
  const months=c.ageUnit==='years'?c.age*12:c.ageUnit==='months'?c.age:c.ageUnit==='days'?c.age/31:null;
  return months!==null&&(c.patientType==='adult'?months>=216:c.patientType==='child'&&months>=6);
}
export function resolveDurationGuidance({source=null,form=null,context={}}={}) {
  const neutral=(reason,coverage='unverified',rule=null)=>({applicable:false,coverage,rule,reason});
  if(!source)return neutral('Wybierz schemat, aby ocenić czas. W trybie ręcznym przyciski są tylko skrótami wpisywania.','manual');
  if(!form||context.custom||form.referenceOnly||form.calculationBlocked||context.calculationBlocked||!source.formIds?.includes(form.id))
    return neutral('Brak dopasowanego źródła czasu dla tej postaci lub trybu.','not-applicable');
  const audit=auditedDurationPolicy(source);
  if(audit.status!=='reviewed')return neutral(audit.status==='changed'
    ?'Dane schematu zmieniły się od przeglądu czasu. Wymagana ponowna weryfikacja; skróty bez oceny.'
    :'Odniesienie do czasu tego schematu nie zostało jeszcze zweryfikowane. Skróty bez oceny.',audit.status);
  const p=audit.policy;
  const rule={...p,id:p.origin==='external'?'sdcep-amoxicillin-dental-abscess-duration':`duration:${source.id}`,
    origin:p.origin||'source',minimum:p.minimum??null,maximum:p.maximum??null,
    fixed:['fixed','single','stage'].includes(p.kind),hardMaximum:!!p.hardMaximum,
    reviewAfterDays:p.reviewAfterDays??null,reviewMode:p.reviewMode||null,
    label:p.label||source.sourceLabel,url:p.url||source.sourceUrl,section:p.section||source.sourceSection,
    checkedAt:DURATION_REVIEW_DATE,indication:source.indication,
    primarySourceUrl:source.sourceUrl,primarySourceLabel:source.sourceLabel};
  const keys=['minimum','maximum','reviewAfterDays'];
  if(keys.some(k=>has(rule[k])&&!positiveDay(rule[k]))||!httpUrl(rule.url)||!rule.label||rule.minimum&&rule.maximum&&rule.minimum>rule.maximum)
    return neutral('Niespójne dane odniesienia do czasu — ocena wstrzymana.','invalid');
  if(!durationPatientEligibility(source,{...context,formId:form.id}))
    return neutral('Źródło czasu sprawdzone. Uzupełnij lub sprawdź dane pacjenta; kolorowa ocena jest wstrzymana.','reviewed',rule);
  if(rule.origin==='external'&&!sdcepPatientScope(context))return neutral('Brak potwierdzonego zakresu wieku dla odniesienia SDCEP (tabela dziecięca od 6 miesięcy).','reviewed',rule);
  const guidance={applicable:true,coverage:'reviewed',rule,reason:''};
  const reference=supplementaryDurationReference({source,form,context,guidance});
  const regimen=assessDurationRegimen({source,form,context,rule,reference});
  // Additional reviewed sources explain scope; they never supply evaluator thresholds.
  const sourceReview=reviewedDurationSources(source.id);
  return {...guidance,regimen,...(reference?{reference}:{}),...(sourceReview?{sourceReview}:{})};
}
function assessRuleDuration(value,guidance) {
  const blank=!has(value)||typeof value==='string'&&!value.trim();
  if(blank)return {state:'pending',tone:'neutral',short:'',message:'Wybierz czas; żadna liczba dni nie jest ustawiana automatycznie.'};
  const days=typeof value==='number'?value:Number(String(value).trim().replace(',','.'));
  if(!positiveDay(days))return {state:'invalid',tone:'critical',short:'Nieprawidłowy czas',message:'Podaj całkowitą liczbę dni od 1 do 3660.'};
  if(!guidance?.applicable||!guidance.rule)return {state:'unassessed',tone:'neutral',short:'',message:guidance?.reason||'Odniesienie do czasu nie zostało zweryfikowane.'};
  const r=guidance.rule,externalName=r.organization||'SDCEP',origin=r.origin==='external'?`w ${externalName}`:'w źródle';
  if(r.minimum&&days<r.minimum)return {state:'below',tone:'warning',short:'Krócej',message:`Krócej niż ${rangeLabel(r)} ${origin} — wymaga indywidualnej oceny.`};
  if(r.maximum&&days>r.maximum)return {state:'above',tone:r.hardMaximum?'critical':'warning',short:r.hardMaximum?'Ponad zakres':'Dłużej',
    message:r.hardMaximum?`Przekroczony czas wybranego ${r.kind==='stage'?'etapu':'schematu'}: ${r.maximum} dni. To nie jest uniwersalny limit leku.`
      :r.reviewMode==='extension'?r.reviewText:`Dłużej niż ${rangeLabel(r)} ${origin} — wymaga indywidualnej oceny.`};
  if(r.reviewAfterDays&&days>r.reviewAfterDays&&r.origin!=='external')return {state:'review',tone:'warning',short:r.reviewMode==='conditional'?'Oceń objawy':'Ocena',message:r.reviewText};
  if(r.minimum&&r.maximum)return {state:'within',tone:'within',short:r.kind==='single'?'Jednorazowo':r.fixed?'Ze źródła':r.organization?'W zakresie czasu':'W zakresie',
    message:r.kind==='single'?'Jednorazowe podanie w wybranym schemacie; nie oznacza codziennego powtarzania.'
      :`Czas ${r.kind==='stage'?'wybranego etapu':r.fixed?'wybranego schematu':`w zakresie ${rangeLabel(r)}`}${r.origin==='external'?` według ${externalName}`:' ze źródła'}. Ocena dotyczy tylko czasu, nie całego leczenia.`};
  const noRange={
    individual:'Źródło sprawdzone: nie określa pełnego zakresu dni dla tego wskazania. Czas ustala lekarz.',
    procedural:'Czas i kolejność zabiegów ustala lekarz; nie jest to zwykła kuracja wyznaczana liczbą dni.',
    routine:'Źródło opisuje codzienną higienę, nie skończoną kurację. Podany okres nie oznacza zalecenia zakończenia stosowania.',
    chronic:'Leczenie przewlekłe: podany okres służy planowaniu zapasu, nie jest automatycznym terminem odstawienia.',
    response:'Kontynuacja zależy od odpowiedzi na leczenie. Warunki oceny opisano poniżej; brak pełnego zakresu dni.',
    'as-needed':'Doraźnie — brak obowiązkowej liczby dni. Termin konsultacji nie wyznacza długości kuracji.',
    maximum:'Źródło określa tylko górne ograniczenie czasu. Wynik poniżej niego nie potwierdza zalecanej długości kuracji.',
    'review-only':'Źródło sprawdzone: określa warunek kontroli, nie pełny zalecany zakres dni.',
  };
  return {state:'unassessed',tone:'neutral',short:'',message:noRange[r.kind]||'Źródło nie określa pełnego zalecanego zakresu dni.'};
}
/** Time-only comparison for presentation. Primary-source restrictions retain
 * precedence; this does not replace the complete-regimen assessment below. */
export function assessDurationTime(value,guidance) {
  const primary=assessRuleDuration(value,guidance);
  if(!guidance?.applicable||!guidance.reference||['pending','invalid'].includes(primary.state))return primary;
  const comparison=assessRuleDuration(value,{...guidance,rule:guidance.reference});
  if(['below','above','review'].includes(primary.state)) {
    const main=primary.tone==='critical'||['within','neutral'].includes(comparison.tone)?primary:comparison;
    return {...main,message:[comparison.message,primary.message].filter(Boolean).join(' '),sourceState:primary.state};
  }
  return {...comparison,sourceState:primary.state};
}
export function assessDuration(value,guidance) {
  const time=assessDurationTime(value,guidance);
  if(!guidance?.applicable||['pending','invalid','unassessed'].includes(time.state))return time;
  const regimen=guidance.regimen;
  const reasons=regimen?.reasons?.filter(Boolean)||[];
  if(time.state!=='within')return reasons.length
    ?{...time,message:[time.message,...reasons].join(' ')}:time;
  const rule=guidance.reference||guidance.rule;
  const range=rule.kind==='single'?'Jednorazowe podanie w wybranym schemacie; nie oznacza codziennego powtarzania.'
    :rule.fixed?`Czas wybranego ${rule.kind==='stage'?'etapu':'schematu'}: ${rule.minimum} ${rule.minimum===1?'dzień':'dni'}.`
      :`Czas mieści się w zakresie ${rangeLabel(rule)}${rule.origin==='external'?` według ${rule.organization||'SDCEP'}`:' wybranego schematu'}.`;
  if(regimen?.state==='matched')return {...time,
    short:rule.kind==='single'?'Jednorazowo':rule.kind==='stage'?'Zgodny etap':'Zgodne ze schematem',
    message:`${range} Wpisane dawkowanie i sprawdzane warunki są zgodne ${rule.kind==='stage'?'z wybranym etapem':'ze schematem źródłowym'}. To nie pełna ocena kliniczna leczenia.`};
  if(guidance.reference&&regimen?.state==='reference-matched')return {...time,
    timeState:time.state,state:'reference-within',tone:'neutral',short:'Zgodność liczbowa',
    message:`Dawka, częstość i czas zgodne liczbowo z odniesieniem ${rule.organization||'UCSF'}.`};
  const incomplete=!regimen||regimen.state==='incomplete';
  return {...time,timeState:time.state,state:incomplete?'regimen-incomplete':regimen.state==='mismatch'?'regimen-mismatch':'regimen-review',
    tone:incomplete?'neutral':'warning',short:incomplete?'Uzupełnij dane':'Wymaga oceny',
    message:[range,...(reasons.length?reasons:['Brak potwierdzenia zgodności dawkowania ze źródłem.'])].join(' ')};
}
export function durationResultWarning(value,guidance) {
  const a=assessDuration(value,guidance);
  return guidance?.applicable&&['below','above','review','regimen-mismatch','regimen-review'].includes(a.state)?a.message:null;
}
/** Supply-period shortcuts are not recommended courses. Fixed/procedural
 * sources expose no misleading editable 3/5/7/10-day shortcuts. */
export function durationDayChoices(source,guidance,{cardio=false}={}) {
  if(source?.fixedDays)return [];
  if(guidance?.coverage==='reviewed'&&guidance.rule?.choices)return [...guidance.rule.choices];
  if(source?.doseMode==='instruction')return [];
  return cardio?[30,90,120]:[3,5,7,10];
}
