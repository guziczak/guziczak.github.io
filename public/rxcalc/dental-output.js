import { formatNumber as n } from './engine.js';
import { auditedDurationPolicy } from './duration-rules.js';

// These reviewed non-chronic policies also define entered days as supply.
// Do not infer that purpose from a medicine name, free text or a missing limit.
const supplyPolicies = new Set(['anticoagulant-vte-continuation', 'betaloc-hf-titration', 'toramide-oedema']);
export function dosingDuration({ source, days } = {}) {
  const audit = auditedDurationPolicy(source);
  const supply = audit.status === 'reviewed'
    && (audit.policy.kind === 'chronic' || supplyPolicies.has(audit.policyId));
  const period = Number.isFinite(days) && days > 0 ? `${n(days)} ${days === 1 ? 'dzień' : 'dni'}` : '';
  return {
    supply,
    summary: period ? `${supply ? 'Zapas na' : 'przez'} ${period}` : '',
    dosingSuffix: period ? `${supply ? '. Zapas na' : ' przez'} ${period}` : '',
  };
}

/** Legacy and custom human medicines may not have an explicit productKind. */
export function prescriptionPrefix(form, veterinary = false) {
  return !veterinary && (form?.productKind == null || form.productKind === 'medicine')
    ? 'Rp.' : 'Preparat:';
}

/** Share the full medicine format without inferring an instruction-only package's contents or count. */
export function prescriptionHeader({ form, name = form?.label || '', pack, packages, veterinary = false }) {
  const prefix = prescriptionPrefix(form, veterinary);
  const label = prefix === 'Rp.' ? pack.prescriptionLabel || pack.label : pack.label;
  const supply = Number.isFinite(packages) && packages > 0
    ? `${n(packages)} op. po ${label}` : `Opakowanie: ${pack.label}`;
  return `${prefix} ${name}\n${supply}`;
}

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
  let text = `D.S. Stosować ${amount}${route ? ` ${route}` : ''}, ${source?.asNeeded ? `w razie potrzeby, nie więcej niż ${count}` : count}${dosingDuration({source,days}).dosingSuffix}.`;
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
