import { regimenMeterMarkup, regimenLegendMarkup, regimenDosePercentMarkup } from './dose-regimen.js';
import { adultAugmentinReference, referenceMeterMarkup, referenceIntroMarkup, referenceDetailsMarkup } from './dose-reference.js';
import { formatNumber as n } from './engine.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g,
  char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const tolerance = (a, b) => Number.EPSILON * 64 * Math.max(1, Math.abs(a), Math.abs(b));

const dailyDoseViews = new WeakMap();
const doseMotionSelector = '.dose-scheme-fill, .dose-reference-fill, .dose-safety-fill, .dose-safety-excess, .dose-scheme-band, .dose-scheme-marker, .dose-scheme-wall, .dose-scheme-tick';

/** Numeric edits may rescale one comparison. Only a new product, source or
 * measurement basis resets its motion; frequency and numeric bounds do not.
 */
export function dailyDoseMotionContext({note, form, source, specialty, patientType, species} = {}) {
  return JSON.stringify([specialty, patientType, species, form?.id, source?.id,
    (note?.rows || []).map((row, index) => {
      const scheme = note.schemeRows?.[index];
      const perKg = scheme?.perKg ?? (!positive(row.ceiling) && positive(row.ceilingPerKg));
      // An out-of-source frequency can replace the source range with its known
      // limit. It is still the same ingredient and measurement: the drawing's
      // family is not a new identity. Bare limits keep their own provenance.
      return [row.name, row.unit, source ? ['source', perKg] : ['limit', note.ceilingKind, perKg]];
    })]);
}

function doseGeometry(node) {
  return [...node.querySelectorAll('.dose-safety-row')].flatMap((row, index) =>
    [...row.querySelectorAll(doseMotionSelector)].map(element => {
      const classes = element.className.split(/\s+/);
      const band = classes.includes('dose-scheme-band');
      const centered = classes.some(name => ['dose-scheme-marker', 'dose-scheme-wall', 'dose-scheme-tick'].includes(name));
      const fillPart = classes.includes('dose-safety-fill') ? 'base'
        : classes.includes('dose-safety-excess') ? 'excess'
        : classes.some(name => ['dose-scheme-fill', 'dose-reference-fill'].includes(name)) ? 'whole' : null;
      const rowKey = `${index}:${row.querySelector('dt')?.textContent}`;
      return {element, centered, properties: band ? ['left', 'width'] : centered ? ['left'] : ['width'],
        rowKey, fillPart, key: `${rowKey}:${element.dataset?.doseMotion || element.className}`};
    }));
}

function geometryValues({element, centered, properties}, target = false) {
  const track = element.parentElement.getBoundingClientRect();
  if (!(track.width > 0 && track.height > 0)) return null;
  const rect = element.getBoundingClientRect();
  return Object.fromEntries(properties.map(property => {
    const inline = element.style[property] || '';
    // Preserve exact percent targets. Tick labels use clamp(), so read their
    // resolved centre rather than parsing CSS or confusing it with the left edge.
    const value = target && /^-?(?:\d+\.?\d*|\.\d+)%$/.test(inline)
      ? Number.parseFloat(inline)
      : (property === 'width' ? rect.width : rect.left + (centered ? rect.width / 2 : 0) - track.left) / track.width * 100;
    return [property, value];
  }));
}

function rememberFillEdge(edges, entry, values) {
  if (!entry.fillPart || !Number.isFinite(values?.width)) return;
  // Zero excess must not turn a short base into a fictitious 80% fill.
  const edge = entry.fillPart === 'excess' ? (values.width > 0 ? 80 + values.width : 0) : values.width;
  edges.set(entry.rowKey, Math.max(edges.get(entry.rowKey) || 0, edge));
}

