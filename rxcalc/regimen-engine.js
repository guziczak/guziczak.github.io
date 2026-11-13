/**
 * Resolve an explicitly selected source regimen for its exact formulation/species.
 * This module does not select an indication, assess all contraindications, round
 * a tablet dose or invent a treatment duration. Callers must require valid before
 * applying/copying a suggestion and re-resolve after relevant patient edits.
 */
const MODES = new Set(['perKgDose', 'perKgDay', 'units']);
const AGE_BOUNDS = Object.freeze({
  days: [1, 1], weeks: [7, 7], months: [28, 31], years: [365, 366],
});
const AGE_UNITS_PL = Object.freeze({ days: 'dniach', weeks: 'tygodniach', months: 'miesiącach', years: 'latach' });
const finite = value => typeof value === 'number' && Number.isFinite(value);
const positive = value => finite(value) && value > 0;
const present = value => value !== null && value !== undefined;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const stringList = value => Array.isArray(value) && value.length > 0 && value.every(text);
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const resultShape = () => ({
  valid: false, errors: [], warnings: [],
  doseMode: null, dose: null, frequency: null, fixedDays: null, minDays: null, maxDays: null,
});

function metadataErrors(regimen) {
  if (!object(regimen) || !text(regimen.id) || !stringList(regimen.formIds) || !stringList(regimen.species)) {
    return ['Schemat ma nieprawidłowe przypisanie do preparatu lub gatunku.'];
  }
  const errors = [];
  if (Object.hasOwn(regimen, 'requiresFoodChainExclusion') && typeof regimen.requiresFoodChainExclusion !== 'boolean') {
    errors.push('Schemat ma nieprawidłowy warunek wykluczenia z produkcji żywności.');
  } else if (regimen.requiresFoodChainExclusion === true && regimen.species.some(species => species !== 'horse')) {
    errors.push('Warunek wykluczenia z produkcji żywności wymaga schematu przeznaczonego wyłącznie dla koni.');
  }
  if (!MODES.has(regimen.doseMode)) errors.push('Schemat ma nieprawidłową jednostkę dawkowania.');
  if (!positiveInteger(regimen.frequency)) errors.push('Schemat ma nieprawidłową częstotliwość podawania.');
  const hasBands = present(regimen.weightBands);
  if (hasBands) {
    if (regimen.doseMode !== 'units' || present(regimen.dose)) {
      errors.push('Tabela masy wymaga dawkowania w jednostkach preparatu, bez drugiej podstawy dawki.');
    }
    const bands = regimen.weightBands;
    if (!Array.isArray(bands) || bands.length === 0 || bands.some(b => !object(b)
      || !finite(b.min) || b.min < 0 || !positive(b.max) || b.min >= b.max
      || typeof b.minInclusive !== 'boolean' || typeof b.maxInclusive !== 'boolean'
      || !positive(b.units))) {
      errors.push('Tabela masy w schemacie zawiera nieprawidłowy przedział lub dawkę.');
    } else {
      // Check the full table, even if today's weight is outside an overlap.
      const ordered = [...bands].sort((a, b) => a.min - b.min || a.max - b.max);
      for (let i = 0; i < ordered.length - 1; i += 1) {
        const a = ordered[i], b = ordered[i + 1];
        if (a.max > b.min || (a.max === b.min && a.maxInclusive && b.minInclusive)) {
          errors.push('Tabela masy w schemacie ma nakładające się przedziały.');
          break;
        }
      }
    }
  } else if (!positive(regimen.dose)) errors.push('Schemat nie zawiera prawidłowej dawki.');

  for (const key of ['fixedDays', 'minDays', 'maxDays']) {
    if (present(regimen[key]) && !positiveInteger(regimen[key])) errors.push('Schemat ma nieprawidłowy czas stosowania.');
  }
  if (present(regimen.minDays) && present(regimen.maxDays) && regimen.minDays > regimen.maxDays) {
    errors.push('Schemat ma sprzeczne granice czasu stosowania.');
  }
  if (present(regimen.fixedDays) && present(regimen.minDays) && regimen.fixedDays < regimen.minDays) {
    errors.push('Stały czas schematu jest krótszy od jego minimalnego czasu stosowania.');
  }
  if (present(regimen.fixedDays) && present(regimen.maxDays) && regimen.fixedDays > regimen.maxDays) {
    errors.push('Stały czas schematu przekracza jego maksymalny czas stosowania.');
  }
  if (present(regimen.minWeight) && (!finite(regimen.minWeight) || regimen.minWeight < 0)) {
    errors.push('Schemat ma nieprawidłową dolną granicę masy ciała.');
  }
  if (present(regimen.maxWeight) && !positive(regimen.maxWeight)) {
    errors.push('Schemat ma nieprawidłową górną granicę masy ciała.');
  }
  if (present(regimen.minWeight) && present(regimen.maxWeight) && regimen.minWeight > regimen.maxWeight) {
    errors.push('Schemat ma sprzeczne granice masy ciała.');
  }
  if (present(regimen.minimumAge)) {
    const min = regimen.minimumAge;
    if (!object(min) || !finite(min.value) || min.value < 0 || !Object.hasOwn(AGE_BOUNDS, min.unit)) {
      errors.push('Schemat ma nieprawidłowe ograniczenie wieku.');
    }
  }
  return errors;
}

function identityMatches(regimen, context) {
  return object(context) && text(context.formId) && text(context.species)
    && regimen.formIds.includes(context.formId) && regimen.species.includes(context.species);
}

