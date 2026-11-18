import { assessDuration, assessDurationTime } from './duration-guidance.js';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const textDays = d => `${d} ${d === 1 ? 'dzień' : 'dni'}`;
const symbol = tone => tone === 'warning' || tone === 'critical' ? '⚠' : '';

const externalRule = guidance => guidance?.reference
  || (guidance?.rule?.origin === 'external' ? guidance.rule : null);
const organization = rule => rule?.organization || 'SDCEP';

/** External tiles compare days only. Their shared notice retains every reason
 * why the complete regimen is different, incomplete or requires review. */
function choiceAssessment(value, guidance) {
  const reference = externalRule(guidance);
  if (!reference) {
    const assessment = assessDuration(value, guidance);
    const rule = guidance?.rule;
    if (assessment.state === 'unassessed' && guidance?.applicable
        && !rule?.minimum && !rule?.maximum
        && ['individual', 'review-only'].includes(rule?.kind))
      return { ...assessment,
        message: 'Czas nieoceniony — źródło wybranego schematu nie określa zakresu dni dla tego wskazania.' };
    return assessment;
  }
  const time = assessDurationTime(value, guidance);
  if (time.state === 'within') return { ...time, tone: 'neutral',
    short: `W zakresie ${organization(reference)}`,
    message: guidance.reference && guidance.regimen?.state === 'reference-matched'
      ? assessDuration(value, guidance).message
      : `Czas mieści się w zakresie ${reference.minimum}–${reference.maximum} dni według ${organization(reference)}. Warunki zastosowania odniesienia opisano osobno.` };
  if (time.tone === 'warning' && ['below', 'above'].includes(time.state)) {
    // Name the external source only when its own range produces this warning.
    // A primary-source restriction can take precedence over an in-range reference.
    const comparison = assessDurationTime(value, { ...guidance, rule: reference, reference: null });
    if (comparison.state === time.state && comparison.tone === time.tone)
      return { ...time, short: `${time.state === 'below' ? 'Poniżej zakresu' : 'Powyżej zakresu'} ${organization(reference)}` };
  }
  return time;
}

function regimenContextMarkup(guidance) {
  const reference = externalRule(guidance);
  if (!reference || !guidance?.applicable) return '';
  const regimen = guidance.regimen;
  if (guidance.reference && regimen?.state === 'reference-matched') return '';
  const reasons = [...new Set(regimen?.reasons?.filter(Boolean) || [])];
  const mismatch = regimen?.state === 'mismatch';
  const heading = mismatch ? `Różnica względem odniesienia ${organization(reference)}`
    : regimen?.state === 'incomplete' ? 'Uzupełnij dane do porównania schematu'
      : 'Warunki zastosowania wymagają oceny';
  // Unresolved or differing comparisons retain their short source context.
  // A numeric match uses the compact feedback and the full source details.
  const condition = guidance.reference?.conditionText && regimen?.state !== 'review'
    ? guidance.reference.conditionText : '';
  if (!reasons.length) reasons.push('Nie potwierdzono dopasowania całego schematu do odniesienia.');
  return `<div id="duration-regimen-context" class="duration-reference-context duration-regimen-context duration-${mismatch ? 'warning' : 'neutral'}" role="note"><strong>${esc(heading)}</strong>${reasons.map(reason => `<p>${esc(reason)}</p>`).join('')}${condition ? `<p>${esc(condition)}</p>` : ''}</div>`;
}

function sourceReviewMarkup(review) {
  if (!review?.entries?.length) return '';
  return `<div class="duration-source-review"><p><strong>Dodatkowe źródła i zakres zastosowania</strong></p>${review.entries.map(item => `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.label)} ↗</a><p>${esc(item.note)}</p>`).join('')}<small>Sprawdzono dodatkowe źródła: ${esc(review.checkedAt)}.</small></div>`;
}

