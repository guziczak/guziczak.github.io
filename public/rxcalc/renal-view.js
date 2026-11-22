import { formatNumber as n } from './engine.js';
import { RENAL_FUNCTION_SOURCES } from './renal-function.js';
import { isCrClIgnored, renalCreatinineInput } from './renal-state.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const input = (id, label, value, unit, required = false) => `<div class="field"><label for="${id}">${label}</label><div class="input-unit"><input id="${id}" data-field="${id}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(value)}" placeholder="Wpisz wartość" ${required ? 'required' : ''}><span>${esc(unit)}</span></div></div>`;

function creatinineSourceText(state) {
  const original = renalCreatinineInput(state);
  return original.retained && original.unit !== state.renalCreatinineUnit
    ? `Wpisany wynik: ${String(original.value).replace('.', ',')} ${original.unit === 'umol/l' ? 'µmol/l' : 'mg/dl'}. Obliczenia zachowują tę wartość.` : '';
}

function criteriaText(criteria, ignoreCrCl = false) {
  if (!criteria) return '';
  const renalNote = ignoreCrCl ? '' : ' CrCl jest oceniany osobno.';
  if (criteria.reduction === null) return `Reguła 2 z 3: uzupełnij potrzebne dane.${renalNote}`;
  if (criteria.creatinine === null) return `Reguła 2 z 3: ${criteria.reduction ? 'spełniona' : 'niespełniona'} na podstawie wieku i masy. Kreatynina nie zmieni tego zliczenia.${renalNote}`;
  return `Reguła 2 z 3: ${criteria.reduction ? 'spełniona' : 'niespełniona'} · ${criteria.minimumCount} z 3 kryteriów.${renalNote}`;
}

export function formatCrClEstimate(value, thresholds = []) {
  if (!Number.isFinite(value) || value <= 0) return '—';
  let digits=2,display=n(value,digits);
  const changesBand = () => {
    const shown=Number(display.replace(',','.'));
    return shown===0 || thresholds.some(boundary=>Number.isFinite(boundary)
      && ((value<boundary && shown>=boundary)||(value>boundary && shown<=boundary)));
  };
  while(digits<10 && changesBand())display=n(value,++digits);
  if(changesBand())display=String(value).replace('.',',');
  return `${Number(display.replace(',','.'))===value?'':'≈ '}${display}`;
}

export function renalResultMarkup({ state, assessment, thresholds = [] }) {
  if (isCrClIgnored(state)) return '<p class="renal-ignored">CrCl pominięty</p>';
  if (state.renalInputMode !== 'calculate') return '';
  const weight = assessment.weightUsedKg;
  const weightText = weight > 0 ? `Masa do wzoru: ${n(weight, 6)} kg${assessment.weightKind === 'clinician-selected' ? ' · wybrana przez lekarza' : ' · masa rzeczywista'}.` : 'Do wzoru potrzebna jest masa ciała.';
  if (assessment.crcl !== null && assessment.valid) return `<div class="renal-estimate"><span>Szacowany CrCl · Cockcroft–Gault</span><strong title="${esc(String(assessment.crcl).replace('.',','))} ml/min">${esc(formatCrClEstimate(assessment.crcl,thresholds))} <small>ml/min</small></strong><p>${esc(weightText)} Weryfikacja progów używa pełnej wartości obliczenia.</p></div>`;
  const issue = assessment.issues.find(item => item.kind !== 'missing');
  const awaitingReview = assessment.issues.length && assessment.issues.every(item => ['renalStable', 'weightReviewed'].includes(item.field));
  return `<div class="renal-estimate pending${issue ? ' invalid' : ''}"><span>Szacowany CrCl · Cockcroft–Gault</span><p>${esc(issue?.message || (awaitingReview ? 'Potwierdź stabilność czynności nerek i przydatność masy do wzoru.' : 'Uzupełnij kreatyninę i dane wzoru, aby obliczyć CrCl.'))}</p><small>${esc(weightText)}</small></div>`;
}

