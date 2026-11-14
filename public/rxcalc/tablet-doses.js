/** Arithmetic shortcuts for the current formulation, never a treatment selection. */
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const present = value => value !== null && value !== undefined && value !== '';
const above = (value, limit) => !Number.isFinite(value)
  || value - limit > Number.EPSILON * 32 * Math.max(1, Math.abs(value), Math.abs(limit));
const clean = value => Number(value.toPrecision(14));

/**
 * `value` uses the current field's unit: mg in fixed mode, tablets in units mode.
 * `mg` always uses strengthMg from the exact formulation, not its trade-name digits.
 * Patient eligibility and completeness remain the responsibility of the dose engine.
 */
export function tabletDoseChoices(form, {
  doseMode = 'fixed', source = null, frequency = null, allowFixedSource = false,
  maxSingleMg = null, maxDailyMg = null,
} = {}) {
  if (form?.form !== 'tablet' || !positive(form.strengthMg)
      || !['fixed', 'units'].includes(doseMode)
      || form.referenceOnly || form.calculationBlocked) return [];

  const range = source?.doseRange;
  const fixedEditable = allowFixedSource === true && positive(source?.dose);
  if (source && (source.doseMode !== doseMode || !fixedEditable && (present(source.dose)
      || !positive(range?.min) || !positive(range?.max) || range.min > range.max))) return [];

  const singleLimits = [form.maxSingleMg, source?.maxSingleMg, maxSingleMg].filter(present);
  const dailyLimits = [form.maxDailyMg, source?.maxDailyMg, maxDailyMg].filter(present);
  const unitLimits = [source?.maxUnitsPerDose, source?.maxDailyUnits].filter(present);
  const invalidLimit = [...singleLimits, ...dailyLimits, ...unitLimits].some(value => !positive(value));
  const selectedFrequency = positive(frequency) ? frequency : positive(source?.frequency) ? source.frequency : null;
  const divisible = Array.isArray(form.allowedFractions) && form.allowedFractions.includes(0.5);

  return [2, 1, 0.5].map(tablets => {
    const mg = clean(form.strengthMg * tablets);
    const value = doseMode === 'units' ? tablets : mg;
    let reason = '';
    if (!positive(mg)) reason = 'Nieprawidłowa wartość';
    else if (tablets === 0.5 && !divisible) reason = 'Brak podziału na połowy';
    else if (invalidLimit) reason = 'Nieprawidłowy limit dawki';
    else if (range && (above(range.min, value) || above(value, range.max))) reason = 'Poza zakresem schematu';
    else if (singleLimits.some(limit => above(mg, limit))
        || positive(source?.maxUnitsPerDose) && above(tablets, source.maxUnitsPerDose)) reason = 'Ponad limit jednorazowy';
    else if (selectedFrequency !== null && (
      dailyLimits.some(limit => above(mg * selectedFrequency, limit))
      || positive(source?.maxDailyUnits) && above(tablets * selectedFrequency, source.maxDailyUnits)
    )) reason = 'Ponad limit dobowy';
    return { tablets, value, mg, allowed: reason === '', reason };
  });
}