function fillFrames(from, to, part) {
  const width = value => part === 'base' ? Math.min(value, 80)
    : part === 'excess' ? Math.max(0, value - 80) : value;
  const frames = [{width:`${width(from)}%`}, {width:`${width(to)}%`}];
  const crossing = (80 - from) / (to - from);
  // Both pieces follow one eased edge. Without this shared breakpoint, excess
  // would grow from 80% before a shorter base had reached it, leaving a gap.
  if (part !== 'whole' && crossing > 0 && crossing < 1) {
    frames[0].offset = 0; frames[1].offset = 1;
    frames.splice(1, 0, {width:`${width(80)}%`, offset:crossing});
  }
  return frames;
}

/** Numbers and warnings update immediately. The fill, source band, boundaries
 * and their labels interpolate together, including when the scale changes.
 * Read visible geometry before cancellation so rapid edits continue in place.
 */
export function renderDailyDoseNote(node, markup, context = '') {
  const previous = dailyDoseViews.get(node);
  if (previous?.markup === markup && previous.context === context) return;
  const view = node.ownerDocument.defaultView;
  const reducedMotion = view?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const canAnimate = previous?.context === context && !reducedMotion?.matches;
  const geometry = new Map(), visibleEdges = new Map();
  if (canAnimate) {
    for (const entry of doseGeometry(node)) {
      const values = geometryValues(entry);
      if (values) geometry.set(entry.key, values);
      rememberFillEdge(visibleEdges, entry, values);
    }
  }
  previous?.cancel();
  node.innerHTML = markup;

  const animations = [];
  const cancel = () => {
    for (const animation of animations) animation.cancel();
    reducedMotion?.removeEventListener?.('change', cancel);
  };
  dailyDoseViews.set(node, {markup, context, cancel});
  if (!canAnimate) return;
  const entries = doseGeometry(node).map(entry => ({...entry, to:geometryValues(entry, true)}));
  const targetEdges = new Map();
  for (const entry of entries) rememberFillEdge(targetEdges, entry, entry.to);
  for (const entry of entries) {
    if (!entry.to || !entry.element.animate) continue;
    let frames;
    if (entry.fillPart && visibleEdges.has(entry.rowKey) && targetEdges.has(entry.rowKey)) {
      frames = fillFrames(visibleEdges.get(entry.rowKey), targetEdges.get(entry.rowKey), entry.fillPart);
      if (!frames.some(frame => Math.abs(Number.parseFloat(frame.width) - Number.parseFloat(frames[0].width)) >= .01)) continue;
    } else {
      const from = geometry.get(entry.key), to = entry.to;
      if (!from) continue;
      const properties = entry.properties.filter(property => Number.isFinite(from[property]) && Number.isFinite(to[property]));
      if (!properties.some(property => Math.abs(from[property] - to[property]) >= .01)) continue;
      const frame = values => Object.fromEntries(properties.map(property => [property, `${values[property]}%`]));
      frames = [frame(from), frame(to)];
    }
    try {
      animations.push(entry.element.animate(frames, {
        duration: 240, easing: 'ease-out',
      }));
    } catch { /* Older browsers still display the final, current value. */ }
  }
  if (animations.length) {
    const startTime = node.ownerDocument.timeline?.currentTime;
    if (Number.isFinite(startTime)) {
      for (const animation of animations) animation.startTime = startTime;
    }
    reducedMotion?.addEventListener?.('change', cancel, {once: true});
    Promise.allSettled(animations.map(animation => animation.finished))
      .then(() => reducedMotion?.removeEventListener?.('change', cancel));
  }
}

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
  // An unknown denominator is not an alarm, a zero dose or a loading bar. The
  // renderer presents one neutral instruction below the quantities instead.
  if (model.state === 'unknown') return '';
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
  const graphic = `<div class="dose-safety-meter ${scaled ? '' : 'unscaled'} ${model.state}" role="img" aria-label="${esc(graphicLabel)}"><span class="dose-safety-track"></span>${scaled ? `${model.fill === null ? '' : `<span class="dose-safety-fill" style="width:${model.fill}%"></span><span class="dose-safety-excess" style="width:${model.excess}%"></span>`}<span class="dose-safety-wall" aria-hidden="true"></span>${model.clipped ? '<span class="dose-safety-overflow" aria-hidden="true">›</span>' : ''}` : ''}</div>`;
  const axis = scaled ? '<div class="dose-safety-axis" aria-hidden="true"><span>0</span><span class="dose-safety-axis-limit">100% · granica</span><span>125%</span></div>' : '';
  const derived = row.derivedCeiling ? '<p class="dose-safety-derived">Z proporcji składników preparatu — nie jest to niezależne maksimum tej substancji.</p>' : '';
  return `${boundary}${weightBoundary}${graphic}${axis}<div class="dose-safety-status ${model.state}"><span>${esc(stateText)}</span>${comparison}</div>${derived}`;
}

