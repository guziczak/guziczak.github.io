/**
 * Resolve an explicitly selected human source regimen for an exact formulation.
 * This module does not diagnose, select a regimen, choose an endpoint of a source
 * range, round a dose or infer grams from a qualitative application instruction.
 * The caller must re-resolve after every patient or regimen edit and must check
 * valid before applying/copying a result. Missing optional renal context permits
 * arithmetic; it never establishes normal renal function.
 * Final formulation arithmetic and the
 * actual administered-dose checks remain in engine.js.
 */
const MODES = new Set(['fixed', 'perKgDay', 'perKgDose', 'units', 'instruction']);
const PATIENT_TYPES = new Set(['adult', 'child']);
const AGE_UNITS = new Set(['years', 'months', 'days']);
const RENAL_STATUSES = new Set(['unknown', 'normal', 'impaired']);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const positive = value => finite(value) && value > 0;
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const present = value => value !== null && value !== undefined;
const missing = value => !present(value) || value === '';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const stringList = value => Array.isArray(value) && value.length > 0 && value.every(text)
  && new Set(value).size === value.length;
const clean = value => Number(value.toPrecision(14));
const tolerance = value => Number.EPSILON * 32 * Math.max(1, Math.abs(value));
const above = (value, limit) => value - limit > tolerance(limit);
const same = (a, b) => Math.abs(a - b) <= Math.max(tolerance(a), tolerance(b));
const fmt = value => String(clean(value)).replace('.', ',');

function emptyResult() {
  return {
    valid: false, errors: [], warnings: [], requirements: [],
    doseMode: null, dose: null, frequency: null,
    fixedDays: null, minDays: null, maxDays: null,
    doseRange: null, frequencyOptions: null,
    maxDailyMg: null, maxDailyMgPerKg: null,
    maxSingleMg: null, maxSingleMgPerKg: null,
    maxUnitsPerDose: null, maxDailyUnits: null, limitLabel: '',
    instructionText: '', amountText: '', administration: '',
    asNeeded: false, minIntervalHours: null,
  };
}

