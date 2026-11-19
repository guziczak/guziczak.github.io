/** Presentation of an eligible, numerically matching source comparison.
 * Arithmetic errors, independent limits and unrelated warnings remain intact.
 * A reference dose never becomes maxRatio or an engine safety limit.
 */
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const near = (a, b) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= Number.EPSILON * 512 * Math.max(1, Math.abs(a), Math.abs(b));

export function applySourceComparisonPresentation(result, { source, sourceCheck, note, modified = false } = {}) {
  if (!result?.valid || result.errors?.length || result.status === 'critical' || !source
      || sourceCheck?.valid !== true || modified || note?.comparisonEligibility?.valid === false
      || !positive(note?.dailyUnits) || !near(note.dailyUnits, result.dailyUnits)
      || !note.schemeRows?.length || note.rows?.length !== note.schemeRows.length) return result;
  const matches = note.schemeRows.every((scheme, i) => {
    const value = scheme?.perKg ? note.rows[i]?.perKg : note.rows[i]?.daily;
    return positive(value) && positive(scheme?.maximum) && Number.isFinite(scheme.minimum)
      && (value > scheme.minimum || near(value, scheme.minimum))
      && (value < scheme.maximum || near(value, scheme.maximum));
  });
  if (!matches) return result;
  const activity = note.rows[0]?.unit === 'j.m.';
  const details = result.warningDetails || [];
  const informational = details.filter(item => item.code === 'daily-limit-unspecified'
    || activity && item.code === 'quantity-without-mg');
  const messages = new Set(informational.map(item => item.message));
  const warnings = result.warnings.filter(message => !messages.has(message));
  const row = note.rows[0], scheme = note.schemeRows[0];
  return { ...result, warnings,
    warningDetails: details.filter(item => !informational.includes(item)),
    notices: [...(result.notices || []), ...informational.map(item => ({ ...item,
      sourceComparison: true,
      message: item.code === 'quantity-without-mg' ? 'Dawkę substancji pokazano w j.m.; nie przeliczamy jej na mg.'
        : 'Porównanie dotyczy dawki wybranego schematu. Nie ustalono odrębnego maksimum dobowego.',
    }))],
    status: result.status === 'warning' && !warnings.length ? 'ok' : result.status,
    sourceComparison: { daily: row.daily, unit: row.unit,
      ratio: (scheme.perKg ? row.perKg : row.daily) / scheme.maximum,
      referenceDaily: scheme.dailyMax,
      label: scheme.kind === 'fixed' ? 'dawka dobowa schematu' : 'górna granica schematu' },
  };
}
