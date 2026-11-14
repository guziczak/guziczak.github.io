/**
 * RxCalc — deterministic arithmetic, not a prescribing recommendation.
 * Every clinical limit must be supplied by the caller from a product-specific rule.
 * All package sizes are expressed in the same unit as singleUnits.
 * Drops additionally need a product-specific dropsPerMl for mg conversions.
 * Oral paste/powder/gel use actual product grams; strengthMg means mg per 1 g.
 * Multi-dose injection packages each represent exactly one vial. Each full
 * administration is withdrawn once from one vial; residues are never pooled.
 */
const FORMS = new Set(['tablet', 'suspension', 'spray', 'gel', 'drops', 'injection', 'solution', 'oralPaste', 'oralPowder', 'oralGel']);
const MASS_FORMS = new Set(['oralPaste', 'oralPowder', 'oralGel']);
const MODES = new Set(['fixed', 'perKgDay', 'perKgDose', 'units']);
const PATIENT_KINDS = new Set(['human', 'animal']);
const ANIMAL_SPECIES = new Set(['dog', 'cat', 'horse', 'hamster', 'rat']);
const INJECTION_CONTAINER_USES = new Set(['singleUse', 'multiDose']);
const FOOD_CHAIN_STATUSES = new Set(['unknown', 'excluded', 'notExcluded']);
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