/** Pure HTML renderer. No source limits are invented and no input is mutated. */
export function dailyDoseMarkup({ note, input = {}, source = null, context = '', eligibility = null, doseProblems = [], canChooseSource = false, veterinary = false, referenceContext = null, modified = false, roundingAssessment = null, icon = () => '' } = {}) {
  if (!note) return '';
  const comparisonAllowed = !source || (eligibility?.valid === true || !eligibility && note.comparisonEligibility?.valid === true)
    && note.comparisonEligibility?.valid !== false;
  const hasCeiling = note.rows.some(row => positive(row.ceiling) || positive(row.ceilingPerKg));
  const comparative = !hasCeiling && !veterinary && referenceContext
    ? adultAugmentinReference({...referenceContext,input,source}) : null;
  const schemes = note.schemeRows?.some(Boolean) ? note.schemeRows : null;
  const rows = note.rows.map((row,index) => {
    const percent=!comparative && schemes?.[index] ? regimenDosePercentMarkup(row,schemes[index],comparisonAllowed,roundingAssessment) : '';
    return `<div class="dose-safety-row"><dt>${esc(row.name)}</dt><dd><div class="dose-safety-amount ${percent?'has-scheme-percent':''}"><strong>${row.daily === null ? '—' : n(row.daily, 6)} <span>${esc(row.unit)}/dobę</span></strong>${row.perKg === null ? '' : `<small>${n(row.perKg, 4)} ${esc(row.unit)}/kg/dobę</small>`}${percent}</div>${comparative ? referenceMeterMarkup(row, comparative) || meterMarkup(row, note, comparisonAllowed) : (schemes?.[index] ? regimenMeterMarkup(row, schemes[index], comparisonAllowed,roundingAssessment) : meterMarkup(row, note, comparisonAllowed))}</dd></div>`;
  }).join('');
  const hasDerived = note.rows.some(row => row.derivedCeiling);
  const scope = source ? `<p class="daily-dose-scope"><strong>${modified ? 'Źródło odniesienia dla zmodyfikowanego schematu:' : 'Wybrany schemat:'}</strong> ${esc(source.label)}${source.phaseLabel ? ` · ${esc(source.phaseLabel)}` : ''}. Porównanie dotyczy wyłącznie tego wskazania, etapu i zakresu pacjentów.</p>` : '';
  const eligibilityErrors = [...new Set([...(eligibility?.errors||[]),...(note.comparisonEligibility?.errors||[])])];
  const awaitingContext = !eligibilityErrors.length || eligibilityErrors.every(error => /^(Uzupełnij|Wybierz|Podaj wiek w|Potwierdź warunki wybranego schematu)\b/.test(error));
  const errors = source && !comparisonAllowed
    ? awaitingContext
      ? `<div class="daily-dose-guidance"><p class="daily-dose-pending">Uzupełnij dane do porównania ze schematem.</p>${eligibilityErrors.length ? `<ul>${eligibilityErrors.map(error => `<li>${esc(error)}</li>`).join('')}</ul>` : ''}</div>`
      : `<div class="dose-safety-notice"><strong>Nie potwierdzono warunków porównania.</strong><p>Wartości źródłowe wymagają spełnienia warunków wybranego schematu.</p>${eligibilityErrors.length ? `<ul>${eligibilityErrors.map(error => `<li>${esc(error)}</li>`).join('')}</ul>` : ''}</div>` : '';
  const problems = [...new Set([...doseProblems,...(note.calculationErrors||[])])];
  const doseIssues = comparisonAllowed && problems.length ? `<div class="dose-safety-notice"><strong>Sprawdź zgodność i odmierzenie dawki.</strong><ul>${problems.map(error => `<li>${esc(error)}</li>`).join('')}</ul></div>` : '';
  const missingText = !source
    ? canChooseSource ? 'Wybierz schemat, aby zobaczyć dawkę źródłową i jej progi.'
      : 'Podgląd ilości dobowej. Porównanie pojawi się po wybraniu schematu lub podaniu limitu ze źródła.'
    : source.frequencyOptions && !source.frequencyOptions.includes(input.frequency)
      ? 'Wybierz częstość podawania z dostępnych opcji schematu.'
      : 'Ten schemat nie określa liczbowej dawki do porównania.';
  const missing = !hasCeiling && !comparative && !schemes && !(source && !comparisonAllowed)
    ? `<div class="daily-dose-guidance"><p class="daily-dose-pending">${esc(missingText)}</p>${canChooseSource ? '<button type="button" class="text-button dose-safety-source-choice" data-action="daily-dose-source">Wybierz schemat ze źródła</button>' : ''}</div>` : '';
  const caution = hasCeiling ? `<p class="dose-safety-caution">${note.ceilingKind === 'manual' ? 'Limit ręczny nie jest automatycznie weryfikowany w ChPL. ' : ''}${hasDerived && !schemes ? 'Składniki porównano do tej samej granicy schematu. ' : ''}Położenie na pasku nie potwierdza bezpieczeństwa ani prawidłowego doboru dawki. Uwzględnij także inne leki z tą samą substancją.</p>` : '';
  const rounding = note.rounding ? `<p class="dose-safety-rounding"><strong>Po zaokrągleniu ${['suspension','solution','injection'].includes(input.form)?'objętości':'ilości'}:</strong> ${n(note.rounding.from, 6)} → ${n(note.rounding.to, 6)} ${esc(note.unitLabel||input.unitLabel)} na podanie (krok ${n(input.roundingStep, 6)} ${esc(note.unitLabel||input.unitLabel)}). Dawki dobowe uwzględniają tę zmianę.</p>` : '';
  const pending = note.dailyUnits === null && !(source && !comparisonAllowed && awaitingContext) ? '<p class="daily-dose-pending">Uzupełnij dawkę, częstotliwość i wymagane dane pacjenta. Czas kuracji nie jest potrzebny do podglądu dobowego.</p>' : '';
  const url = /^https?:\/\//i.test(note.sourceUrl || '') ? note.sourceUrl : '';
  const reference = url ? `<a class="daily-dose-source" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(note.sourceLabel || (veterinary ? 'Źródło dawkowania' : 'ChPL · dawkowanie'))} ↗</a>` : '';
  return `<div class="daily-dose-heading">${icon('info')}<h3 id="daily-dose-title">${comparative ? 'Dawki dobowe i odniesienia' : schemes ? 'Dawki dobowe i zakres schematu' : hasCeiling ? 'Dawki dobowe i granice' : 'Dawki dobowe'}</h3><span>Z tego preparatu</span></div>${source?.asNeeded ? '<p class="dose-safety-prn">Maksymalne planowane zużycie doraźne, nie obowiązkowa dawka.</p>' : ''}${referenceIntroMarkup(comparative)}${regimenLegendMarkup(schemes)}<dl class="dose-safety-rows">${rows || `<div class="dose-safety-row"><dt>Ilość preparatu</dt><dd>${note.dailyUnits === null ? '—' : n(note.dailyUnits, 6)} ${esc(note.unitLabel||input.unitLabel)}/dobę</dd></div>`}</dl>${rounding}${pending}${errors}${doseIssues}${missing}${scope}${caution}${referenceDetailsMarkup(comparative)}${comparative ? '' : reference}`;
}
