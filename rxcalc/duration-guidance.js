import { resolveHumanRegimen } from './human-regimen-engine.js';

/** Duration-only references. These do not choose a course, validate the whole
 * treatment, modify dose limits, or change the existing export requirements.
 * An external recommendation is NOT a new minDays/maxDays source constraint.
 */
const SDCEP_URL = 'https://www.sdcepdentalprescribing.nhs.scot/guidance/bacterial-infections/dental-abscess/first-line-antibiotics/amoxicillin/';
const REVIEW_URL = 'https://www.sdcepdentalprescribing.nhs.scot/guidance/supporting-tools/bacterial-infections-review-tool/';
const OSPAMOX_SOURCES = new Map([
  ...['suspension', 'tablet'].flatMap(family => ['q8', 'q12', 'severe'].map(mode => [
    `dental-ospamox-${family}-ge40-${mode}`,
    family === 'suspension' ? ['ospamox-250', 'ospamox-500'] : ['ospamox-tablet-500', 'ospamox-tablet-1000'],
  ])),
  ['dental-ospamox-child-tid', ['ospamox-250', 'ospamox-500']],
]);
const positiveDay = v => Number.isSafeInteger(v) && v > 0 && v <= 3660;
const has = v => v !== null && v !== undefined && v !== '';
const finite = v => typeof v === 'number' && Number.isFinite(v);
const httpUrl = v => typeof v === 'string' && /^https:\/\/[^\s]+$/.test(v);
const rangeLabel = rule => rule.fixed ? `${rule.minimum} dni`
  : rule.minimum && rule.maximum ? `${rule.minimum}–${rule.maximum} dni`
    : rule.minimum ? `od ${rule.minimum} dni` : rule.maximum ? `do ${rule.maximum} dni` : '';

/** Deliberately ignore the entered dose and duration when checking whether a
 * source's patient scope applies. Use unmodified source values in a temporary
 * object, not the real state. No inference from package size/shelf life.
 */
export function durationPatientEligibility(source, context = {}) {
  if (!source || context.specialty === 'veterinary' || context.custom || context.calculationBlocked) return false;
  const sample = {
    ...context,
    dose: source.dose ?? source.doseRange?.min ?? null,
    frequency: source.frequency ?? source.frequencyOptions?.[0] ?? null,
    days: source.fixedDays ?? source.minDays ?? 1,
  };
  return resolveHumanRegimen(source, sample).valid;
}

function sdcepPatientScope(context) {
  // The inspected children's table starts at 6 months. Do not extend its
  // duration reference to the app's younger Ospamox population by inference.
  if (!has(context.age)) return context.patientType === 'adult';
  if (!finite(context.age) || context.age < 0) return false;
  const low = context.ageUnit === 'years' ? context.age * 12
    : context.ageUnit === 'months' ? context.age
      : context.ageUnit === 'days' ? context.age / 31 : null;
  if (low === null) return false;
  return context.patientType === 'adult' ? low >= 216 : context.patientType === 'child' && low >= 6;
}

