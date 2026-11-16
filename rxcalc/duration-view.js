import { assessDuration } from './duration-guidance.js';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const textDays = d => `${d} ${d === 1 ? 'dzień' : 'dni'}`;
const symbol = tone => tone === 'warning' || tone === 'critical' ? '⚠' : '';

export function durationGuidanceMarkup({ choices = [], days = '', guidance, detailsOpen = false } = {}) {
  const current = assessDuration(days, guidance), rule = guidance?.rule;
  const noNumericRange=rule && !(rule.minimum && rule.maximum);
  const kinds={'review-only':'Sprawdzono źródło · warunek kontroli','individual':'Sprawdzono źródło · czas indywidualny','procedural':'Sprawdzono źródło · postępowanie zabiegowe','routine':'Sprawdzono instrukcję · codzienna higiena','chronic':'Sprawdzono źródło · leczenie przewlekłe','response':'Sprawdzono źródło · ocena odpowiedzi','as-needed':'Sprawdzono źródło · stosowanie doraźne','maximum':'Sprawdzono źródło · ograniczenie czasu','stage':'Czas wybranego etapu','single':'Jednorazowe podanie','fixed':'Czas wybranego schematu','range':'Zakres czasu ze źródła'};
  const list = [...new Set(choices)].filter(d => Number.isInteger(d) && d > 0 && d <= 3660);
  const selectedDays = days === '' || days == null ? null : Number(String(days).replace(',', '.'));
  const buttons = list.map(d => {
    const a = assessDuration(d, guidance), selected = d === selectedDays;
    return `<button type="button" class="duration-choice duration-${a.tone}${selected ? ' active' : ''}" data-action="days" data-value="${d}" aria-pressed="${selected}" aria-label="${esc(`${textDays(d)}${selected ? ', wybrano' : ''}. ${a.message}`)}" title="${esc(a.message)}"><span class="duration-selected" aria-hidden="true">${selected ? '✓' : ''}</span><strong>${textDays(d)}</strong>${a.short ? `<small><span aria-hidden="true">${symbol(a.tone)} </span>${esc(a.short)}</small>` : ''}</button>`;
  }).join('');
  const range = rule?.minimum && rule?.maximum ? rule.minimum === rule.maximum ? textDays(rule.minimum) : `${rule.minimum}–${rule.maximum} dni`
    : rule?.minimum ? `co najmniej ${textDays(rule.minimum)}` : rule?.maximum ? `do ${textDays(rule.maximum)}` : '';
  const origin = rule ? `<p class="duration-origin">${rule.origin === 'external' ? 'Odniesienie do czasu: SDCEP (Szkocja)' : kinds[rule.kind] || 'Czas wg źródła schematu'}${range ? ` · <strong>${esc(range)}</strong>` : ''}.</p>` : '';
  const review = rule?.reviewText ? `<p class="duration-review">${esc(rule.reviewText)}</p>` : '';
  const status = current.state === 'pending' ? !guidance?.applicable ? guidance?.reason
    : noNumericRange ? assessDuration(rule.minimum || 1,guidance).message : current.message : current.message;
  const details = rule ? `<details class="duration-sources"${detailsOpen ? ' open' : ''}><summary>Źródło i zakres oceny czasu</summary><p>${esc(rule.indication)}</p><p>${esc(rule.note)}</p><a href="${esc(rule.url)}" target="_blank" rel="noopener noreferrer">${esc(rule.label)} ↗</a>${rule.origin === 'external' && rule.primarySourceUrl ? `<a href="${esc(rule.primarySourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(rule.primarySourceLabel)} · osobne źródło dawkowania ↗</a>` : ''}${rule.reviewUrl ? `<a href="${esc(rule.reviewUrl)}" target="_blank" rel="noopener noreferrer">SDCEP · zasady ponownej oceny ↗</a>` : ''}<small>Przegląd informacji o czasie: ${esc(rule.checkedAt)}. To nie walidacja kliniczna całego leczenia. Kolor dotyczy tylko czasu.</small></details>` : '';
  return `${buttons ? `<div class="quick-days duration-choices" role="group" aria-label="Szybki wybór czasu stosowania"><span class="duration-choices-label">Szybki wybór:</span>${buttons}</div>` : ''}${origin}<p class="duration-feedback duration-${current.tone}" role="status" aria-live="polite">${current.tone === 'warning' || current.tone === 'critical' ? '<span aria-hidden="true">⚠ </span>' : ''}${esc(status || '')}</p>${guidance?.applicable && status !== rule?.reviewText ? review : ''}${details}`;
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
