/** Arithmetic shortcuts for the current formulation, never a treatment selection.
 * `allowed` means the amount can be entered, not that it complies with a source.
 * Only `withinLimits` amounts may be used for the one-time source prefill.
 * The dose engine and export checks independently assess the selected amount.
 */
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
  const singleCaps = [...singleLimits, ...(positive(source?.maxUnitsPerDose) ? [source.maxUnitsPerDose * form.strengthMg] : [])];
  const dailyCaps = [...dailyLimits, ...(positive(source?.maxDailyUnits) ? [source.maxDailyUnits * form.strengthMg] : [])];
  const invalidLimit = [...singleCaps, ...dailyCaps, ...unitLimits].some(value => !positive(value));
  const selectedFrequency = positive(frequency) ? frequency : positive(source?.frequency) ? source.frequency : null;
  const divisible = Array.isArray(form.allowedFractions) && form.allowedFractions.includes(0.5);

  return [2, 1, 0.5].map(tablets => {
    const mg = clean(form.strengthMg * tablets);
    const value = doseMode === 'units' ? tablets : mg;
    const dailyMg = selectedFrequency === null ? null : clean(mg * selectedFrequency);
    let reason = '';
    if (!positive(mg)) reason = 'Nieprawidłowa wartość';
    else if (tablets === 0.5 && !divisible) reason = 'Brak podziału na połowy';
    else if (invalidLimit) reason = 'Nieprawidłowy limit dawki';
    else if (dailyMg !== null && !positive(dailyMg)) reason = 'Nieprawidłowa wartość dobowa';

    const warnings = [];
    const warn = (code, severity, message, detail = {}) => warnings.push({ code, severity, message, ...detail });
    if (!reason) {
      if (range) {
        if (above(range.min, value)) warn('below-range', 'warning', 'Poniżej zakresu schematu');
        if (above(value, range.max)) warn('above-range', 'critical', 'Powyżej zakresu schematu');
      } else if (fixedEditable) {
        if (above(source.dose, value)) warn('below-source', 'warning', 'Poniżej dawki ze źródła');
        if (above(value, source.dose)) warn('above-source', 'critical', 'Powyżej dawki ze źródła');
      }
      if (singleCaps.some(limit => above(mg, limit))) {
        warn('single-limit', 'critical', 'Ponad limit jednorazowy', { actual: mg, limit: Math.min(...singleCaps), unit: 'mg' });
      }
      if (dailyMg !== null && dailyCaps.some(limit => above(dailyMg, limit))) {
        warn('daily-limit', 'critical', 'Ponad limit dobowy', { actual: dailyMg, limit: Math.min(...dailyCaps), unit: 'mg/dobę' });
      }
    }
    // A concrete ceiling breach takes priority over a simultaneous source-range
    // deviation. Neither warning makes a computable amount unselectable.
    const primary = warnings.find(w => w.code === 'daily-limit')
      || warnings.find(w => w.code === 'single-limit')
      || warnings.find(w => w.severity === 'critical') || warnings[0];
    const allowed = reason === '';
    return { tablets, value, mg, allowed, withinLimits: allowed && warnings.length === 0,
      reason: reason || primary?.message || '', severity: primary?.severity || null, warnings };
  });
}
