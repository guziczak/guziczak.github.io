import { formatNumber as n } from './engine.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g,
  char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const tolerance = (a, b) => Number.EPSILON * 64 * Math.max(1, Math.abs(a), Math.abs(b));

/** Fixed display scale: 0–125% of the supplied boundary, with a wall at 80%.
 * This is a measurement, not a treatment target or an assessment of safety.
 * Unknown boundaries/amounts never become zero or a fabricated percentage.
 */
export function doseMeterModel(row = {}, { comparisonAllowed = true } = {}) {
  const perKg = !positive(row.ceiling) && positive(row.ceilingPerKg);
  const ceiling = perKg ? row.ceilingPerKg : row.ceiling;
  const value = perKg ? row.perKg : row.daily;
  if (!positive(ceiling)) return { state:'unknown', ratio:null, fill:null, excess:null, ceiling:null, value:null, perKg };
  if (!comparisonAllowed) return { state:'unconfirmed', ratio:null, fill:null, excess:null, ceiling, value, perKg };
  if (!positive(value)) return { state:'pending', ratio:null, fill:null, excess:null, ceiling, value:null, perKg };
  const difference = value - ceiling;
  const atBoundary = Math.abs(difference) <= tolerance(value, ceiling);
  const ratio = atBoundary ? 1 : value / ceiling;
  if (!Number.isFinite(ratio)) return { state:'unconfirmed', ratio:null, fill:null, excess:null, ceiling, value, perKg };
  return {
    state:atBoundary ? 'boundary' : difference > 0 ? 'exceeded' : 'below',
    ratio, ceiling, value, perKg,
    fill:Math.min(ratio, 1) * 80,
    excess:Math.max(0, Math.min(ratio - 1, .25)) * 80,
    clipped:ratio > 1.25,
  };
}

function percentText(ratio) {
  const percent = ratio * 100;
  if (ratio < 1 && percent > 99.99) return '>99,99';
  if (ratio > 1 && percent < 100.01) return '>100';
  if (percent < .01) return '<0,01';
  return n(percent, 2);
}

function boundaryLabel(row, kind) {
  if (row.derivedCeiling) return 'Ilość przy granicy składnika głównego';
  return kind === 'manual' ? 'Limit wpisany przez lekarza'
    : kind === 'source' ? 'Granica wybranego schematu' : 'Limit z danych preparatu';
}

function meterMarkup(row, note, comparisonAllowed) {
  const model = doseMeterModel(row, {comparisonAllowed});
  const label = boundaryLabel(row, note.ceilingKind);
  const unit = `${row.unit}/${model.perKg ? 'kg/' : ''}dobę`;
  const stateText = model.state === 'unknown' ? 'Brak zweryfikowanego limitu'
    : model.state === 'unconfirmed' ? 'Warunki porównania niepotwierdzone'
    : model.state === 'pending' ? 'Uzupełnij dane do porównania'
    : model.state === 'exceeded' ? `Przekroczenie o ${model.ratio - 1 < .0001 ? '<0,01' : n((model.ratio - 1) * 100, 2)}%`
    : model.state === 'boundary' ? 'Na wskazanej granicy' : 'Poniżej tej granicy';
  const boundary = model.ceiling === null ? '' : `<div class="dose-safety-boundary"><span>${esc(label)}</span><strong>${n(model.ceiling, 4)} ${esc(unit)}</strong></div>`;
  const weightBoundary = positive(row.ceiling) && positive(row.ceilingPerKg)
    ? `<span class="dose-safety-weight-boundary">${n(row.ceilingPerKg, 4)} ${esc(row.unit)}/kg/dobę</span>` : '';
  const comparison = model.ratio === null ? '' : `<strong>${esc(percentText(model.ratio))}% granicy</strong>`;
  // Unknown and ineligible contexts have no marker or numeric scale. A known
  // boundary awaiting a dose retains its marker, but never a zero-value fill.
  const scaled = !['unknown','unconfirmed'].includes(model.state);
  const graphicLabel = model.ratio === null ? stateText
    : `${row.name}: ${n(model.value, 6)} ${unit}. ${label}: ${n(model.ceiling, 4)} ${unit}. ${percentText(model.ratio)}% granicy. ${model.clipped ? 'Pasek kończy się na 125%; rzeczywista wartość jest większa.' : ''}`;
  const graphic = `<div class="dose-safety-meter ${scaled ? '' : 'unscaled'} ${model.state}" role="img" aria-label="${esc(graphicLabel)}"><span class="dose-safety-track"></span>${scaled ? `${model.fill === null ? '' : `<span class="dose-safety-fill" style="width:${model.fill}%"></span>${model.excess > 0 ? `<span class="dose-safety-excess" style="width:${model.excess}%"></span>` : ''}`}<span class="dose-safety-wall" aria-hidden="true"></span>${model.clipped ? '<span class="dose-safety-overflow" aria-hidden="true">›</span>' : ''}` : ''}</div>`;
  const axis = scaled ? '<div class="dose-safety-axis" aria-hidden="true"><span>0</span><span class="dose-safety-axis-limit">100% · granica</span><span>125%</span></div>' : '';
  const derived = row.derivedCeiling ? '<p class="dose-safety-derived">Z proporcji składników preparatu — nie jest to niezależne maksimum tej substancji.</p>' : '';
  return `${boundary}${weightBoundary}${graphic}${axis}<div class="dose-safety-status ${model.state}"><span>${esc(stateText)}</span>${comparison}</div>${derived}`;
}

