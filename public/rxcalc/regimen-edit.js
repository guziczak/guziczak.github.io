/** Editing source-derived HUMAN numeric regimens. No clinical limits are changed. */
import { formatNumber as n } from './engine.js';

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

/** Selection within an allowed range is not an override. Empty fixed values
 * are an unfinished edit, not permission to silently refill the source dose. */
export function sourceEditState(source, input = {}) {
  if (!editableHumanSource(source)) return { modified:false, doseChanged:false, frequencyChanged:false };
  const dose = number(input.dose), frequency = number(input.frequency);
  const doseChanged = source.dose != null ? !same(dose, source.dose)
    : dose !== null && (!Number.isFinite(dose) || dose < source.doseRange.min || dose > source.doseRange.max);
  const frequencyChanged = source.frequency != null ? !same(frequency, source.frequency)
    : frequency !== null && !source.frequencyOptions?.includes(frequency);
  return { modified:doseChanged || frequencyChanged, doseChanged, frequencyChanged };
}

export function sourceEditMarkup(source, input, unit) {
  if (!editableHumanSource(source)) return '';
  const { modified } = sourceEditState(source, input);
  const dose = source.dose != null ? n(source.dose, 6)
    : `${n(source.doseRange.min, 6)}–${n(source.doseRange.max, 6)}`;
  const frequency = source.frequency != null ? n(source.frequency)
    : source.frequencyOptions.map(value => n(value)).join(' / ');
  return `<div class="source-edit-status ${modified ? 'modified' : ''}" role="status"><strong>${modified ? 'Zmodyfikowany przez użytkownika' : 'Wartości ze źródła · można nadpisać'}</strong><span>Źródło: ${dose} ${esc(unit)} · ${frequency} × na dobę.</span></div><button type="button" class="text-button" data-action="restore-source-values">Przywróć wartości ze źródła</button><p class="small-help">${modified ? 'Zachowano kontrolę granic i warunków źródła. Sprawdź dodatkowe zalecenia przed kopiowaniem — opis podania ze źródła nie jest dołączany automatycznie do zmienionego schematu.' : 'Zmień dawkę lub częstotliwość w polach powyżej. Limity i ostrzeżenia pozostają aktywne.'}</p>`;
}
