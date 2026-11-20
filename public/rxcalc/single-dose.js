/** One explicitly selected, monitored IV administration of undiluted Fentanyl WZF.
 * This resolver is deliberately separate from the course/daily-dose engine.
 * It never chooses a dose, a repeat interval, a duration, or outpatient supplies.
 */
const FORM_ID = 'fentanyl-wzf-50';
const CONCENTRATION = 50;
const COMMON_CONFIRMATIONS = [
  'fentanyl-monitored-setting', 'fentanyl-spontaneous-breathing',
  'fentanyl-individual-assessment', 'fentanyl-undiluted-iv',
];
const PHASES = Object.freeze({
  initial: { id: 'cardio-fentanyl-initial', minimum: 50, maximum: 200 },
  additional: { id: 'cardio-fentanyl-additional', reference: 50, maximum: 50 },
});
const AGE_FACTORS = Object.freeze({ years: 1, months: 1 / 12, days: 1 / 365.25 });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const positive = value => finite(value) && value > 0;
const missing = value => value === null || value === undefined || value === '';
const string = value => typeof value === 'string' && value.trim().length > 0;
const clean = value => Number(value.toPrecision(14));
const tolerance = (a, b) => Number.EPSILON * 32 * Math.max(1, Math.abs(a), Math.abs(b));
const same = (a, b) => finite(a) && finite(b) && Math.abs(a - b) <= tolerance(a, b);
const above = (a, b) => a > b && !same(a, b);
const only = (values, value) => Array.isArray(values) && values.length === 1 && values[0] === value;

function numberText(value) {
  if (!finite(value)) return '—';
  // Tiny entered values must never be exported as a rounded zero.
  return new Intl.NumberFormat('pl-PL', {
    useGrouping: false, maximumSignificantDigits: 14,
    ...(value !== 0 && Math.abs(value) < 1e-6 ? { notation: 'scientific' } : {}),
  }).format(value);
}

export { numberText as formatSingleDoseNumber };

function sourceMetadataValid(source) {
  if (!object(source) || typeof source.phase !== 'string' || !Object.hasOwn(PHASES, source.phase)) return false;
  const phase = PHASES[source.phase];
  if (source.id !== phase.id || !only(source.formIds, FORM_ID)
      || !only(source.specialties, 'cardio') || !only(source.patientTypes, 'adult')
      || source.calculationMode !== 'single-dose' || source.doseUnit !== 'microgram'
      || source.routeCode !== 'iv' || source.minAgeMonths !== 216
      || source.maxMicrograms !== phase.maximum
      || (source.phase === 'initial' ? source.minMicrograms !== phase.minimum
        : source.referenceDoseMicrograms !== phase.reference)
      || !string(source.label) || !string(source.phaseLabel)
      || !string(source.sourceUrl) || !/^https?:\/\//i.test(source.sourceUrl)
      || !string(source.monitoringText) || !string(source.administration)) return false;
  const requirements = source.selectionRequirements;
  if (!Array.isArray(requirements) || !Array.from(requirements).every(item => object(item)
      && string(item.id) && string(item.label) && (item.detail == null || string(item.detail)))) return false;
  const ids = requirements.map(item => item.id);
  if (new Set(ids).size !== ids.length) return false;
  const required = [...COMMON_CONFIRMATIONS,
    ...(source.phase === 'additional' ? ['fentanyl-additional-reassessment'] : [])];
  return required.every(id => ids.includes(id));
}

function ageYears(context) {
  if (!finite(context.age) || context.age < 0 || typeof context.ageUnit !== 'string'
      || !Object.hasOwn(AGE_FACTORS, context.ageUnit)) return null;
  const years = context.age * AGE_FACTORS[context.ageUnit];
  return finite(years) ? years : null;
}

/** Offer source choices by product and adult profile, not by entered age.
 * The resolver checks age so inherited or incomplete values can be corrected
 * without hiding the very source selector needed to finish the form.
 */
export function availableSingleDoseSources(sources, context = {}) {
  if (!Array.isArray(sources) || !object(context) || context.formId !== FORM_ID
      || context.specialty !== 'cardio' || context.patientType !== 'adult') return [];
  const seen = new Set();
  return sources.filter(source => {
    if (!sourceMetadataValid(source) || seen.has(source.id)) return false;
    seen.add(source.id);
    return true;
  });
}

/** Typed numeric context only. Quantities may remain visible for an entered
 * dose outside the selected source; valid stays false and export is unavailable.
 * Required confirmations belong to the chosen source and are never inferred.
 */
