/** Editing source-derived HUMAN numeric regimens. No clinical limits are changed. */
import { formatNumber as n } from './engine.js';
import { ADULT_AUGMENTIN_ROUNDED_SHORTCUT as roundingRule } from './rounded-volume-shortcuts.js';

const number = value => value === '' || value === null || value === undefined
  ? null : Number(String(value).trim().replace(',', '.'));
const same = (a, b) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= Number.EPSILON * 32 * Math.max(1, Math.abs(a), Math.abs(b));
const esc = value => String(value ?? '').replace(/[&<>"']/g,
  char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const editableHumanSource = source => !!source && source.doseMode !== 'instruction';

/** Fixed choices are filled only on selection/restore. Ranges stay unchosen. */
export function sourceInitialValues(source) {
  if (!editableHumanSource(source)) return null;
  return { dose:source.dose == null ? '' : String(source.dose),
    frequency:source.frequency == null ? '' : String(source.frequency) };
}

/** A current, exact rule assessment is distinct from a general numeric edit.
 * The caller re-assesses patient/device/limit eligibility before passing it in;
 * this guard also prevents a stale dose/frequency or another source from
 * inheriting its neutral provenance and source administration instructions.
 */
function isRuleRounding(source, dose, frequency, assessment) {
  return assessment?.state === 'rule' && assessment.ruleId === roundingRule.id
    && assessment.revision === roundingRule.policyRevision && !assessment.errors?.length
    && source.id === roundingRule.sourceId && source.doseMode === 'fixed'
    && source.dose === roundingRule.referenceMg && !source.doseRange && source.frequency === 2
    && source.formIds?.length === 1 && source.formIds[0] === roundingRule.formId
    && source.patientTypes?.length === 1 && source.patientTypes[0] === 'adult'
    && source.roundingConstraintKind === 'source-target'
    && source.maxSingleMg === 875 && source.maxDailyMg === 1750
    && same(assessment.referenceSingleMg, roundingRule.referenceMg)
    && same(assessment.singleMg, roundingRule.amoxicillinMg)
    && same(assessment.dailyMg, roundingRule.amoxicillinMg * 2)
    && same(assessment.ml, roundingRule.ml)
    && same(frequency, source.frequency)
    && (same(dose, source.dose) || same(dose, assessment.singleMg));
}

/** Selection within an allowed range is not an override. Empty fixed values
 * are an unfinished edit, not permission to silently refill the source dose. */
export function sourceEditState(source, input = {}, roundingAssessment = null) {
  if (!editableHumanSource(source)) return { modified:false, doseChanged:false, frequencyChanged:false, rounded:false };
  const dose = number(input.dose), frequency = number(input.frequency);
  const doseChanged = source.dose != null ? !same(dose, source.dose)
    : dose !== null && (!Number.isFinite(dose) || dose < source.doseRange.min || dose > source.doseRange.max);
  const frequencyChanged = source.frequency != null ? !same(frequency, source.frequency)
    : frequency !== null && !source.frequencyOptions?.includes(frequency);
  const rounded = !frequencyChanged && isRuleRounding(source, dose, frequency, roundingAssessment);
  return { modified:!rounded && (doseChanged || frequencyChanged), doseChanged, frequencyChanged, rounded };
}

export function sourceEditMarkup(source, input, unit, roundingAssessment = null) {
  if (!editableHumanSource(source)) return '';
  const { modified, rounded } = sourceEditState(source, input, roundingAssessment);
  const dose = source.dose != null ? n(source.dose, 6)
    : `${n(source.doseRange.min, 6)}–${n(source.doseRange.max, 6)}`;
  const frequency = source.frequency != null ? n(source.frequency)
    : source.frequencyOptions.map(value => n(value)).join(' / ');
  if (rounded) return `<div class="source-edit-status rounded" role="status"><strong>Zaokrąglono według reguły</strong><span>Źródło: ${dose} ${esc(unit)} · ${frequency} × na dobę.</span><span>Na podanie: ${n(roundingAssessment.referenceSingleMg)} → ${n(roundingAssessment.singleMg)} mg · ${n(roundingRule.referenceMl,6)} → ${n(roundingAssessment.ml)} ml.</span></div><button type="button" class="text-button" data-action="restore-source-values">Przywróć wartości ze źródła</button><p class="small-help">Zachowano częstotliwość i zalecenia podania ze źródła. Pozostałe warunki i limity nadal obowiązują.</p>`;
  return `<div class="source-edit-status ${modified ? 'modified' : ''}" role="status"><strong>${modified ? 'Zmodyfikowany przez użytkownika' : 'Wartości ze źródła · można nadpisać'}</strong><span>Źródło: ${dose} ${esc(unit)} · ${frequency} × na dobę.</span></div><button type="button" class="text-button" data-action="restore-source-values">Przywróć wartości ze źródła</button><p class="small-help">${modified ? 'Zachowano kontrolę granic i warunków źródła. Sprawdź dodatkowe zalecenia przed kopiowaniem — opis podania ze źródła nie jest dołączany automatycznie do zmienionego schematu.' : 'Zmień dawkę lub częstotliwość w polach powyżej. Limity i ostrzeżenia pozostają aktywne.'}</p>`;
}
