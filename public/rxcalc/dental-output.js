import { formatNumber as n } from './engine.js';

const durationText = days => Number.isFinite(days) && days > 0
  ? ` przez ${n(days)} ${days === 1 ? 'dzień' : 'dni'}` : '';

/** Full prescriptions contain dispensing and dosing; human advice also names the chosen indication. */
export function prescriptionText({ mode = 'full', header, dosing, source, veterinaryContext = '' }) {
  const lines = [];
  if (veterinaryContext) {
    lines.push(veterinaryContext);
    if (source?.indication) lines.push(`Wskazanie: ${source.indication}.`);
    if (source?.phaseLabel) lines.push(`Schemat: ${source.phaseLabel}.`);
  } else if (mode === 'ds' && source?.indication?.trim()) {
    const indication = source.indication.trim();
    lines.push(`Wskazanie: ${indication}${/[.!?]$/.test(indication) ? '' : '.'}`, '');
  }
  if (mode !== 'ds' && header) lines.push(header);
  if (dosing) lines.push(dosing);
  return lines.join('\n');
}

/** Keep PRN ceilings separate from a fixed daily schedule in copied instructions. */
export function humanDosingText({ source, sourceModified = false, amount, route = '', frequency, days, effectiveDailyLimit, extraInstructions = '' }) {
  const count = `${n(frequency)} ${frequency === 1 ? 'raz' : 'razy'} na dobę`;
  let text = `D.S. Stosować ${amount}${route ? ` ${route}` : ''}, ${source?.asNeeded ? `w razie potrzeby, nie więcej niż ${count}` : count}${durationText(days)}.`;
  if (source?.asNeeded && source.minIntervalHours) text += ` Pomiędzy podaniami zachować co najmniej ${n(source.minIntervalHours)} godz.`;
  const dailyLimit = effectiveDailyLimit === undefined ? source?.maxDailyMg : effectiveDailyLimit;
  if (source?.asNeeded && dailyLimit > 0) text += ` Nie przekraczać łącznie ${n(dailyLimit)} mg tej substancji na dobę ze wszystkich preparatów.`;
  // A modified schedule must not export contradictory source prose (e.g. an
  // original "3 administrations" after editing to 2). Structured PRN/interval
  // limits above remain in force; the clinician supplies any extra instructions.
  if (source?.administration && !sourceModified) text += ` ${source.administration}`;
  if (extraInstructions.trim()) text += ` ${extraInstructions.trim()}`;
  return text;
}

export function instructionDosingText({ source, frequency, days, extraInstructions = '' }) {
  if (!source?.instructionText) return '';
  let text = `D.S. ${source.instructionText}`;
  if (Number.isFinite(frequency) && frequency > 0) text += ` ${source.asNeeded ? 'W razie potrzeby, maksymalnie ' : 'Częstotliwość: '}${n(frequency)} ${frequency === 1 ? 'raz' : 'razy'} na dobę.`;
  if (Number.isFinite(days) && days > 0) text += ` Czas stosowania: ${n(days)} ${days === 1 ? 'dzień' : 'dni'}.`;
  if (source.administration) text += ` ${source.administration}`;
  if (extraInstructions.trim()) text += ` ${extraInstructions.trim()}`;
  return text;
}