export function resolveSingleDose(form, source, context = {}) {
  const result = {
    valid: false, status: 'incomplete', errors: [], warnings: [],
    doseMicrograms: null, activeDrugMicrograms: null, volumeMl: null,
    containersNeeded: null, volumeWasteMl: null, containerMl: null,
    containerMicrograms: null, concentrationMicrogramsPerMl: null,
    formId: null, sourceId: null, packId: null, contextKey: null,
  };
  let critical = false;
  const error = (message, severity = 'critical') => {
    result.errors.push(message);
    if (severity === 'critical') critical = true;
  };
  const finish = () => {
    result.errors = [...new Set(result.errors)];
    result.warnings = [...new Set(result.warnings)];
    result.valid = result.errors.length === 0;
    result.status = result.valid ? result.warnings.length ? 'warning' : 'ok'
      : critical ? 'critical' : 'incomplete';
    return result;
  };
  if (!object(context)) {
    error('Nieprawidłowe dane pojedynczego podania.');
    return finish();
  }
  const formValid = object(form) && form.id === FORM_ID
    && string(form.label)
    && form.calculationMode === 'single-dose' && form.form === 'injection'
    && form.doseUnit === 'microgram' && form.unitLabel === 'ml'
    && form.routeCode === 'iv' && form.concentrationMicrogramsPerMl === CONCENTRATION
    && form.singleUseContainer === true
    && form.referenceOnly !== true && form.calculationBlocked !== true;
  if (!formValid) {
    error('Wybierz zweryfikowaną postać Fentanyl WZF 50 mikrogramów/ml do pojedynczego podania dożylnego.');
    return finish();
  }
  result.formId = form.id;
  result.concentrationMicrogramsPerMl = form.concentrationMicrogramsPerMl;
  if (!sourceMetadataValid(source)) {
    error(source == null ? 'Wybierz źródło pojedynczego podania.'
      : 'Źródło nie odpowiada zweryfikowanemu zakresowi tego kalkulatora.', source == null ? 'incomplete' : 'critical');
    return finish();
  }
  result.sourceId = source.id;
  if (context.formId !== form.id || context.specialty !== 'cardio')
    error('Wybrane źródło dotyczy tej konkretnej postaci w kalkulatorze kardiologicznym.');
  if (context.patientType !== 'adult') error('Ten widok obejmuje wyłącznie dorosłych w wieku co najmniej 18 lat.');
  const years = ageYears(context);
  if (missing(context.age)) error('Uzupełnij wiek pacjenta.', 'incomplete');
  else if (years === null || years > 130) error('Podaj poprawny wiek i jego jednostkę.');
  else if (years < 18) error('Ten widok obejmuje wyłącznie dorosłych w wieku co najmniej 18 lat.');
  if (context.demo === true) error('Przykład demonstracyjny nie służy do tworzenia zlecenia.', 'incomplete');

  const packs = Array.isArray(form.packOptions) ? form.packOptions : [];
  const matches = packs.filter(pack => object(pack) && pack.id === context.packId);
  const pack = matches.length === 1 ? matches[0] : null;
  const packValid = pack && string(pack.id) && [2, 10].includes(pack.containerMl)
    && [10, 50].includes(pack.containersPerPack) && positive(pack.quantity)
    && same(pack.quantity, pack.containerMl * pack.containersPerPack);
  if (!packValid) error(missing(context.packId) ? 'Wybierz opakowanie i pojemność ampułki.'
    : 'Nieprawidłowe dane wybranej ampułki lub opakowania.', missing(context.packId) ? 'incomplete' : 'critical');
  else {
    result.packId = pack.id;
    result.containerMl = pack.containerMl;
    result.containerMicrograms = clean(pack.containerMl * CONCENTRATION);
  }

  const confirmations = context.sourceConfirmations;
  if (confirmations != null && (!Array.isArray(confirmations) || !Array.from(confirmations).every(string)))
    error('Nieprawidłowe potwierdzenia warunków pojedynczego podania.');
  const confirmed = new Set(Array.isArray(confirmations) ? confirmations.filter(string) : []);
  for (const requirement of source.selectionRequirements) {
    if (!confirmed.has(requirement.id)) error(`Potwierdź: ${requirement.label}`, 'incomplete');
  }
  const dose = context.doseMicrograms;
  if (missing(dose)) error('Wpisz dawkę jednorazową w mikrogramach; kalkulator nie wybiera jej automatycznie.', 'incomplete');
  else if (!positive(dose)) error('Dawka jednorazowa musi być dodatnią, skończoną liczbą mikrogramów.');
  else {
    result.doseMicrograms = dose;
    if (above(dose, source.maxMicrograms)) {
      error(source.phase === 'additional'
        ? `Dawka dodatkowa przekracza ${numberText(source.referenceDoseMicrograms)} mikrogramów opisane w wybranym źródle. Potrzebna jest odrębna ocena schematu; ten widok nie tworzy dla niej zlecenia.`
        : `Dawka przekracza ${numberText(source.maxMicrograms)} mikrogramów objęte tym widokiem pojedynczego podania. Większe dawki stosowane w znieczuleniu należą do innego zakresu; ten widok nie tworzy dla nich zlecenia.`);
    }
    const lower = source.phase === 'initial' ? source.minMicrograms : source.referenceDoseMicrograms;
    if (above(lower, dose)) result.warnings.push(
      `Wpisana dawka jest mniejsza niż ${numberText(lower)} mikrogramów opisane dla tej fazy. Mniejsza dawka wymaga indywidualnej oceny pacjenta; kalkulator jej nie zaleca ani nie dobiera.`);
    if (packValid) {
      const volume = dose / CONCENTRATION;
      const ratio = volume / pack.containerMl;
      const count = positive(ratio) ? Math.max(1, Math.ceil(ratio - tolerance(ratio, 0))) : null;
      const opened = count === null ? null : count * pack.containerMl;
      const active = volume * CONCENTRATION;
      const waste = opened === null ? null : Math.max(0, opened - volume);
      if (!positive(volume) || !positive(active) || !Number.isSafeInteger(count)
          || count < 1 || !positive(opened) || !finite(waste)) error('Wynik pojedynczego podania jest poza zakresem obliczeń.');
      else {
        result.volumeMl = clean(volume);
        result.activeDrugMicrograms = clean(active);
        result.containersNeeded = count;
        result.volumeWasteMl = clean(waste);
      }
    }
  }

  if (packValid && positive(dose) && years !== null
      && context.formId === form.id && context.specialty === 'cardio' && context.patientType === 'adult') {
    // Only relevant inputs enter the key. Frequency, days and course rounding
    // are deliberately absent and can neither change nor legitimise this result.
    result.contextKey = JSON.stringify({
      form: [form.id, form.label, form.calculationMode, form.form, form.routeCode,
        form.doseUnit, form.unitLabel, form.concentrationMicrogramsPerMl,
        form.referenceOnly === true, form.calculationBlocked === true],
      pack: [pack.id, pack.containerMl, pack.containersPerPack, pack.quantity],
      source: [source.id, source.phase, source.label, source.phaseLabel,
        source.phase === 'initial' ? source.minMicrograms : null, source.maxMicrograms,
        source.phase === 'additional' ? source.referenceDoseMicrograms : null,
        source.monitoringText, source.administration, source.sourceUrl ?? null,
        source.selectionRequirements.map(item => [item.id, item.label, item.detail ?? null])],
      context: [context.formId, context.specialty, context.patientType, context.age,
        context.ageUnit, context.doseMicrograms, context.demo === true,
        [...confirmed].sort()],
    });
  }
  return finish();
}