function metadataErrors(record) {
  if (!object(record)) return ['Wybierz schemat ze zweryfikowanego źródła.'];
  const errors = [];
  if (!text(record.id) || !stringList(record.formIds) || !stringList(record.specialties)) {
    errors.push('Schemat nie ma poprawnego przypisania do preparatu i specjalizacji.');
  }
  if (present(record.patientTypes) && (!stringList(record.patientTypes)
      || record.patientTypes.some(value => !PATIENT_TYPES.has(value)))) {
    errors.push('Schemat ma nieprawidłową grupę pacjentów.');
  }
  if (!MODES.has(record.doseMode)) errors.push('Nieprawidłowy sposób dawkowania w źródle.');
  if (!text(record.indication)) errors.push('Schemat nie określa wskazania lub zastosowania.');
  if (!text(record.sourceUrl) || !/^https?:\/\/[^\s]+$/i.test(record.sourceUrl)
      || !text(record.sourceLabel) || !text(record.sourceSection)
      || !text(record.sourceCheckedAt)) {
    errors.push('Schemat wymaga pełnego odniesienia do sprawdzonego źródła.');
  }
  const instruction = record.doseMode === 'instruction';
  const hasDose = present(record.dose);
  const hasRange = present(record.doseRange);
  if (instruction) {
    if (!text(record.instructionText)) errors.push('Brak instrukcji stosowania ze źródła.');
    if (hasDose || hasRange) errors.push('Opisowej ilości preparatu nie wolno zastępować dawką liczbową.');
  } else if (hasDose === hasRange) {
    errors.push('Schemat wymaga jednej dawki albo jednego zakresu dawek.');
  }
  if (hasDose && !positive(record.dose)) errors.push('Nieprawidłowa dawka w źródle.');
  if (hasRange && (!object(record.doseRange) || !positive(record.doseRange.min)
      || !positive(record.doseRange.max) || record.doseRange.min > record.doseRange.max)) {
    errors.push('Nieprawidłowy zakres dawek w źródle.');
  }

  const hasFrequency = present(record.frequency);
  const hasOptions = present(record.frequencyOptions);
  if (hasFrequency && hasOptions || !instruction && !hasFrequency && !hasOptions) {
    errors.push('Schemat wymaga jednej częstości albo listy dostępnych częstości.');
  }
  if (hasFrequency && (!positiveInteger(record.frequency) || record.frequency > 48)) {
    errors.push('Nieprawidłowa liczba podań w źródle.');
  }
  if (hasOptions && (!Array.isArray(record.frequencyOptions) || !record.frequencyOptions.length
      || record.frequencyOptions.some(value => !positiveInteger(value) || value > 48)
      || new Set(record.frequencyOptions).size !== record.frequencyOptions.length)) {
    errors.push('Nieprawidłowa lista częstości w źródle.');
  }

  for (const key of ['fixedDays', 'minDays', 'maxDays', 'reviewAfterDays']) {
    if (present(record[key]) && (!positiveInteger(record[key]) || record[key] > 3660)) {
      errors.push('Nieprawidłowy czas stosowania w źródle.');
    }
  }
  if (present(record.minDays) && present(record.maxDays) && record.minDays > record.maxDays
      || present(record.fixedDays) && (present(record.minDays) && record.fixedDays < record.minDays
        || present(record.maxDays) && record.fixedDays > record.maxDays)) {
    errors.push('Sprzeczne ograniczenia czasu stosowania w źródle.');
  }
  for (const key of ['minAgeExclusive', 'maxAgeExclusive', 'minWeightExclusive', 'maxWeightExclusive',
    'minCrClExclusive', 'requiresDuration', 'requireCrCl', 'asNeeded']) {
    if (Object.hasOwn(record, key) && typeof record[key] !== 'boolean') {
      errors.push('Nieprawidłowy warunek schematu w źródle.');
    }
  }
  for (const [minimum, maximum, minimumExclusive, maximumExclusive] of [
    ['minAgeMonths', 'maxAgeMonths', 'minAgeExclusive', 'maxAgeExclusive'],
    ['minWeight', 'maxWeight', 'minWeightExclusive', 'maxWeightExclusive'],
  ]) {
    for (const key of [minimum, maximum]) {
      if (present(record[key]) && (!finite(record[key]) || record[key] < 0
          || key === 'maxWeight' && record[key] === 0)) {
        errors.push('Nieprawidłowy przedział wieku lub masy ciała w źródle.');
      }
    }
    if (record[minimumExclusive] === true && !present(record[minimum])
        || record[maximumExclusive] === true && !present(record[maximum])
        || present(record[minimum]) && present(record[maximum])
          && (record[minimum] > record[maximum]
            || record[minimum] === record[maximum]
              && (record[minimumExclusive] === true || record[maximumExclusive] === true))) {
      errors.push('Sprzeczne granice wieku lub masy ciała w źródle.');
    }
  }

  for (const key of ['maxDailyMg', 'maxDailyMgPerKg', 'maxSingleMg', 'maxSingleMgPerKg',
    'maxUnitsPerDose', 'maxDailyUnits']) {
    if (present(record[key]) && !positive(record[key])) errors.push('Nieprawidłowy limit dawki w źródle.');
  }
  if (present(record.renalPolicy) && record.renalPolicy !== 'normal-only') {
    errors.push('Nieobsługiwany warunek czynności nerek w źródle.');
  }
  if (present(record.minCrCl) && (!finite(record.minCrCl) || record.minCrCl < 0)
      || record.minCrClExclusive === true && !present(record.minCrCl)) {
    errors.push('Nieprawidłowy próg klirensu kreatyniny w źródle.');
  }
  if (present(record.minIntervalHours) && (!positive(record.minIntervalHours) || record.minIntervalHours > 24)) {
    errors.push('Nieprawidłowy minimalny odstęp między podaniami w źródle.');
  }
  if (positive(record.minIntervalHours) && hasFrequency && positiveInteger(record.frequency)
      && above(record.frequency * record.minIntervalHours, 24)) {
    errors.push('Częstość w źródle jest sprzeczna z minimalnym odstępem między podaniami.');
  }
  return errors;
}

