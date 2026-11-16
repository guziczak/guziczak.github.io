import { assessDuration } from './duration-guidance.js';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const textDays = d => `${d} ${d === 1 ? 'dzień' : 'dni'}`;
const symbol = tone => tone === 'warning' || tone === 'critical' ? '⚠' : '';

export function durationGuidanceMarkup({ choices = [], days = '', guidance, detailsOpen = false } = {}) {
  const current = assessDuration(days, guidance), rule = guidance?.rule;
  const list = [...new Set(choices)].filter(d => Number.isInteger(d) && d > 0 && d <= 3660);
  const selectedDays = days === '' || days == null ? null : Number(String(days).replace(',', '.'));
  const buttons = list.map(d => {
    const a = assessDuration(d, guidance), selected = d === selectedDays;
    return `<button type="button" class="duration-choice duration-${a.tone}${selected ? ' active' : ''}" data-action="days" data-value="${d}" aria-pressed="${selected}" aria-label="${esc(`${textDays(d)}${selected ? ', wybrano' : ''}. ${a.message}`)}" title="${esc(a.message)}"><span class="duration-selected" aria-hidden="true">${selected ? '✓' : ''}</span><strong>${textDays(d)}</strong>${a.short ? `<small><span aria-hidden="true">${symbol(a.tone)} </span>${esc(a.short)}</small>` : ''}</button>`;
  }).join('');
  const range = rule?.minimum && rule?.maximum ? rule.minimum === rule.maximum ? textDays(rule.minimum) : `${rule.minimum}–${rule.maximum} dni`
    : rule?.minimum ? `co najmniej ${textDays(rule.minimum)}` : rule?.maximum ? `do ${textDays(rule.maximum)}` : '';
  const origin = rule ? `<p class="duration-origin">${rule.origin === 'external' ? 'Odniesienie do czasu: SDCEP (Szkocja)' : 'Czas wg źródła schematu'}${range ? ` · <strong>${esc(range)}</strong>` : ''}.</p>` : '';
  const review = rule?.reviewAfterDays ? `<p class="duration-review">${rule.origin === 'external' ? 'Ponowna ocena: najlepiej po' : 'Ponowna ocena według źródła po'} ${rule.reviewAfterDays} dniach. <span>To nie jest automatyczny koniec kuracji.</span></p>` : '';
  const status = current.state === 'pending' && !guidance?.applicable ? guidance?.reason : current.message;
  const details = rule ? `<details class="duration-sources"${detailsOpen ? ' open' : ''}><summary>Źródło i zakres oceny czasu</summary><p>${esc(rule.indication)}</p><p>${esc(rule.note)}</p><a href="${esc(rule.url)}" target="_blank" rel="noopener noreferrer">${esc(rule.label)} ↗</a>${rule.reviewUrl ? `<a href="${esc(rule.reviewUrl)}" target="_blank" rel="noopener noreferrer">SDCEP · zasady ponownej oceny ↗</a>` : ''}<small>Źródło sprawdzone: ${esc(rule.checkedAt)}. Kolor dotyczy tylko czasu, nie potwierdzenia bezpieczeństwa.</small></details>` : '';
  return `<div class="quick-days duration-choices" role="group" aria-label="Szybki wybór czasu stosowania"><span class="duration-choices-label">Szybki wybór:</span>${buttons}</div>${origin}<p class="duration-feedback duration-${current.tone}" role="status" aria-live="polite">${current.tone === 'warning' || current.tone === 'critical' ? '<span aria-hidden="true">⚠ </span>' : ''}${esc(status || '')}</p>${guidance?.applicable ? review : ''}${details}`;
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