/** Rp./D.S. for one administration, with the required ampoules rather than
 * commercial cartons. A stale preview or revoked confirmation cannot be
 * exported by reusing valid:true; both text modes use the same validation.
 */
export function buildSingleDoseText(drug, form, source, result, context = {}, options = {}) {
  if (!object(options)) return '';
  const mode = options.mode === undefined ? 'full' : options.mode;
  if (mode !== 'full' && mode !== 'ds') return '';
  if (!object(result) || result.valid !== true || !string(result.contextKey)) return '';
  const current = resolveSingleDose(form, source, context);
  if (!current.valid || current.contextKey !== result.contextKey) return '';
  const amounts = ['doseMicrograms', 'activeDrugMicrograms', 'volumeMl', 'containersNeeded',
    'volumeWasteMl', 'containerMl', 'containerMicrograms', 'concentrationMicrogramsPerMl'];
  if (amounts.some(key => !same(result[key], current[key]))) return '';
  const label = string(form?.label) ? form.label.trim() : string(drug?.name) ? drug.name.trim() : 'Fentanyl WZF';
  const dosing = [
    `D.S. Podać jednorazowo ${numberText(current.activeDrugMicrograms)} mikrogramów fentanylu (${numberText(current.volumeMl)} ml nierozcieńczonego roztworu ${numberText(current.concentrationMicrogramsPerMl)} mikrogramów/ml), dożylnie, wolno.`,
    `${source.phaseLabel.trim()}${source.phase === 'additional' ? ' po ponownej ocenie pacjenta' : ''}; dorosły oddychający spontanicznie.`,
    source.monitoringText.trim(),
    'Niewykorzystaną zawartość otwartych ampułek usunąć.',
    ...current.warnings.map(warning => `Uwaga: ${warning}`),
  ].join(' ');
  if (mode === 'ds') return dosing;
  return [
    'Rp. Fentanylum',
    label,
    `${numberText(current.containersNeeded)} amp. po ${numberText(current.containerMl)} ml — na pojedyncze podanie.`,
    dosing,
  ].join('\n');
}