function identityMatches(record, context) {
  return object(context) && text(context.formId) && text(context.specialty)
    && record.formIds.includes(context.formId) && record.specialties.includes(context.specialty)
    && (!present(context.patientType) || PATIENT_TYPES.has(context.patientType))
    && (!record.patientTypes || record.patientTypes.includes(context.patientType));
}

/** Availability does not establish clinical eligibility; resolution checks context. */
export function availableHumanRegimens(records, context = {}) {
  if (!Array.isArray(records) || !object(context) || context.calculationBlocked === true) return [];
  return records.filter(record => metadataErrors(record).length === 0 && identityMatches(record, context))
    .map(record => ({
      ...record, formIds: [...record.formIds], specialties: [...record.specialties],
      ...(record.patientTypes ? { patientTypes: [...record.patientTypes] } : {}),
      ...(record.doseRange ? { doseRange: { ...record.doseRange } } : {}),
      ...(record.frequencyOptions ? { frequencyOptions: [...record.frequencyOptions] } : {}),
    }));
}

function ageMonthsRange(age, unit) {
  if (unit === 'months') return [age, age];
  if (unit === 'years') return [clean(age * 12), clean(age * 12)];
  // Calendar months do not all have the same length. Conservative bounds let a
  // clearly eligible age pass, but never turn an ambiguous day count into a
  // precise number of completed months at a source threshold.
  return [age / 31, age / 28];
}

function checkAge(record, context, errors) {
  const required = present(record.minAgeMonths) || present(record.maxAgeMonths);
  if (missing(context.age)) {
    if (required) errors.push('Uzupełnij wiek, aby sprawdzić zakres schematu.');
    return;
  }
  if (!finite(context.age) || context.age < 0 || !AGE_UNITS.has(context.ageUnit)) {
    errors.push('Podaj poprawny wiek i jego jednostkę: lata, miesiące lub dni.');
    return;
  }
  const [low, high] = ageMonthsRange(context.age, context.ageUnit);
  if (!finite(high) || low > 1560) {
    errors.push('Wiek jest poza zakresem obsługiwanym przez kalkulator.');
    return;
  }
  let ambiguous = false;
  if (present(record.minAgeMonths)) {
    const limit = record.minAgeMonths;
    const pass = record.minAgeExclusive ? low > limit : low >= limit;
    const fail = record.minAgeExclusive ? high <= limit : high < limit;
    if (fail) errors.push(`Wiek nie spełnia dolnej granicy schematu (${record.minAgeExclusive ? 'powyżej' : 'co najmniej'} ${fmt(limit)} mies.).`);
    else if (!pass) ambiguous = true;
  }
  if (present(record.maxAgeMonths)) {
    const limit = record.maxAgeMonths;
    const pass = record.maxAgeExclusive ? high < limit : high <= limit;
    const fail = record.maxAgeExclusive ? low >= limit : low > limit;
    if (fail) errors.push(`Wiek nie spełnia górnej granicy schematu (${record.maxAgeExclusive ? 'poniżej' : 'nie więcej niż'} ${fmt(limit)} mies.).`);
    else if (!pass) ambiguous = true;
  }
  if (ambiguous) errors.push('Wiek podany w dniach jest niejednoznaczny przy granicy schematu. Podaj wiek w ukończonych miesiącach.');
}

