/** Explicit, clinician-selected starting values. Never an automatic treatment.
 * This substitution option is a labelled synthesis of Polish tablet dosing and
 * FDA formulation substitution guidance; it is NOT a Polish suspension regimen.
 */
import { DENTAL_SYSTEMIC_REGIMENS } from './dental-systemic.js';
import { formatNumber as n } from './engine.js';
const tablet=DENTAL_SYSTEMIC_REGIMENS.find(r=>r.id==='dental-augmentin-tablet-875-125-ge40');
export const LIQUID_STARTER_REGIMENS=[{
  ...tablet,id:'dental-augmentin-suspension-adult-substitution',formIds:['augmentin-400-57'],patientTypes:['adult'],
  label:'Dorosły ≥40 kg · trudność połykania tabletki · przeliczenie 875 mg co 12 h',
  phaseLabel:'875 mg amoksycyliny na podanie, 2 razy/dobę · przeliczenie źródeł',
  indication:'Ciężki ropień okołozębowy z szerzącym się zapaleniem tkanki łącznej — przeliczenie schematu tabletek u dorosłego z trudnością połykania',
  // These two inherited numbers describe the reference regimen, not an independent maximum.
  roundingConstraintKind:'source-target',
  minIntervalHours:12,sourceCheckedAt:'2026-11-14',
  sourceLabel:'ChPL Augmentin 875/125 (tabletki) + FDA (zamiana postaci)',
  sourceSection:'ChPL 4.1–4.2; FDA 2.2 i 2.8, tabela 6',
  additionalSources:[{label:'FDA AUGMENTIN · zamiana tabletki 875/125 na zawiesinę 400/57 · 07/2026',url:'https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/050785s022lbl.pdf'},
    {label:'Polska ChPL wybranej zawiesiny 400/57',url:'https://rejestrymedyczne.ezdrowie.gov.pl/api/rpl/medicinal-products/8695/characteristic'}],
  starterCaution:'Tylko dorosły ≥40 kg z trudnością połykania tabletki i potwierdzonym wskazaniem. To zestawienie ChPL tabletek z zasadą zamiany postaci FDA, nie gotowy schemat z polskiej ChPL zawiesiny. Dobór potwierdza lekarz.',
  screening:'Przeliczenie dwóch źródeł, nie gotowy schemat polskiej ChPL zawiesiny. Wybór oznacza decyzję lekarza o wskazaniu i zamianie postaci u dorosłego ≥40 kg z trudnością połykania. Oceń nadwrażliwość na beta-laktamy, wcześniejszą żółtaczkę lub zaburzenia wątroby, czynność nerek i interakcje.',
  administration:'Doustnie, z posiłkiem. Wstrząsnąć zawiesinę przed każdym podaniem. Sprawdzić możliwość dokładnego odmierzenia objętości.',
  notes:[
    'Wskazanie i 875 mg amoksycyliny co 12 godzin pochodzą z polskiej ChPL tabletek 875/125 mg. FDA, tabela 6, wskazuje zawiesinę 400/57 jako odpowiednią moc do zamiany u osób niemogących połknąć tabletki. Zastosowanie tych źródeł łącznie jest przeliczeniem wymagającym decyzji lekarza, nie cytatem schematu polskiej ChPL zawiesiny.',
    '875 mg amoksycyliny w tej zawiesinie to 10,9375 ml i 124,6875 mg kwasu klawulanowego na podanie. Nie podstawiamy 125 mg za rzeczywistą zawartość drugiego składnika. Nie zaokrąglamy automatycznie tego wariantu; możliwość odmierzenia wymaga oceny.',
    'Uzupełniane są wyłącznie dawka i częstość. Czas terapii pozostaje do ustalenia. Nie wybrano większego schematu 3 razy na dobę.',
    'Wariant dotyczy dorosłych o masie co najmniej 40 kg. Wpisana mniejsza masa lub znane zaburzenia nerek wymagają odrębnej decyzji. Nie wykonujemy automatycznej korekty nerkowej.',
    ...tablet.notes.filter(t=>!t.includes('tabletka')&&!t.includes('tabletki')),
  ],
}];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Reuse the app's select enhancement; the regimen list stays closed until requested.
 * Selection flows through the existing regimenId change handler, never a default.
 * Detailed sources remain available before selection in one collapsed disclosure.
 */
export function liquidStarterMarkup(choices) {
  if(!choices.length)return '';
  const doseLabel=s=>{
    const unit=({fixed:'mg',perKgDay:'mg/kg/dobę',perKgDose:'mg/kg/podanie',units:'ml'})[s.doseMode]||'';
    const dose=s.dose!=null?n(s.dose):s.doseRange?`${n(s.doseRange.min)}–${n(s.doseRange.max)}`:'Wybierz dawkę';
    return `${dose} ${unit} · ${s.frequency?`${n(s.frequency)} ×/dobę`:'wybierz częstość'}`;
  };
  const options=choices.map(s=>`<option value="${esc(s.id)}">${esc(doseLabel(s))} — ${esc(s.label)}${s.starterCaution?' · Przeliczenie ChPL + FDA':''}</option>`).join('');
  const sources=choices.map(s=>`<section><h4>${esc(doseLabel(s))} — ${esc(s.label)}</h4>${s.starterCaution?`<p class="liquid-starter-caution">${esc(s.starterCaution)}</p>`:''}<p>${esc(s.indication)}</p><p>${esc(s.screening||'Zakres i warunki schematu sprawdź w źródle.')}</p><a href="${esc(s.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(s.sourceLabel)} ↗</a>${(s.additionalSources||[]).map(a=>`<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.label)} ↗</a>`).join('')}</section>`).join('');
  return `<div class="source-regimen-picker liquid-starters"><div class="field"><label for="regimenId">Uzupełnij ze schematu (opcjonalnie)</label><select id="regimenId" data-field="regimenId" aria-describedby="liquid-starter-help"><option value="">Wybierz schemat…</option>${options}</select></div><p class="small-help" id="liquid-starter-help">Wybór uzupełni stałe wartości. Dawkę z zakresu i czas ustalasz sam. Możesz też wpisać własne wartości poniżej.</p><details class="liquid-starter-sources"><summary>Warunki i źródła schematów</summary>${sources}</details></div>`;
}