/** Return only eligible, well-formed source records; no patient/diagnosis is inferred. */
export function availableRegimens(regimens, context = {}) {
  if (!Array.isArray(regimens) || !object(context) || context.calculationBlocked === true) return [];
  return regimens.filter(r => metadataErrors(r).length === 0 && identityMatches(r, context)).map(r => ({
    ...r,
    formIds: [...r.formIds],
    species: [...r.species],
    ...(r.minimumAge ? { minimumAge: { ...r.minimumAge } } : {}),
    ...(r.weightBands ? { weightBands: r.weightBands.map(b => ({ ...b })) } : {}),
  }));
}

function ageError(regimen, context) {
  const min = regimen.minimumAge;
  if (!present(context.age)) return min ? 'Uzupełnij wiek zwierzęcia, aby sprawdzić warunek schematu.' : null;
  if (!finite(context.age) || context.age < 0) return 'Podaj poprawny, nieujemny wiek zwierzęcia.';
  if (!Object.hasOwn(AGE_BOUNDS, context.ageUnit)) return 'Wybierz poprawną jednostkę wieku zwierzęcia.';
  if (!min) return null;
  if (context.ageUnit === min.unit) {
    return context.age >= min.value ? null : 'Wiek zwierzęcia jest poniżej progu wybranego schematu.';
  }
  const [ageMin, ageMax] = AGE_BOUNDS[context.ageUnit].map(days => days * context.age);
  const [limitMin, limitMax] = AGE_BOUNDS[min.unit].map(days => days * min.value);
  if (![ageMin, ageMax, limitMin, limitMax].every(Number.isFinite)) return 'Wiek lub ograniczenie wieku jest poza zakresem obliczeń.';
  if (ageMin >= limitMax) return null;
  if (ageMax < limitMin) return 'Wiek zwierzęcia jest poniżej progu wybranego schematu.';
  return `Podaj wiek w ${AGE_UNITS_PL[min.unit]}, zgodnie ze źródłem schematu; przeliczenie podanego wieku jest niejednoznaczne przy tej granicy.`;
}

/**
 * A matching fixed mg/kg candidate can be returned alongside missing-data errors.
 * Its presence is not permission to use it: valid must be checked by the caller.
 * A missing duration is deliberately not filled; fixedDays is metadata for the UI.
 */
export function resolveRegimen(regimen, context = {}) {
  const result = resultShape();
  if (!object(context)) {
    result.errors.push('Uzupełnij poprawny kontekst zwierzęcia.');
    return result;
  }
  if (context.calculationBlocked === true) {
    result.errors.push('Preparat wymaga przygotowania; schemat nie może ominąć blokady obliczeń.');
    return result;
  }
  if (!present(regimen)) {
    result.errors.push('Wybierz schemat z dokumentacji produktu.');
    return result;
  }
  const malformed = metadataErrors(regimen);
  if (malformed.length) {
    result.errors.push(...malformed);
    return result;
  }
  if (!identityMatches(regimen, context)) {
    result.errors.push('Schemat nie odpowiada wybranej postaci preparatu lub gatunkowi.');
    return result;
  }

  Object.assign(result, {
    doseMode: regimen.doseMode,
    dose: present(regimen.weightBands) ? null : regimen.dose,
    frequency: regimen.frequency,
    fixedDays: regimen.fixedDays ?? null,
    minDays: regimen.minDays ?? null,
    maxDays: regimen.maxDays ?? null,
  });
  const weightOK = positive(context.weight);
  if (!present(context.weight)) result.errors.push('Uzupełnij masę ciała zwierzęcia w kg.');
  else if (!weightOK) result.errors.push('Podaj poprawną, dodatnią masę ciała zwierzęcia w kg.');
  else {
    if (present(regimen.minWeight) && context.weight < regimen.minWeight) result.errors.push('Masa ciała jest poniżej zakresu wybranego schematu.');
    if (present(regimen.maxWeight) && context.weight > regimen.maxWeight) result.errors.push('Masa ciała jest powyżej zakresu wybranego schematu.');
    if (regimen.weightBands) {
      const bands = regimen.weightBands.filter(b => (b.minInclusive ? context.weight >= b.min : context.weight > b.min)
        && (b.maxInclusive ? context.weight <= b.max : context.weight < b.max));
      if (bands.length === 1 && result.errors.length === 0) result.dose = bands[0].units;
      else result.errors.push(bands.length > 1 ? 'Masa ciała odpowiada kilku przedziałom źródłowej tabeli; dawka jest niejednoznaczna.' : 'Dla tej masy nie ma jednoznacznej dawki w tabeli wybranej postaci. Nie zaokrąglaj masy do sąsiedniego przedziału.');
    }
  }
  const ageIssue = ageError(regimen, context);
  if (ageIssue) result.errors.push(ageIssue);
  if (present(context.days)) {
    if (!positiveInteger(context.days)) result.errors.push('Czas stosowania musi być dodatnią, całkowitą liczbą dni.');
    else {
      if (present(regimen.fixedDays) && context.days !== regimen.fixedDays) result.errors.push(`Wybrany etap obejmuje dokładnie ${regimen.fixedDays} ${regimen.fixedDays === 1 ? 'dzień' : 'dni'}. Zmień etap, aby wybrać inny czas stosowania.`);
      if (present(regimen.minDays) && context.days < regimen.minDays) result.errors.push(`Czas stosowania jest krótszy od minimum wybranego schematu (${regimen.minDays} dni).`);
      if (present(regimen.maxDays) && context.days > regimen.maxDays) result.errors.push(`Czas stosowania przekracza limit wybranego schematu (${regimen.maxDays} dni).`);
    }
  }
  if (regimen.requiresFoodChainExclusion === true && context.foodChainStatus !== 'excluded') {
    result.errors.push('Schemat wymaga konia wykluczonego z produkcji żywności. Sprawdź paszport i potwierdź status wykluczenia; bez takiego wpisu nie stosuj tego schematu.');
  }
  result.valid = result.errors.length === 0;
  return result;
}