/** Pure HTML renderer. No source limits are invented and no input is mutated. */
export function dailyDoseMarkup({ note, input = {}, source = null, context = '', eligibility = null, doseProblems = [], canChooseSource = false, veterinary = false, icon = () => '' } = {}) {
  if (!note) return '';
  const comparisonAllowed = !source || eligibility?.valid === true;
  const rows = note.rows.map(row => `<div class="dose-safety-row"><dt>${esc(row.name)}</dt><dd><div class="dose-safety-amount"><strong>${row.daily === null ? '—' : n(row.daily, 6)} <span>${esc(row.unit)}/dobę</span></strong>${row.perKg === null ? '' : `<small>${n(row.perKg, 4)} ${esc(row.unit)}/kg/dobę</small>`}</div>${meterMarkup(row, note, comparisonAllowed)}</dd></div>`).join('');
  const hasCeiling = note.rows.some(row => positive(row.ceiling) || positive(row.ceilingPerKg));
  const hasDerived = note.rows.some(row => row.derivedCeiling);
  const scope = source ? `<p class="daily-dose-scope"><strong>Wybrany schemat:</strong> ${esc(source.label)}${source.phaseLabel ? ` · ${esc(source.phaseLabel)}` : ''}. Granice dotyczą wyłącznie tego wskazania i zakresu pacjentów.</p>` : '';
  const errors = source && !comparisonAllowed
    ? `<div class="dose-safety-notice"><strong>Nie potwierdzono warunków porównania.</strong><p>Wartości graniczne są informacją o schemacie, nie limitem zatwierdzonym dla tego pacjenta.</p>${eligibility?.errors?.length ? `<ul>${[...new Set(eligibility.errors)].map(error => `<li>${esc(error)}</li>`).join('')}</ul>` : ''}</div>` : '';
  const doseIssues = comparisonAllowed && doseProblems.length ? `<div class="dose-safety-notice"><strong>Sprawdź zgodność ze schematem.</strong><ul>${[...new Set(doseProblems)].map(error => `<li>${esc(error)}</li>`).join('')}</ul></div>` : '';
  const missing = !hasCeiling ? `<div class="dose-safety-notice"><strong>Brak zweryfikowanego limitu dla tego schematu.</strong><p>Brak limitu nie oznacza bezpieczeństwa dawki. Zweryfikuj wskazanie, dane pacjenta i aktualną ChPL.</p>${context ? `<p>${esc(context)}</p>` : ''}${canChooseSource ? '<button type="button" class="text-button dose-safety-source-choice" data-action="daily-dose-source">Wybierz schemat ze źródła</button>' : ''}</div>` : '';
  const caution = hasCeiling ? `<p class="dose-safety-caution">${note.ceilingKind === 'manual' ? 'Limit ręczny nie jest automatycznie weryfikowany w ChPL. ' : ''}${hasDerived ? 'Składniki porównano do tej samej granicy schematu. ' : ''}Wynik poniżej kreski nie potwierdza bezpieczeństwa ani prawidłowego doboru dawki. Uwzględnij także inne leki z tą samą substancją.</p>` : '';
  const rounding = note.rounding ? `<p class="dose-safety-rounding"><strong>Po zaokrągleniu objętości:</strong> ${n(note.rounding.from, 6)} → ${n(note.rounding.to, 6)} ${esc(input.unitLabel)} na podanie (krok ${n(input.roundingStep, 6)} ${esc(input.unitLabel)}). Dawki dobowe uwzględniają tę zmianę.</p>` : '';
  const pending = note.dailyUnits === null ? '<p class="daily-dose-pending">Uzupełnij dawkę, częstotliwość i wymagane dane pacjenta. Czas kuracji nie jest potrzebny do podglądu dobowego.</p>' : '';
  const url = /^https?:\/\//i.test(note.sourceUrl || '') ? note.sourceUrl : '';
  const reference = url ? `<a class="daily-dose-source" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(note.sourceLabel || (veterinary ? 'Źródło dawkowania' : 'ChPL · dawkowanie'))} ↗</a>` : '';
  return `<div class="daily-dose-heading">${icon('info')}<h3 id="daily-dose-title">Dawki dobowe i granice</h3><span>Z tego preparatu</span></div>${source?.asNeeded ? '<p class="dose-safety-prn">Maksymalne planowane zużycie doraźne, nie obowiązkowa dawka.</p>' : ''}<dl class="dose-safety-rows">${rows || `<div class="dose-safety-row"><dt>Ilość preparatu</dt><dd>${note.dailyUnits === null ? '—' : n(note.dailyUnits, 6)} ${esc(input.unitLabel)}/dobę</dd></div>`}</dl>${rounding}${pending}${errors}${doseIssues}${missing}${scope}${caution}${reference}`;
}