export function calculate(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  const result = {
    valid: false, errors: [], warnings: [], checks: [], status: 'incomplete',
    singleMg: null, dailyMg: null, theoreticalUnits: null, singleUnits: null,
    dailyUnits: null, totalUnits: null, packages: null, providedUnits: null,
    leftoverUnits: null, roundingDifferencePercent: null, maxRatio: null,
    unitLabel: typeof input.unitLabel === 'string' ? input.unitLabel : '',
    expiryWasteUnits: null, singleUseContainers: null, unusedSingleUseVolume: null,
    unusedSingleUseUnits: null,
    dosesPerVial: null, discardedMultiDoseVolume: null,
  };
  // Some catalogue entries are reference-only concentrates. Unit mode must not
  // bypass a preparation requirement or expose their undiluted volume as a dose.
  if (input.calculationBlocked === true) {
    result.errors.push('Preparat wymaga przygotowania przed podaniem. Automatyczne przeliczenie dawki i ilości preparatu jest niedostępne — sprawdź sposób przygotowania w aktualnej ChPL.');
    return result;
  }
  const invalid = [];
  const patientKind = input.patientKind === undefined ? 'human' : input.patientKind;
  const animal = patientKind === 'animal';
  if (!PATIENT_KINDS.has(patientKind)) invalid.push('Wybierz poprawny profil pacjenta.');
  if (animal && !ANIMAL_SPECIES.has(input.species)) invalid.push('Wybierz gatunek zwierzęcia.');
  let incomplete = false;
  let critical = false;
  if (!empty(input.foodChainStatus) && !FOOD_CHAIN_STATUSES.has(input.foodChainStatus)) {
    invalid.push('Wybierz poprawny status wyłączenia konia z łańcucha żywnościowego.');
  }
  if (!empty(input.requiresFoodChainExclusion) && typeof input.requiresFoodChainExclusion !== 'boolean') {
    invalid.push('Nieprawidłowe dane o wymaganym wyłączeniu z łańcucha żywnościowego.');
  }
  if (input.requiresFoodChainExclusion === true) {
    // Product eligibility is checked independently of the selected dose mode;
    // entering ml or grams directly cannot bypass this requirement.
    if (!animal || input.species !== 'horse' || input.foodChainStatus !== 'excluded') {
      critical = true;
      invalid.push('Ten preparat wymaga potwierdzenia, że pacjentem jest koń wyłączony z uboju do spożycia przez ludzi. Uzupełnij status przed obliczeniem dawki i zapotrzebowania.');
    } else result.checks.push('Potwierdzono wyłączenie konia z uboju do spożycia przez ludzi.');
  }
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
  if (MASS_FORMS.has(input.form) && result.unitLabel.trim().toLowerCase() !== 'g') {
    invalid.push('Pasta, proszek lub żel doustny wymaga jednostki g. Dawka i opakowanie dotyczą masy całego preparatu, nie masy samej substancji czynnej.');
  }
  const injection = input.form === 'injection';
  const injectionContainerUse = injection
    ? (input.injectionContainerUse === undefined ? 'singleUse' : input.injectionContainerUse)
    : null;
  if (injection && !INJECTION_CONTAINER_USES.has(injectionContainerUse)) {
    invalid.push('Wybierz poprawny rodzaj pojemnika do wstrzyknięć: jednorazowy lub fiolka wielodawkowa.');
  } else if (!injection && !empty(input.injectionContainerUse)) {
    invalid.push('Rodzaj pojemnika do wstrzyknięć można określić wyłącznie dla postaci do wstrzyknięć.');
  }
  const multiDose = injectionContainerUse === 'multiDose';
  const oralSingleUse = MASS_FORMS.has(input.form)
    && (!empty(input.singleUseUnitSize) || input.discardRemainderAfterUse === true);
  const singleUse = injectionContainerUse === 'singleUse' || oralSingleUse;
  if (!empty(input.discardRemainderAfterUse) && typeof input.discardRemainderAfterUse !== 'boolean') {
    invalid.push('Nieprawidłowe dane o jednorazowym użyciu opakowania.');
  }
  if (input.discardRemainderAfterUse === true && !singleUse) {
    invalid.push('Jednorazowe użycie wymaga obsługiwanej postaci i określenia wielkości pojedynczego pojemnika.');
  }

  const dose = number('dose', 'dawkę na podanie lub podstawę przeliczenia', { required: true, max: 1e6 });
  const frequency = number('frequency', 'liczbę podań na dobę', { required: true, max: 48 });
  const days = number('days', 'czas stosowania w dniach', { required: true, max: 3660 });
  if (frequency !== null && !Number.isInteger(frequency)) invalid.push('Liczba podań na dobę musi być dodatnią liczbą całkowitą.');
  if (days !== null && !Number.isInteger(days)) invalid.push('Czas stosowania musi być dodatnią, całkowitą liczbą dni.');
  const packageSize = number('packageSize', 'wielkość opakowania', { required: true, max: 1e7 });
  const singleUseUnitSize = singleUse
    ? number('singleUseUnitSize', oralSingleUse ? 'masę preparatu w pojedynczym jednorazowym opakowaniu w g' : 'objętość pojedynczej ampułki lub ampułkostrzykawki w ml', { required: true, max: 1e7 })
    : null;
  if (multiDose && !empty(input.singleUseUnitSize)) {
    invalid.push('Fiolka wielodawkowa nie może mieć objętości pojemnika jednorazowego. Wprowadź objętość jednej fiolki jako wielkość opakowania.');
  }
  const maxWithdrawalsPerVial = number('maxWithdrawalsPerVial', 'maksymalną liczbę nakłuć jednej fiolki', { max: Number.MAX_SAFE_INTEGER });
  if (maxWithdrawalsPerVial !== null && !Number.isSafeInteger(maxWithdrawalsPerVial)) {
    invalid.push('Maksymalna liczba nakłuć jednej fiolki musi być dodatnią liczbą całkowitą.');
  }
  if (!multiDose && !empty(input.maxWithdrawalsPerVial)) {
    invalid.push('Limit nakłuć dotyczy wyłącznie fiolki wielodawkowej.');
  }
  // Technical input bounds only; they do not establish a species-specific normal weight.
  const weight = number('weight', 'masę ciała w kg', { required: animal || ['perKgDay', 'perKgDose'].includes(input.doseMode), max: animal ? 2000 : 500 });
  const age = number('age', 'wiek w latach', { allowZero: true, max: 130 });
  const roundingStep = number('roundingStep', 'krok zaokrąglenia', { max: 1e6 });
  const doseStepUnits = number('doseStepUnits', 'krok podziałki przyrządu w jednostce preparatu', { max: 1e6 });
  const maxDailyMg = number('maxDailyMg', 'maksymalną dawkę dobową', { max: 1e7 });
  const maxSingleMg = number('maxSingleMg', 'maksymalną dawkę jednorazową', { max: 1e7 });
  const minAge = number('minAge', 'minimalny wiek', { allowZero: true, max: 130 });
  const shelfLifeDays = number('shelfLifeDays', 'trwałość po otwarciu lub przygotowaniu', { required: multiDose, max: 3660 });
  if (multiDose && shelfLifeDays !== null && !Number.isInteger(shelfLifeDays)) {
    invalid.push('Trwałość fiolki wielodawkowej po otwarciu musi być dodatnią, całkowitą liczbą dni.');
  }
  let containersPerPackage = null;
  if (singleUse) {
    if (shelfLifeDays !== null) invalid.push('Dla jednorazowych pojemników nie stosuje się trwałości po otwarciu; każde podanie wymaga nowego pojemnika.');
    if (singleUseUnitSize !== null && packageSize !== null) {
      const ratio = packageSize / singleUseUnitSize;
      const count = Math.round(ratio);
      if (!finite(ratio) || !Number.isSafeInteger(count) || count < 1 || Math.abs(ratio - count) > tolerance(ratio)) {
        invalid.push(oralSingleUse
          ? 'Opakowanie musi zawierać całkowitą liczbę jednorazowych pojemników; ich masę i masę całego opakowania podaj w g.'
          : 'Opakowanie musi zawierać całkowitą liczbę jednorazowych ampułek lub ampułkostrzykawek.');
      } else containersPerPackage = count;
    }
  }

  const solidUnit = result.unitLabel === 'kaps.' ? 'kapsułki' : 'tabletki';
  const solidUnits = result.unitLabel === 'kaps.' ? 'kapsułek' : 'tabletek';
  let allowedFractions = null;
  if (!empty(input.allowedFractions)) {
    if (!Array.isArray(input.allowedFractions) || input.allowedFractions.some(v => !finite(v) || v < 0 || v > 1)) {
      invalid.push(`Nieprawidłowe dane o podzielności ${solidUnit}.`);
    } else allowedFractions = input.allowedFractions;
  }

  let mgPerUnit = null;
  if (input.form === 'tablet') {
    mgPerUnit = number('strengthMg', `moc ${solidUnit} w mg`, { required: input.doseMode !== 'units' });
  } else if (MASS_FORMS.has(input.form)) {
    // Do not infer product mass from active mg or borrow a liquid mg/ml ratio.
    mgPerUnit = number('strengthMg', 'ilość substancji czynnej w 1 g preparatu (mg/g)', { required: input.doseMode !== 'units' });
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
    if (critical) result.status = 'critical';
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

  if (doseStepUnits !== null) {
    // This validates the final administered amount; it never rounds it to the
    // device. Use the unformatted quantity so display precision does not create
    // a false mismatch for recurring fractions such as 400/370 g per division.
    const divisions = singleUnits / doseStepUnits;
    const wholeDivisions = Math.round(divisions);
    if (!Number.isSafeInteger(wholeDivisions) || wholeDivisions < 1 || Math.abs(divisions - wholeDivisions) > tolerance(divisions)) {
      critical = true;
      result.errors.push(`Wyliczona ilość nie odpowiada pełnym podziałkom przyrządu (${formatNumber(doseStepUnits, 10)} ${result.unitLabel}). Nie zaokrąglono do podziałki przyrządu. Wybierz postać lub sposób odmierzania potwierdzony dla tego schematu.`);
    } else {
      result.checks.push('Ilość preparatu odpowiada pełnym podziałkom opisanego przyrządu.');
    }
  }

  if (input.form === 'tablet') {
    const fraction = result.singleUnits - Math.floor(result.singleUnits);
    if (!near(fraction, 0) && !near(fraction, 1)) {
      if (allowedFractions === null) {
        incomplete = true;
        result.errors.push(`Brak potwierdzenia podzielności tej ${solidUnit}. Wybierz inną moc lub potwierdzoną postać.`);
      } else if (!allowedFractions.some(v => near(v, fraction))) {
        critical = true;
        result.errors.push(`Wyliczona część ${solidUnit} nie odpowiada potwierdzonej podzielności produktu. Zmień moc, postać lub schemat.`);
      } else result.checks.push(`Część ${solidUnit} zgodna z wprowadzonymi danymi o podzielności.`);
    } else result.checks.push(`Dawka odpowiada całkowitej liczbie ${solidUnits}.`);
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
  let usablePerPackage = shelfLifeDays === null ? packageSize : Math.min(packageSize, result.dailyUnits * shelfLifeDays);
  if (!finite(usablePerPackage) || usablePerPackage <= 0) {
    result.errors.push('Użyteczna ilość preparatu w opakowaniu jest poza zakresem obliczeń.');
    return result;
  }
  let packageRatio = result.totalUnits / usablePerPackage;
  let packagesWithoutShelfLife = ceil(result.totalUnits / packageSize);
  let multiDoseExpiryLimited = false;
  if (multiDose) {
    // Work from the unformatted dose to retain exact recurring-ratio boundaries.
    // Capacity is counted in whole administrations, not pooled leftover ml.
    const capacityRatio = packageSize / singleUnits;
    if (!finite(capacityRatio) || capacityRatio <= 0) {
      result.errors.push('Liczba podań z fiolki jest poza zakresem obliczeń. Sprawdź objętość fiolki i dawkę.');
      return result;
    }
    if (capacityRatio < 1 - tolerance(capacityRatio)) {
      result.errors.push('Jedno podanie przekracza objętość jednej fiolki. Ten model pobiera całą dawkę z jednej fiolki. Wybierz większą fiolkę lub oblicz zaopatrzenie indywidualnie.');
      return result;
    }
    const volumeDoseCapacity = Math.floor(capacityRatio + tolerance(capacityRatio));
    const shelfDoseCapacity = shelfLifeDays * frequency;
    const withdrawalDoseCapacity = maxWithdrawalsPerVial ?? Infinity;
    const dosesPerVial = Math.min(volumeDoseCapacity, shelfDoseCapacity, withdrawalDoseCapacity);
    const administrations = frequency * days;
    if (!Number.isSafeInteger(dosesPerVial) || dosesPerVial < 1 || !Number.isSafeInteger(administrations)) {
      result.errors.push('Liczba pełnych podań z fiolki jest poza zakresem obliczeń. Sprawdź dawkę, trwałość i limit nakłuć.');
      return result;
    }
    result.dosesPerVial = dosesPerVial;
    usablePerPackage = Math.min(packageSize, dosesPerVial * result.singleUnits);
    packageRatio = administrations / dosesPerVial;
    packagesWithoutShelfLife = ceil(administrations / Math.min(volumeDoseCapacity, withdrawalDoseCapacity));
    // A tied volume or withdrawal limit is not labelled solely as expiry waste.
    multiDoseExpiryLimited = shelfDoseCapacity < volumeDoseCapacity && shelfDoseCapacity < withdrawalDoseCapacity;
    result.checks.push('Jedno opakowanie oznacza jedną fiolkę wielodawkową. Przyjęto jedno nakłucie na podanie i pobranie całej dawki z jednej fiolki; pozostałości niewystarczające na kolejne pełne podanie nie są łączone między fiolkami.');
    result.checks.push(`Z jednej fiolki uwzględniono maksymalnie ${formatNumber(dosesPerVial, 0)} pełnych podań, zgodnie z objętością, trwałością po otwarciu i wprowadzonym limitem nakłuć.`);
    if (maxWithdrawalsPerVial !== null) {
      result.checks.push(`Uwzględniono maksymalnie ${formatNumber(maxWithdrawalsPerVial, 0)} nakłuć jednej fiolki; jedno podanie oznacza jedno nakłucie.`);
    }
  } else if (singleUse) {
    const perDoseRatio = result.singleUnits / singleUseUnitSize;
    const containersPerDose = finite(perDoseRatio) ? Math.max(1, ceil(perDoseRatio)) : null;
    const containers = containersPerDose === null ? null : containersPerDose * frequency * days;
    const unused = containers === null ? null : Math.max(0, containers * singleUseUnitSize - result.totalUnits);
    if (!Number.isSafeInteger(containersPerDose) || !Number.isSafeInteger(containers) || containers <= 0 || !finite(unused)) {
      result.errors.push(`Liczba jednorazowych pojemników jest poza zakresem obliczeń. Sprawdź ich ${oralSingleUse ? 'masę w g' : 'objętość w ml'}.`);
      return result;
    }
    result.singleUseContainers = containers;
    result.unusedSingleUseUnits = clean(unused);
    if (injection) result.unusedSingleUseVolume = clean(unused);
    packageRatio = containers / containersPerPackage;
    result.checks.push(oralSingleUse
      ? 'Dla każdego podania uwzględniono nowe jednorazowe pojemniki preparatu doustnego; pozostałość po podaniu jest usuwana.'
      : 'Dla każdego podania uwzględniono nowe jednorazowe ampułki lub ampułkostrzykawki.');
    if (unused > tolerance(result.totalUnits)) {
      result.warnings.push(`Pozostałość w otwartych jednorazowych pojemnikach (${formatNumber(unused, 4)} ${result.unitLabel} łącznie) nie jest przenoszona na kolejne podania.`);
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
  const priorContainerWaste = Math.max(0, (result.packages - 1) * (packageSize - usablePerPackage));
  result.expiryWasteUnits = clean(multiDose && !multiDoseExpiryLimited ? 0 : priorContainerWaste);
  if (multiDose) {
    result.discardedMultiDoseVolume = clean(priorContainerWaste);
    if (priorContainerWaste > tolerance(result.providedUnits)) {
      result.warnings.push(`Pozostałości w poprzednich fiolkach (${formatNumber(priorContainerWaste, 4)} ml łącznie) nie są przenoszone na następne podania po wyczerpaniu liczby pełnych dawek, trwałości lub limitu nakłuć.`);
    }
  }
  if (shelfLifeDays !== null) {
    result.checks.push(`Uwzględniono trwałość po otwarciu/przygotowaniu: ${formatNumber(shelfLifeDays)} dni.`);
    if (result.packages > packagesWithoutShelfLife) {
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

  for (const key of ['singleMg', 'dailyMg', 'theoreticalUnits', 'singleUnits', 'dailyUnits', 'totalUnits', 'packages', 'providedUnits', 'leftoverUnits', 'roundingDifferencePercent', 'maxRatio', 'expiryWasteUnits', 'singleUseContainers', 'unusedSingleUseVolume', 'unusedSingleUseUnits', 'dosesPerVial', 'discardedMultiDoseVolume']) {
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