function resolveChoice(record, context, result, key, optionsKey, editable = false) {
  // Explicit UI override: use the entered value, never the source default.
  // Patient eligibility, numeric ceilings, intervals and duration are still
  // checked below against the ORIGINAL, unmodified source record.
  if (editable) {
    result.requirements.push(key);
    const value = context[key];
    if (missing(value)) {
      result.errors.push(key === 'dose' ? 'Uzupełnij dawkę.' : 'Uzupełnij liczbę podań na dobę.');
      return;
    }
    if (key === 'dose' ? !positive(value) : !positiveInteger(value) || value > 48) {
      result.errors.push(key === 'dose' ? 'Podaj dodatnią, skończoną dawkę.' : 'Liczba podań musi być całkowita, od 1 do 48 na dobę.');
      return;
    }
    result[key] = value;
    const matches = present(record[key]) ? same(value, record[key])
      : key === 'dose' ? value >= record.doseRange.min && value <= record.doseRange.max
        : record.frequencyOptions.includes(value);
    if (!matches) {
      result.warnings.push(key === 'dose'
        ? 'Dawka została zmieniona względem źródła. Zmodyfikowany schemat wymaga oceny lekarza.'
        : 'Częstotliwość została zmieniona względem źródła. Zmodyfikowany schemat wymaga oceny lekarza.');
    }
    // A range boundary remains a constraint, even when its field is editable.
    if (key === 'dose' && record.doseRange && !matches) {
      result.errors.push('Dawka jest poza zakresem wybranego schematu.');
    }
    if (key === 'frequency' && record.frequencyOptions && !matches) {
      result.errors.push('Liczba podań nie należy do wybranego schematu.');
    }
    return;
  }
  if (present(record[key])) {
    result[key] = record[key];
    if (!missing(context[key]) && (!finite(context[key]) || !same(context[key], record[key]))) {
      result.errors.push(key === 'dose' ? 'Dawka różni się od stałej dawki wybranego schematu.' : 'Liczba podań różni się od wybranego schematu.');
    }
    return;
  }
  if (!present(record[optionsKey])) return;
  result.requirements.push(key);
  if (missing(context[key])) {
    result.errors.push(key === 'dose' ? 'Wybierz dawkę w zakresie opisanym w źródle.' : 'Wybierz liczbę podań na dobę opisaną w źródle.');
    return;
  }
  const accepted = key === 'dose'
    ? positive(context.dose) && context.dose >= record.doseRange.min && context.dose <= record.doseRange.max
    : positiveInteger(context.frequency) && record.frequencyOptions.includes(context.frequency);
  if (!accepted) {
    result.errors.push(key === 'dose' ? 'Dawka jest poza zakresem wybranego schematu.' : 'Liczba podań nie należy do wybranego schematu.');
    return;
  }
  result[key] = context[key];
}