export function resolveDurationGuidance({ source = null, form = null, context = {} } = {}) {
  const neutral = (reason, rule = null) => ({ applicable: false, rule, reason });
  if (!source || !form || context.custom || context.specialty === 'veterinary'
    || form.referenceOnly || form.calculationBlocked || !source.formIds?.includes(form.id)) {
    return neutral('Brak dopasowanego źródłowego zakresu czasu. Przyciski są tylko skrótami wpisywania.');
  }
  const keys = ['fixedDays', 'minDays', 'maxDays', 'reviewAfterDays'];
  if (keys.some(k => has(source[k]) && !positiveDay(source[k]))) {
    return neutral('Nie można ocenić czasu: nieprawidłowe dane źródłowe.');
  }
  let rule = null;
  if (keys.some(k => positiveDay(source[k]))) {
    // Existing numerical source duration fields remain unchanged. A maximum
    // with an explicit review requirement is NOT labelled an absolute ban.
    rule = {
      id: `duration:${source.id}`, origin: 'source', fixed: positiveDay(source.fixedDays),
      minimum: source.fixedDays ?? source.minDays ?? null,
      maximum: source.fixedDays ?? source.maxDays ?? null,
      reviewAfterDays: source.reviewAfterDays ?? null,
      hardMaximum: positiveDay(source.maxDays) && !positiveDay(source.reviewAfterDays),
      label: source.sourceLabel, url: source.sourceUrl, section: source.sourceSection,
      checkedAt: source.sourceCheckedAt, indication: source.indication,
      reviewUrl: null,
      note: 'Oceniany jest tylko czas wybranego schematu, nie poprawność całego leczenia. Dotychczasowe ograniczenia schematu pozostają aktywne.',
    };
  } else if (context.specialty === 'dental' && OSPAMOX_SOURCES.get(source.id)?.includes(form.id)
    && source.specialties?.includes('dental')) {
    rule = {
      id: 'sdcep-amoxicillin-dental-abscess-duration', origin: 'external', fixed: false,
      minimum: 3, maximum: 5, hardMaximum: false, reviewAfterDays: 3,
      label: 'SDCEP (Szkocja) · amoksycylina, ropień zębowy', url: SDCEP_URL,
      reviewUrl: REVIEW_URL, section: 'Czas antybiotykoterapii i ponowna ocena', checkedAt: '2026-11-16',
      indication: 'Ropień zębowy, gdy antybiotyk jest wskazany, z leczeniem miejscowym/przyczynowym.',
      note: 'To osobne odniesienie do czasu z zagranicznych wytycznych, nie zapis ChPL Ospamoxu ani potwierdzenie całego schematu dawkowania. Czas ustala lekarz według odpowiedzi pacjenta. Brak poprawy lub pogorszenie wymaga wcześniejszego kontaktu; decyzja o skróceniu kuracji zapada po ocenie.',
    };
    if (!sdcepPatientScope(context)) return neutral('Brak potwierdzonego zakresu wieku dla tego odniesienia do czasu (tabela dziecięca SDCEP od 6 miesięcy).', rule);
  }
  if (!rule) return neutral('Brak źródłowego zakresu czasu dla tego schematu. Przyciski są tylko skrótami wpisywania.');
  if (!httpUrl(rule.url) || !rule.label || (rule.minimum && rule.maximum && rule.minimum > rule.maximum)) {
    return neutral('Nie można ocenić czasu: niepełne lub sprzeczne odniesienie źródłowe.');
  }
  if (!durationPatientEligibility(source, { ...context, formId: form.id })) {
    return neutral('Uzupełnij lub sprawdź dane pacjenta. Kolorowa ocena czasu jest wstrzymana.', rule);
  }
  return { applicable: true, rule, reason: '' };
}

/** Every button and a manually entered duration use the same classification.
 * "within" refers only to duration; it never means "safe" or "approved".
 */
export function assessDuration(value, guidance) {
  const blank = !has(value) || typeof value === 'string' && !value.trim();
  if (blank) return { state: 'pending', tone: 'neutral', short: '', message: 'Wybierz czas; żadna liczba dni nie jest ustawiana automatycznie.' };
  const days = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  if (!positiveDay(days)) return { state: 'invalid', tone: 'critical', short: 'Nieprawidłowy czas', message: 'Podaj całkowitą liczbę dni od 1 do 3660.' };
  if (!guidance?.applicable || !guidance.rule) return { state: 'unassessed', tone: 'neutral', short: '', message: guidance?.reason || 'Brak źródłowego zakresu czasu.' };
  const r = guidance.rule;
  if (r.minimum && days < r.minimum) return {
    state: 'below', tone: 'warning', short: 'Krócej',
    message: `Krócej niż ${rangeLabel(r)} ${r.origin === 'external' ? 'w SDCEP' : 'w źródle'} — wymaga indywidualnej oceny.`,
  };
  if (r.maximum && days > r.maximum) return {
    state: 'above', tone: r.hardMaximum ? 'critical' : 'warning',
    short: r.hardMaximum ? 'Ponad limit' : 'Dłużej',
    message: r.hardMaximum ? `Przekroczony limit czasu wybranego schematu: ${r.maximum} dni. To nie jest uniwersalny limit leku.`
      : `Dłużej niż ${rangeLabel(r)} ${r.origin === 'external' ? 'w SDCEP' : 'w źródle'} — wymaga indywidualnej oceny.`,
  };
  if (r.reviewAfterDays && days > r.reviewAfterDays && r.origin !== 'external') return {
    state: 'review', tone: 'warning', short: 'Ocena',
    message: `Stosowanie dłużej niż ${r.reviewAfterDays} dni wymaga ponownej oceny według źródła. Termin oceny nie wyznacza końca kuracji.`,
  };
  if (r.minimum && r.maximum) return {
    state: 'within', tone: 'within', short: r.fixed ? 'Ze źródła' : 'W zakresie',
    message: `Czas w ${r.fixed ? 'wybranym schemacie' : `zakresie ${rangeLabel(r)}`}${r.origin === 'external' ? ' według SDCEP' : ' ze źródła'}. Nie potwierdza doboru dawki ani leczenia.`,
  };
  return { state: 'unassessed', tone: 'neutral', short: '', message: 'Źródło określa warunek czasu lub kontroli, ale nie pełny zalecany zakres długości leczenia.' };
}

export function durationResultWarning(value, guidance) {
  const result = assessDuration(value, guidance);
  return guidance?.applicable && ['below', 'above', 'review'].includes(result.state) ? result.message : null;
}
