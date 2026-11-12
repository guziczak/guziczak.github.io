/**
 * RxCalc — deterministic arithmetic, not a prescribing recommendation.
 * Every clinical limit must be supplied by the caller from a product-specific rule.
 * All package sizes are expressed in the same unit as singleUnits.
 * Drops additionally need a product-specific dropsPerMl for mg conversions.
 */
const FORMS = new Set(['tablet', 'suspension', 'spray', 'gel', 'drops', 'injection', 'solution']);
const MODES = new Set(['fixed', 'perKgDay', 'perKgDose', 'units']);
const PATIENT_KINDS = new Set(['human', 'animal']);
const ANIMAL_SPECIES = new Set(['dog', 'cat', 'horse', 'hamster', 'rat']);
const empty = value => value === null || value === undefined || value === '';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clean = value => Number(value.toPrecision(14));
const tolerance = value => Number.EPSILON * 32 * Math.max(1, Math.abs(value));
const ceil = value => Math.ceil(value - tolerance(value));
const near = (a, b) => Math.abs(a - b) <= 1e-8;

export function formatNumber(value, maxDecimals = 2) {
  if (!finite(value)) return '—';
  const digits = finite(maxDecimals) ? Math.min(10, Math.max(0, Math.trunc(maxDecimals))) : 2;
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: digits, useGrouping: false }).format(value);
}

/** Adult Cockcroft–Gault estimate. Output: ml/min; null means insufficient/invalid data. */
export function calculateCrCl({ age, sex, weight, creatinine, creatinineUnit = 'mg/dl' } = {}) {
  if (![age, weight, creatinine].every(finite)) return null;
  if (age < 18 || age > 130 || weight <= 0 || weight > 500 || creatinine <= 0) return null;
  if (!['male', 'female'].includes(sex)) return null;
  if (typeof creatinineUnit !== 'string') return null;
  let scr;
  if (creatinineUnit.toLowerCase() === 'mg/dl') scr = creatinine;
  else if (['µmol/l', 'μmol/l', 'umol/l'].includes(creatinineUnit.toLowerCase())) scr = creatinine / 88.4;
  else return null;
  if (!finite(scr) || scr <= 0 || scr > 50) return null;
  const result = ((140 - age) * weight * (sex === 'female' ? 0.85 : 1)) / (72 * scr);
  return finite(result) && result > 0 ? clean(result) : null;
}