export function durationGuidanceMarkup({ choices = [], days = '', guidance, detailsOpen = false } = {}) {
  const current = choiceAssessment(days, guidance), primaryRule = guidance?.rule, rule = guidance?.reference || primaryRule;
  const noNumericRange=rule && !(rule.minimum && rule.maximum);
  const kinds={'review-only':'Sprawdzono źródło · warunek kontroli','individual':'Sprawdzono źródło · czas indywidualny','procedural':'Sprawdzono źródło · postępowanie zabiegowe','routine':'Sprawdzono instrukcję · codzienna higiena','chronic':'Sprawdzono źródło · leczenie przewlekłe','response':'Sprawdzono źródło · ocena odpowiedzi','as-needed':'Sprawdzono źródło · stosowanie doraźne','maximum':'Sprawdzono źródło · ograniczenie czasu','stage':'Czas wybranego etapu','single':'Jednorazowe podanie','fixed':'Czas wybranego schematu','range':'Zakres czasu ze źródła'};
  const list = [...new Set(choices)].filter(d => Number.isInteger(d) && d > 0 && d <= 3660);
  const selectedDays = days === '' || days == null ? null : Number(String(days).replace(',', '.'));
  const buttons = list.map(d => {
    const a = choiceAssessment(d, guidance), selected = d === selectedDays;
    return `<button type="button" class="duration-choice duration-${a.tone}${selected ? ' active' : ''}" data-action="days" data-value="${d}" aria-pressed="${selected}" aria-label="${esc(`${textDays(d)}${selected ? ', wybrano' : ''}. ${a.message}`)}" title="${esc(a.message)}"><strong>${textDays(d)}</strong>${a.short ? `<small><span aria-hidden="true">${symbol(a.tone)} </span>${esc(a.short)}</small>` : ''}<span class="duration-selected" aria-hidden="true">${selected ? '✓ Wybrano' : ''}</span></button>`;
  }).join('');
  const range = rule?.minimum && rule?.maximum ? rule.minimum === rule.maximum ? textDays(rule.minimum) : `${rule.minimum}–${rule.maximum} dni`
    : rule?.minimum ? `co najmniej ${textDays(rule.minimum)}` : rule?.maximum ? `do ${textDays(rule.maximum)}` : '';
  const origin = rule ? `<p class="duration-origin">${rule.origin === 'external' ? esc(rule.originLabel || 'Odniesienie do czasu: SDCEP (Szkocja)') : kinds[rule.kind] || 'Czas wg źródła schematu'}${range ? ` · <strong>${esc(range)}</strong>` : ''}.</p>` : '';
  const referenceContext = regimenContextMarkup(guidance);
  const review = rule?.reviewText ? `<p class="duration-review">${esc(rule.reviewText)}</p>` : '';
  const status = current.state === 'pending' ? !guidance?.applicable ? guidance?.reason
    : noNumericRange ? choiceAssessment(rule.minimum || 1,guidance).message : current.message : current.message;
  const details = rule ? `<details class="duration-sources"${detailsOpen ? ' open' : ''}><summary>Źródło i zakres oceny czasu</summary><p>${esc(rule.indication)}</p><p>${esc(rule.note)}</p>${guidance?.reference && primaryRule?.reviewText ? `<p><strong>Osobny warunek ChPL:</strong> ${esc(primaryRule.reviewText)}</p>` : ''}<a href="${esc(rule.url)}" target="_blank" rel="noopener noreferrer">${esc(rule.label)} ↗</a>${rule.origin === 'external' && rule.primarySourceUrl ? `<a href="${esc(rule.primarySourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(rule.primarySourceLabel)} · osobne źródło dawkowania ↗</a>` : ''}${(rule.additionalSources || []).map(item => `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.label)} ↗</a>`).join('')}${rule.reviewUrl ? `<a href="${esc(rule.reviewUrl)}" target="_blank" rel="noopener noreferrer">SDCEP · zasady ponownej oceny ↗</a>` : ''}<small>Przegląd informacji o czasie: ${esc(rule.checkedAt)}. Zielony oznacza zgodność dostępnych danych z wybranym schematem, w zakresie wykonanych kontroli. To nie pełna ocena kliniczna leczenia.</small>${sourceReviewMarkup(guidance?.sourceReview)}</details>` : '';
  return `${buttons ? `<div class="quick-days duration-choices" role="group" aria-label="Szybki wybór czasu stosowania"${referenceContext ? ' aria-describedby="duration-regimen-context"' : ''}><span class="duration-choices-label">Szybki wybór:</span>${buttons}</div>` : ''}${origin}${referenceContext}<p class="duration-feedback duration-${current.tone}" role="status" aria-live="polite">${current.tone === 'warning' || current.tone === 'critical' ? '<span aria-hidden="true">⚠ </span>' : ''}${esc(status || '')}</p>${guidance?.applicable && status !== rule?.reviewText ? review : ''}${details}`;
}

/** Refresh the existing slot without touching the days input or its selection.
 * Preserve disclosure and keyboard focus while the chosen outline changes. */
export function renderDurationGuidance(slot, options) {
  if (!slot) return;
  const detailsOpen = slot.querySelector('.duration-sources')?.open || false;
  const active = slot.ownerDocument.activeElement;
  const focusValue = slot.contains(active) ? active?.dataset?.value : null;
  const focusSummary = slot.contains(active) && active?.tagName === 'SUMMARY';
  const markup = durationGuidanceMarkup({ ...options, detailsOpen });
  if (slot.innerHTML === markup) return;
  slot.innerHTML = markup;
  if (focusValue) [...slot.querySelectorAll('[data-action="days"]')].find(b => b.dataset.value === focusValue)?.focus({preventScroll:true});
  else if (focusSummary) slot.querySelector('summary')?.focus({preventScroll:true});
}