/** Resolve a source candidate, never an automatically selected treatment. */
export function resolveHumanRegimen(record, context = {}, { allowNumericOverrides = false } = {}) {
  const result = emptyResult();
  if (!object(context)) {
    result.errors.push('Nieprawidłowy kontekst pacjenta.');
    return result;
  }
  if (context.calculationBlocked === true) {
    result.errors.push('Ten preparat jest kartą informacyjną; automatyczne przeliczenie nie jest dostępne.');
    return result;
  }
  const badMetadata = metadataErrors(record);
  if (badMetadata.length) {
    result.errors.push(...badMetadata);
    return result;
  }
  if (!identityMatches(record, context)) {
    result.errors.push('Schemat nie dotyczy wybranej postaci, specjalizacji lub grupy pacjentów.');
    return result;
  }
  result.doseMode = record.doseMode;
  for (const key of ['fixedDays', 'minDays', 'maxDays', 'maxUnitsPerDose', 'maxDailyUnits', 'minIntervalHours']) {
    result[key] = record[key] ?? null;
  }
  result.doseRange = record.doseRange ? { ...record.doseRange } : null;
  result.frequencyOptions = record.frequencyOptions ? [...record.frequencyOptions] : null;
  result.instructionText = record.instructionText || '';
  result.amountText = record.amountText || '';
  result.administration = record.administration || '';
  result.asNeeded = record.asNeeded === true;

  if (present(record.minAgeMonths) || present(record.maxAgeMonths)) result.requirements.push('age');
  checkAge(record, context, result.errors);
  const weightRequired = ['perKgDay', 'perKgDose'].includes(record.doseMode)
    || ['minWeight', 'maxWeight', 'maxDailyMgPerKg', 'maxSingleMgPerKg'].some(key => present(record[key]));
  if (weightRequired) result.requirements.push('weight');
  const weight = positive(context.weight) && context.weight <= 500 ? context.weight : null;
  if (missing(context.weight)) {
    if (weightRequired) result.errors.push('Uzupełnij masę ciała w kg dla tego schematu.');
  } else if (weight === null) result.errors.push('Podaj poprawną masę ciała w kg.');
  if (weight !== null) {
    if (present(record.minWeight) && (record.minWeightExclusive ? weight <= record.minWeight : weight < record.minWeight)) {
      result.errors.push(`Masa ciała musi wynosić ${record.minWeightExclusive ? 'więcej niż' : 'co najmniej'} ${fmt(record.minWeight)} kg w tym schemacie.`);
    }
    if (present(record.maxWeight) && (record.maxWeightExclusive ? weight >= record.maxWeight : weight > record.maxWeight)) {
      result.errors.push(`Masa ciała musi wynosić ${record.maxWeightExclusive ? 'mniej niż' : 'nie więcej niż'} ${fmt(record.maxWeight)} kg w tym schemacie.`);
    }
  }

  if (record.renalPolicy === 'normal-only' && context.renalStatus === 'impaired') {
    result.errors.push('Ten schemat wymaga innej oceny przy zaburzonej czynności nerek. Nie zastosowano automatycznej redukcji dawki.');
  }
  if (present(context.renalStatus) && !RENAL_STATUSES.has(context.renalStatus)) {
    result.errors.push('Wybierz poprawny status oceny czynności nerek.');
  }
  if (record.requireCrCl === true) result.requirements.push('crcl');
  if (missing(context.crcl)) {
    if (record.requireCrCl === true) result.errors.push('Uzupełnij oceniony klirens kreatyniny CrCl w ml/min.');
  } else if (!positive(context.crcl)) {
    result.errors.push('Podaj poprawny klirens kreatyniny CrCl w ml/min.');
  } else if (present(record.minCrCl)
      && (record.minCrClExclusive ? context.crcl <= record.minCrCl : context.crcl < record.minCrCl)) {
    result.errors.push(`CrCl nie spełnia warunku schematu (${record.minCrClExclusive ? 'powyżej' : 'co najmniej'} ${fmt(record.minCrCl)} ml/min). Wymagany jest inny schemat.`);
  }

  const editable = allowNumericOverrides === true && record.doseMode !== 'instruction';
  if (record.doseMode !== 'instruction') resolveChoice(record, context, result, 'dose', 'doseRange', editable);
  resolveChoice(record, context, result, 'frequency', 'frequencyOptions', editable);
  if (result.frequency !== null && positive(record.minIntervalHours)
      && above(result.frequency * record.minIntervalHours, 24)) {
    result.errors.push('Wybrana liczba podań nie zachowuje minimalnego odstępu między dawkami.');
  }
  const durationRequired = record.doseMode !== 'instruction' || record.requiresDuration === true
    || ['fixedDays', 'minDays', 'maxDays'].some(key => present(record[key]));
  if (durationRequired) result.requirements.push('days');
  if (missing(context.days)) {
    if (durationRequired) result.errors.push('Uzupełnij czas stosowania w dniach; źródłowy zakres nie wybiera go automatycznie.');
  } else if (!positiveInteger(context.days) || context.days > 3660) {
    result.errors.push('Czas stosowania musi być dodatnią, całkowitą liczbą dni.');
  } else {
    if (present(record.fixedDays) && context.days !== record.fixedDays) result.errors.push(`Wybrany schemat trwa dokładnie ${record.fixedDays} dni.`);
    if (present(record.minDays) && context.days < record.minDays) result.errors.push(`Źródło określa minimum ${record.minDays} dni dla tego schematu.`);
    if (present(record.maxDays) && context.days > record.maxDays) result.errors.push(`Przekroczono limit ${record.maxDays} dni wybranego schematu.`);
    if (present(record.reviewAfterDays) && context.days > record.reviewAfterDays) result.warnings.push(`Stosowanie dłużej niż ${record.reviewAfterDays} dni wymaga ponownej oceny wskazanej w źródle.`);
  }

  const sourceDailyPerKg = record.doseMode === 'perKgDay'
    ? (record.doseRange?.max ?? record.dose) : null;
  const dailyPerKg = [record.maxDailyMgPerKg, sourceDailyPerKg].filter(positive);
  result.maxDailyMgPerKg = dailyPerKg.length ? Math.min(...dailyPerKg) : null;
  result.maxSingleMgPerKg = record.maxSingleMgPerKg ?? null;
  const dailyLimits = [record.maxDailyMg];
  const singleLimits = [record.maxSingleMg];
  if (weight !== null) {
    if (result.maxDailyMgPerKg !== null) dailyLimits.push(result.maxDailyMgPerKg * weight);
    if (result.maxSingleMgPerKg !== null) singleLimits.push(result.maxSingleMgPerKg * weight);
  }
  if ([...dailyLimits, ...singleLimits].some(value => present(value) && !positive(value))) {
    result.errors.push('Wyliczony limit dawki jest poza zakresem obliczeń.');
  } else {
    const daily = dailyLimits.filter(positive);
    const single = singleLimits.filter(positive);
    result.maxDailyMg = daily.length ? clean(Math.min(...daily)) : null;
    result.maxSingleMg = single.length ? clean(Math.min(...single)) : null;
  }
  result.limitLabel = record.limitLabel || ([result.maxDailyMg, result.maxSingleMg,
    result.maxDailyMgPerKg, result.maxSingleMgPerKg, result.maxUnitsPerDose, result.maxDailyUnits].some(present)
    ? 'Górna granica wybranego schematu ze źródła' : '');

  if (result.dose !== null && result.frequency !== null) {
    let singleMg = null;
    if (record.doseMode === 'fixed') singleMg = result.dose;
    if (weight !== null && record.doseMode === 'perKgDose') singleMg = result.dose * weight;
    if (weight !== null && record.doseMode === 'perKgDay') singleMg = result.dose * weight / result.frequency;
    if (singleMg !== null) {
      const dailyMg = singleMg * result.frequency;
      if (!positive(singleMg) || !positive(dailyMg)) result.errors.push('Dawka jest poza zakresem obliczeń.');
      else {
        if (result.maxSingleMg !== null && above(singleMg, result.maxSingleMg)) result.errors.push('Dawka jednorazowa przekracza limit wybranego schematu.');
        if (result.maxDailyMg !== null && above(dailyMg, result.maxDailyMg)) result.errors.push('Dawka dobowa przekracza limit wybranego schematu.');
      }
    }
    if (record.doseMode === 'units') {
      if (!positive(result.dose * result.frequency)) result.errors.push('Dobowa ilość preparatu jest poza zakresem obliczeń.');
      if (result.maxUnitsPerDose !== null && above(result.dose, result.maxUnitsPerDose)) result.errors.push('Ilość preparatu na podanie przekracza limit wybranego schematu.');
      if (result.maxDailyUnits !== null && above(result.dose * result.frequency, result.maxDailyUnits)) result.errors.push('Dobowa ilość preparatu przekracza limit wybranego schematu.');
    }
  }
  result.requirements = [...new Set(result.requirements)];
  result.valid = result.errors.length === 0;
  return result;
}
