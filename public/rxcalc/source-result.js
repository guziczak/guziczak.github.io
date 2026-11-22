import { formatNumber } from './engine.js';

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

const sameLimitNumber = (a, b) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= Number.EPSILON * 32 * Math.max(1, Math.abs(a), Math.abs(b));
const limitOriginLabels = {
  manual: 'limit wprowadzony przez lekarza',
  regimen: 'limit wybranego schematu',
  product: 'limit z danych preparatu',
};

/** Identify only the sources of the effective (lowest) limit. A higher manual
 * value must not relabel a lower source limit as one entered by the clinician. */
export function limitOriginsFor(value, { manual, regimen, product, conditional } = {}) {
  if (!positive(value)) return [];
  return [
    ['manual', manual], ['regimen', regimen], ['product', product], ['product', conditional],
  ].filter(([, candidate]) => positive(candidate) && sameLimitNumber(value, candidate))
    .map(([origin]) => origin).filter((origin, index, all) => all.indexOf(origin) === index);
}

function doseLimitMessage(scope, issues, result) {
  const unit = scope === 'daily' ? 'mg/dobę' : 'mg';
  const name = scope === 'daily' ? 'Dawka dobowa' : 'Dawka jednorazowa';
  const administered = scope === 'daily' ? result.dailyMg : result.singleMg;
  const rounded = Number.isFinite(result.roundingDifferencePercent)
    && Math.abs(result.roundingDifferencePercent) > 1e-7;
  const amounts = [];
  for (const issue of issues) {
    let amount = amounts.find(item => sameLimitNumber(item.value, issue.actualMg));
    if (!amount) amounts.push(amount = { value: issue.actualMg, bases: new Set(), limits: [] });
    amount.bases.add(issue.basis);
    let limit = amount.limits.find(item => sameLimitNumber(item.value, issue.limitMg));
    if (!limit) amount.limits.push(limit = { value: issue.limitMg, origins: new Set() });
    for (const origin of issue.origins) limit.origins.add(origin);
  }
  const sentences = amounts.map(amount => {
    const requestedOnly = !amount.bases.has('administered')
      && !sameLimitNumber(amount.value, administered);
    const label = requestedOnly ? `Wpisana ${name.toLowerCase()}`
      : rounded && !amount.bases.has('requested') ? `${name} po zaokrągleniu` : name;
    const limits = amount.limits.sort((a, b) => a.value - b.value).map(limit => {
      const origins = Object.keys(limitOriginLabels).filter(origin => limit.origins.has(origin));
      const label = origins.length ? origins.map(origin => limitOriginLabels[origin]).join(' i ') : 'zastosowany limit';
      return `${label}: ${formatNumber(limit.value, 4)} ${unit}`;
    });
    return `${label} ${formatNumber(amount.value, 4)} ${unit} przekracza ${limits.join(' oraz ')}.`;
  });
  // A requested dose can fail even if rounding down brings the administered
  // amount below the limit. Keep that distinction visible alongside the error.
  if (rounded && positive(administered) && !issues.some(issue => issue.basis === 'administered')
      && amounts.every(amount => !sameLimitNumber(amount.value, administered))) {
    sentences.push(`Po zaokrągleniu: ${formatNumber(administered, 4)} ${unit}.`);
  }
  return sentences.join(' ');
}

/** One display message per dose-limit category. Both validators and their raw
 * errors remain untouched; only recognized, still-present issue records can be
 * combined. Different amounts and limits stay explicit in the same message. */
export function resultErrorMessages(result, { sourceCheck, limitOrigins = {} } = {}) {
  const errors = result?.errors || [];
  const groups = new Map();
  const issueByMessage = new Map();
  for (const [owner, basis] of [[result, 'administered'], [sourceCheck, 'requested']]) {
    for (const issue of owner?.doseLimitIssues || []) {
      if (!['single', 'daily'].includes(issue.scope) || issue.code !== `${issue.scope}-dose-limit`
          || issue.basis !== basis || !positive(issue.actualMg) || !positive(issue.limitMg)
          || issue.actualMg <= issue.limitMg || !owner.errors?.includes(issue.message)
          || !errors.includes(issue.message)) continue;
      const origins = basis === 'requested' ? ['regimen']
        : (limitOrigins[issue.scope] || []).filter(origin => Object.hasOwn(limitOriginLabels, origin));
      if (!groups.has(issue.scope)) groups.set(issue.scope, []);
      groups.get(issue.scope).push({ ...issue, origins });
      issueByMessage.set(issue.message, issue.scope);
    }
  }
  const emitted = new Set();
  return errors.flatMap(message => {
    const scope = issueByMessage.get(message);
    if (!scope) return [message];
    if (emitted.has(scope)) return [];
    emitted.add(scope);
    return [doseLimitMessage(scope, groups.get(scope), result)];
  });
}