export function calculate(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  const result = {
    valid: false, errors: [], warnings: [], checks: [], status: 'incomplete',
    singleMg: null, dailyMg: null, theoreticalUnits: null, singleUnits: null,
    dailyUnits: null, totalUnits: null, packages: null, providedUnits: null,
    leftoverUnits: null, roundingDifferencePercent: null, maxRatio: null,
    unitLabel: typeof input.unitLabel === 'string' ? input.unitLabel : '',
    expiryWasteUnits: null, singleUseContainers: null, unusedSingleUseVolume: null,
  };
  const invalid = [];
  const patientKind = input.patientKind === undefined ? 'human' : input.patientKind;
  const animal = patientKind === 'animal';
  if (!PATIENT_KINDS.has(patientKind)) invalid.push('Wybierz poprawny profil pacjenta.');
  if (animal && !ANIMAL_SPECIES.has(input.species)) invalid.push('Wybierz gatunek zwierzęcia.');
  let incomplete = false;
  let critical = false;
  const number = (key, label, { required = false, min = 0, max = 1e7, allowZero = false } = {}) => {
    const value = input[key];
    if (empty(value)) {
      if (required) invalid.push(`Uzupełnij ${label}.`);
      return null;
    }
    if (!finite(value) || (allowZero ? value < min : value <= min) || value > max) {
      invalid.push(`Sprawdź ${label}: podaj poprawną ${allowZero ? 'nieujemną' : 'dodatnią'} liczbę.`);
      return null;
    }
    return value;
  };

  if (!FORMS.has(input.form)) invalid.push('Wybierz obsługiwaną postać leku.');
  if (!MODES.has(input.doseMode)) invalid.push('Wybierz sposób przeliczenia dawki.');
  if (['spray', 'gel'].includes(input.form) && input.doseMode !== 'units') {
    invalid.push('Dla tej postaci wprowadź ilość na podanie w jednostce preparatu.');
  }
  if (input.form === 'injection' && result.unitLabel.trim().toLowerCase() !== 'ml') {
    invalid.push('Roztwór do wstrzyknięć wymaga jednostki ml; wielkość opakowania i dawkę podaj w ml.');
  }

  const dose = number('dose', 'dawkę na podanie lub podstawę przeliczenia', { required: true, max: 1e6 });
  const frequency = number('frequency', 'liczbę podań na dobę', { required: true, max: 48 });
  const days = number('days', 'czas stosowania w dniach', { required: true, max: 3660 });
  if (frequency !== null && !Number.isInteger(frequency)) invalid.push('Liczba podań na dobę musi być dodatnią liczbą całkowitą.');
  if (days !== null && !Number.isInteger(days)) invalid.push('Czas stosowania musi być dodatnią, całkowitą liczbą dni.');
  const packageSize = number('packageSize', 'wielkość opakowania', { required: true, max: 1e7 });
  const singleUseUnitSize = input.form === 'injection'
    ? number('singleUseUnitSize', 'objętość pojedynczej ampułki lub ampułkostrzykawki w ml', { required: true, max: 1e7 })
    : null;
  // Technical input bounds only; they do not establish a species-specific normal weight.
  const weight = number('weight', 'masę ciała w kg', { required: animal || ['perKgDay', 'perKgDose'].includes(input.doseMode), max: animal ? 2000 : 500 });
  const age = number('age', 'wiek w latach', { allowZero: true, max: 130 });
  const roundingStep = number('roundingStep', 'krok zaokrąglenia', { max: 1e6 });
  const maxDailyMg = number('maxDailyMg', 'maksymalną dawkę dobową', { max: 1e7 });
  const maxSingleMg = number('maxSingleMg', 'maksymalną dawkę jednorazową', { max: 1e7 });
  const minAge = number('minAge', 'minimalny wiek', { allowZero: true, max: 130 });
  const shelfLifeDays = number('shelfLifeDays', 'trwałość po otwarciu lub przygotowaniu', { max: 3660 });
  let containersPerPackage = null;
  if (input.form === 'injection') {
    if (shelfLifeDays !== null) invalid.push('Dla jednorazowych pojemników do wstrzyknięć nie stosuje się trwałości po otwarciu.');
    if (singleUseUnitSize !== null && packageSize !== null) {
      const ratio = packageSize / singleUseUnitSize;
      const count = Math.round(ratio);
      if (!finite(ratio) || !Number.isSafeInteger(count) || count < 1 || Math.abs(ratio - count) > tolerance(ratio)) {
        invalid.push('Opakowanie musi zawierać całkowitą liczbę jednorazowych ampułek lub ampułkostrzykawek.');
      } else containersPerPackage = count;
    }
  }

  let allowedFractions = null;
  if (!empty(input.allowedFractions)) {
    if (!Array.isArray(input.allowedFractions) || input.allowedFractions.some(v => !finite(v) || v < 0 || v > 1)) {
      invalid.push('Nieprawidłowe dane o podzielności tabletki.');
    } else allowedFractions = input.allowedFractions;
  }

  let mgPerUnit = null;
  if (input.form === 'tablet') {
    mgPerUnit = number('strengthMg', 'moc tabletki w mg', { required: input.doseMode !== 'units' });
  } else if (['suspension', 'solution', 'injection', 'drops'].includes(input.form)) {
    const concentrationRequired = input.doseMode !== 'units';
    const concentrationMg = number('concentrationMg', 'ilość substancji w stężeniu', { required: concentrationRequired });
    const concentrationMl = number('concentrationMl', 'objętość odpowiadającą stężeniu', { required: concentrationRequired });
    if ((concentrationMg === null) !== (concentrationMl === null)) {
      invalid.push('Podaj oba składniki stężenia: ilość substancji i objętość.');
    }
    if (concentrationMg !== null && concentrationMl !== null) {
      mgPerUnit = concentrationMg / concentrationMl;
    }
    if (input.form === 'drops') {
      const dropsPerMl = number('dropsPerMl', 'liczbę kropli w 1 ml zgodną z preparatem', { required: concentrationRequired, max: 1000 });
      mgPerUnit = mgPerUnit !== null && dropsPerMl !== null ? mgPerUnit / dropsPerMl : null;
    }
  } else {
    // If available, strengthMg means mg per actuation (spray) or mg per gram (gel).
    mgPerUnit = number('strengthMg', 'ilość substancji w jednej jednostce preparatu');
  }
  if (mgPerUnit !== null && (!finite(mgPerUnit) || mgPerUnit <= 0)) {
    invalid.push('Przelicznik stężenia jest poza zakresem obliczeń. Sprawdź moc i jednostki preparatu.');
  }

  if (invalid.length) {
    result.errors.push(...invalid);
    return result;
  }

  let theoreticalUnits;
  if (input.doseMode === 'units') theoreticalUnits = dose;
  else {
    if (!(mgPerUnit > 0)) {
      result.errors.push('Brak wiarygodnego przelicznika ilości leku na mg.');
      return result;
    }
    const targetMg = input.doseMode === 'perKgDay' ? dose * weight / frequency
      : input.doseMode === 'perKgDose' ? dose * weight : dose;
    theoreticalUnits = targetMg / mgPerUnit;
  }
  if (!finite(theoreticalUnits) || theoreticalUnits <= 0 || theoreticalUnits > 1e9) {
    result.errors.push('Wynik poza zakresem obliczeń. Sprawdź dawkę i jednostki.');
    return result;
  }

  result.theoreticalUnits = clean(theoreticalUnits);
  const singleUnits = roundingStep === null ? theoreticalUnits : Math.round(theoreticalUnits / roundingStep + Number.EPSILON) * roundingStep;
  if (!finite(singleUnits) || singleUnits <= 0) {
    result.errors.push('Wybrany krok zaokrąglenia daje zerową dawkę. Zmień krok lub postać leku.');
    return result;
  }
  result.singleUnits = clean(singleUnits);
  result.roundingDifferencePercent = clean(100 * (result.singleUnits - theoreticalUnits) / theoreticalUnits);
  if (!finite(result.roundingDifferencePercent)) {
    result.roundingDifferencePercent = null;
    result.errors.push('Zmiana dawki po zaokrągleniu jest poza zakresem obliczeń.');
    return result;
  }
  if (Math.abs(result.roundingDifferencePercent) > 1e-7) {
    result.warnings.push(`Zaokrąglono ilość z ${formatNumber(theoreticalUnits, 6)} do ${formatNumber(result.singleUnits, 6)} ${result.unitLabel}. Sprawdź zmianę dawki (${formatNumber(result.roundingDifferencePercent, 2)}%).`);
  }

  if (input.form === 'tablet') {
    const fraction = result.singleUnits - Math.floor(result.singleUnits);
    if (!near(fraction, 0) && !near(fraction, 1)) {
      if (allowedFractions === null) {
        incomplete = true;
        result.errors.push('Brak potwierdzenia podzielności tej tabletki. Wybierz inną moc lub potwierdzoną postać.');
      } else if (!allowedFractions.some(v => near(v, fraction))) {
        critical = true;
        result.errors.push('Wyliczona część tabletki nie odpowiada potwierdzonej podzielności produktu. Zmień moc, postać lub schemat.');
      } else result.checks.push('Część tabletki zgodna z wprowadzonymi danymi o podzielności.');
    } else result.checks.push('Dawka odpowiada całkowitej liczbie tabletek.');
  }
  if (['spray', 'drops'].includes(input.form) && !near(result.singleUnits, Math.round(result.singleUnits))) {
    critical = true;
    result.errors.push('Podaj całkowitą liczbę rozpyleń lub kropli. Ułamkowa jednostka nie jest wykonalna.');
  }

  const dailyUnits = result.singleUnits * frequency;
  const totalUnits = dailyUnits * days;
  if (!finite(dailyUnits) || dailyUnits <= 0 || !finite(totalUnits) || totalUnits <= 0 || totalUnits > 1e12) {
    result.errors.push('Zapotrzebowanie poza zakresem obliczeń. Sprawdź parametry.');
    return result;
  }
  result.dailyUnits = clean(dailyUnits);
  result.totalUnits = clean(totalUnits);
  if (mgPerUnit !== null) {
    const singleMg = result.singleUnits * mgPerUnit;
    const dailyMg = singleMg * frequency;
    if (!finite(singleMg) || singleMg <= 0 || !finite(dailyMg) || dailyMg <= 0) {
      result.errors.push('Dawka w mg jest poza zakresem obliczeń. Sprawdź stężenie i jednostki.');
      return result;
    }
    result.singleMg = clean(singleMg);
    result.dailyMg = clean(dailyMg);
  }

  // Each package is opened only when needed. Its usable quantity is constrained by
  // capacity and by regular consumption during the stated in-use shelf life.
  const usablePerPackage = shelfLifeDays === null ? packageSize : Math.min(packageSize, result.dailyUnits * shelfLifeDays);
  if (!finite(usablePerPackage) || usablePerPackage <= 0) {
    result.errors.push('Użyteczna ilość preparatu w opakowaniu jest poza zakresem obliczeń.');
    return result;
  }
  let packageRatio = result.totalUnits / usablePerPackage;
  if (input.form === 'injection') {
    const perDoseRatio = result.singleUnits / singleUseUnitSize;
    const containersPerDose = finite(perDoseRatio) ? Math.max(1, ceil(perDoseRatio)) : null;
    const containers = containersPerDose === null ? null : containersPerDose * frequency * days;
    const unused = containers === null ? null : Math.max(0, containers * singleUseUnitSize - result.totalUnits);
    if (!Number.isSafeInteger(containersPerDose) || !Number.isSafeInteger(containers) || containers <= 0 || !finite(unused)) {
      result.errors.push('Liczba jednorazowych pojemników jest poza zakresem obliczeń. Sprawdź ich objętość.');
      return result;
    }
    result.singleUseContainers = containers;
    result.unusedSingleUseVolume = clean(unused);
    packageRatio = containers / containersPerPackage;
    result.checks.push('Dla każdego podania uwzględniono nowe jednorazowe ampułki lub ampułkostrzykawki.');
    if (unused > tolerance(result.totalUnits)) {
      result.warnings.push(`Pozostałość w otwartych jednorazowych pojemnikach (${formatNumber(unused, 4)} ml łącznie) nie jest przenoszona na kolejne podania.`);
    }
  }
  const packages = finite(packageRatio) ? Math.max(1, ceil(packageRatio)) : null;
  const providedUnits = packages === null ? null : packages * packageSize;
  if (!Number.isSafeInteger(packages) || packages <= 0 || !finite(providedUnits) || providedUnits <= 0) {
    result.errors.push('Liczba opakowań jest poza zakresem obliczeń. Sprawdź wielkość opakowania i trwałość.');
    return result;
  }
  result.packages = packages;
  result.providedUnits = clean(providedUnits);
  result.leftoverUnits = clean(Math.max(0, result.providedUnits - result.totalUnits));
  result.expiryWasteUnits = clean(Math.max(0, (result.packages - 1) * (packageSize - usablePerPackage)));
  if (shelfLifeDays !== null) {
    result.checks.push(`Uwzględniono trwałość po otwarciu/przygotowaniu: ${formatNumber(shelfLifeDays)} dni.`);
    if (result.packages > ceil(result.totalUnits / packageSize)) {
      result.warnings.push('Liczbę opakowań zwiększono ze względu na trwałość po otwarciu lub przygotowaniu. Kolejne opakowanie otwórz dopiero, gdy jest potrzebne.');
    }
  }

  if (minAge !== null) {
    if (age === null) {
      incomplete = true;
      result.errors.push('Uzupełnij wiek, aby sprawdzić ograniczenie wiekowe produktu.');
    } else if (age < minAge) {
      critical = true;
      result.errors.push(`Wiek poniżej wprowadzonego progu produktu (${formatNumber(minAge)} lat).`);
    } else result.checks.push('Wiek spełnia wprowadzony warunek produktu.');
  }

  if ((maxDailyMg !== null || maxSingleMg !== null) && result.singleMg === null) {
    incomplete = true;
    result.errors.push('Brak przelicznika na mg — nie można ocenić wprowadzonych limitów dawkowania.');
  }
  if (maxSingleMg !== null && result.singleMg !== null) {
    if (result.singleMg - maxSingleMg > tolerance(maxSingleMg)) {
      critical = true;
      result.errors.push(`Dawka jednorazowa ${formatNumber(result.singleMg, 4)} mg przekracza wprowadzony limit ${formatNumber(maxSingleMg, 4)} mg.`);
    } else result.checks.push('Dawka jednorazowa nie przekracza wprowadzonego limitu.');
  }
  if (maxDailyMg !== null && result.dailyMg !== null) {
    const ratio = result.dailyMg / maxDailyMg;
    if (!finite(ratio)) {
      result.errors.push('Wprowadzony limit dobowy jest poza zakresem obliczeń.');
      incomplete = true;
    } else result.maxRatio = clean(ratio);
    if (result.dailyMg - maxDailyMg > tolerance(maxDailyMg)) {
      critical = true;
      result.errors.push(`Dawka dobowa ${formatNumber(result.dailyMg, 4)} mg przekracza wprowadzony limit ${formatNumber(maxDailyMg, 4)} mg.`);
    } else result.checks.push('Dawka dobowa nie przekracza wprowadzonego limitu.');
  } else if (maxDailyMg === null) {
    result.warnings.push('Nie zdefiniowano limitu dobowego dla tego scenariusza. Potwierdź schemat w ChPL.');
  }
  if (result.singleMg === null) result.warnings.push('Obliczono ilość preparatu; dawka substancji w mg nie została oceniona.');

  for (const key of ['singleMg', 'dailyMg', 'theoreticalUnits', 'singleUnits', 'dailyUnits', 'totalUnits', 'packages', 'providedUnits', 'leftoverUnits', 'roundingDifferencePercent', 'maxRatio', 'expiryWasteUnits', 'singleUseContainers', 'unusedSingleUseVolume']) {
    if (result[key] !== null && !finite(result[key])) {
      result[key] = null;
      incomplete = true;
      result.errors.push('Wynik poza zakresem obliczeń. Sprawdź parametry i jednostki.');
    }
  }

  if (animal) {
    result.warnings.push('Przeliczenie arytmetyczne. Dobór leku i dawkowanie dla tego gatunku wymagają weryfikacji lekarza weterynarii.');
  }
  result.valid = result.errors.length === 0;
  result.status = critical ? 'critical' : incomplete ? 'incomplete' : result.warnings.length ? 'warning' : 'ok';
  return result;
}