export function renalPanelMarkup({ state, assessment, criteria = null, required = false, thresholds = [], icon = () => '' }) {
  const ignored = isCrClIgnored(state);
  const calculate = !ignored && state.renalInputMode === 'calculate';
  const needsCreatinine = calculate || criteria?.requiresCreatinine === true;
  const showCreatinine = calculate || criteria !== null;
  const originalText = creatinineSourceText(state);
  const creatinine = showCreatinine ? `<div class="field renal-creatinine"><label id="renal-creatinine-label" for="humanSerumCreatinine">Kreatynina w surowicy${needsCreatinine ? '' : ' (opcjonalnie)'}</label><div class="renal-creatinine-input"><input id="humanSerumCreatinine" data-field="humanSerumCreatinine" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(state.humanSerumCreatinine)}" placeholder="Wynik badania" ${needsCreatinine ? 'required' : ''}><select id="renalCreatinineUnit" data-field="renalCreatinineUnit" aria-label="Jednostka kreatyniny"><option value="mg/dl" ${state.renalCreatinineUnit !== 'umol/l' ? 'selected' : ''}>mg/dl</option><option value="umol/l" ${state.renalCreatinineUnit === 'umol/l' ? 'selected' : ''}>µmol/l</option></select></div><small id="renal-creatinine-source" ${originalText ? '' : 'hidden'}>${esc(originalText)}</small></div>` : '';
  return `<section class="renal-panel" id="renal-panel" aria-labelledby="renal-title"><div class="renal-heading"><h4 id="renal-title">${icon('info')}Czynność nerek</h4><div class="renal-heading-controls">${ignored ? '' : `<span>${required ? 'Do sprawdzenia schematu' : 'Jeśli oceniono'}</span>`}<label class="renal-ignore-option" for="ignoreCrCl"><input id="ignoreCrCl" type="checkbox" aria-label="Ignoruj CrCl" ${ignored ? 'checked' : ''}><span>Ignoruj</span></label></div></div>
    ${ignored ? '' : `<div class="renal-modes" role="group" aria-label="Sposób podania CrCl"><button type="button" data-action="renal-mode" data-value="manual" aria-pressed="${!calculate}" class="${!calculate ? 'active' : ''}">Mam oceniony CrCl</button><button type="button" data-action="renal-mode" data-value="calculate" aria-pressed="${calculate}" class="${calculate ? 'active' : ''}">Oblicz z kreatyniny</button></div>`}
    ${!ignored || showCreatinine ? `<div class="renal-fields">${!ignored && !calculate ? input('humanCrCl', 'Oceniony CrCl', state.humanCrCl, 'ml/min', required) : ''}${creatinine}${calculate ? `<div class="field"><label for="renalSex">Płeć do wzoru</label><select id="renalSex" data-field="renalSex" required><option value="">Wybierz</option><option value="female" ${state.renalSex === 'female' ? 'selected' : ''}>Kobieta</option><option value="male" ${state.renalSex === 'male' ? 'selected' : ''}>Mężczyzna</option></select></div>` : ''}</div>` : ''}
    ${calculate ? `<details class="renal-weight-details" ${state.renalCalculationWeight !== '' ? 'open' : ''}><summary>Dobór masy do wzoru</summary><p>Domyślnie używana jest rzeczywista masa z danych pacjenta. Jeśli ocena kliniczna wymaga innej masy, wpisz ją poniżej. Masa do wzoru nie zastępuje rzeczywistej masy w kryteriach dawki.</p>${input('renalCalculationWeight', 'Masa wybrana do wzoru (opcjonalnie)', state.renalCalculationWeight, 'kg')}<small>Wyczyść pole, aby wrócić do masy rzeczywistej.</small></details><label class="renal-review" for="renalCalculationReviewed"><input id="renalCalculationReviewed" type="checkbox" ${state.renalCalculationReviewed ? 'checked' : ''}><span>Kreatynina odzwierciedla stabilną czynność nerek, a użyta masa jest odpowiednia do wzoru.</span></label>` : ''}
    <div id="renal-result" aria-live="polite">${renalResultMarkup({ state, assessment, thresholds })}</div>
    <p class="renal-criteria" id="renal-criteria" ${criteria ? '' : 'hidden'}>${esc(criteriaText(criteria, ignored))}</p>
    <details class="renal-help"><summary>Dlaczego te dane?</summary><p>CrCl w ml/min i kreatynina w surowicy to różne wartości. eGFR z wyniku laboratoryjnego nie zastępuje CrCl dla tych reguł dawkowania. W NVAF apiksabanu kreatynina służy również regule 2 z 3.</p><p>Wzór Cockcrofta–Gaulta jest tu dostępny dla dorosłych przy stabilnej czynności nerek. Przy ostrej zmianie czynności nerek lub nietypowej budowie ciała potrzebna jest indywidualna ocena wartości i masy do wzoru. Wpisany lub obliczony CrCl nie stanowi pełnej oceny leczenia.</p><a href="${esc(RENAL_FUNCTION_SOURCES.scope)}" target="_blank" rel="noopener noreferrer">CrCl i dawkowanie · MHRA ↗</a><a href="${esc(RENAL_FUNCTION_SOURCES.stabilityAndWeight)}" target="_blank" rel="noopener noreferrer">Warunki obliczeń · SPS ↗</a></details>
  </section>`;
}

/** Update outputs in place: typing must keep focus, selection, and open details. */
export function updateRenalPanel(root, options) {
  const node = root.querySelector('#renal-panel');
  if (!node) return;
  const { state, criteria } = options;
  const ignored = isCrClIgnored(state);
  const ignore = root.querySelector('#ignoreCrCl');
  if (ignore) ignore.checked = ignored;
  const result = root.querySelector('#renal-result');
  if (result) result.innerHTML = renalResultMarkup(options);
  const creatinine = root.querySelector('#humanSerumCreatinine');
  if (creatinine) creatinine.required = !ignored && state.renalInputMode === 'calculate' || criteria?.requiresCreatinine === true;
  const label = root.querySelector('#renal-creatinine-label');
  if (label) label.textContent = `Kreatynina w surowicy${creatinine?.required ? '' : ' (opcjonalnie)'}`;
  const original = root.querySelector('#renal-creatinine-source');
  if (original) { original.textContent = creatinineSourceText(state); original.hidden = !original.textContent; }
  const checked = root.querySelector('#renalCalculationReviewed');
  if (checked) checked.checked = state.renalCalculationReviewed === true;
  const status = root.querySelector('#renal-criteria');
  if (status) { status.hidden = !criteria; status.textContent = criteriaText(criteria, ignored); }
}
