import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './engine.js';
import { resolveHumanRegimen } from './human-regimen-engine.js';
import { resultErrorMessages, limitOriginsFor } from './source-result.js';

// Synthetic records test presentation semantics, not clinical dosing guidance.
const source = {
  id: 'dose-alert-fixture', formIds: ['test-form'], specialties: ['dental'],
  indication: 'Syntetyczny schemat testowy', sourceUrl: 'https://example.org/source',
  sourceLabel: 'Źródło testowe', sourceSection: '4.2', sourceCheckedAt: '2026-11-22',
  doseMode: 'fixed', dose: 875, frequency: 2, maxSingleMg: 875, maxDailyMg: 1750,
};
const minimum = values => {
  const available = values.filter(value => Number.isFinite(value) && value > 0);
  return available.length ? Math.min(...available) : null;
};

function fixture({ dose = 1000, roundingStep = null, manual = null,
  productDaily = null, useSource = true } = {}) {
  const sourceCheck = useSource ? resolveHumanRegimen(source, {
    formId: 'test-form', specialty: 'dental', patientType: 'adult',
    dose, frequency: 2, days: 7,
  }, { allowNumericOverrides: true }) : null;
  const maxSingleMg = sourceCheck?.maxSingleMg ?? null;
  const maxDailyMg = minimum([manual, productDaily, sourceCheck?.maxDailyMg]);
  const arithmetic = calculate({
    form: 'suspension', unitLabel: 'ml', doseMode: 'fixed', dose, frequency: 2, days: 7,
    concentrationMg: 100, concentrationMl: 1, packageSize: 100,
    roundingStep, maxSingleMg, maxDailyMg,
  });
  const result = { ...arithmetic, errors: [...arithmetic.errors, ...(sourceCheck?.errors || [])] };
  if (sourceCheck?.valid === false) {
    result.valid = false;
    if (result.status !== 'critical') result.status = 'incomplete';
  }
  return { arithmetic, sourceCheck, result, limitOrigins: {
    single: limitOriginsFor(maxSingleMg, { regimen: sourceCheck?.maxSingleMg }),
    daily: limitOriginsFor(maxDailyMg, { manual, product: productDaily, regimen: sourceCheck?.maxDailyMg }),
  } };
}

const present = value => resultErrorMessages(value.result, value);
const messageFor = (messages, scope) => {
  const matching = messages.filter(message => scope === 'single'
    ? /dawka jednorazowa/i.test(message) : /dawka dobowa/i.test(message));
  assert.equal(matching.length, 1, `Expected one ${scope} dose-limit alert: ${messages.join(' | ')}`);
  return matching[0];
};
function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

test('matching regimen violations produce two explicit alerts without changing either validation result', () => {
  const value = fixture();
  assert.equal(value.result.errors.length, 4);
  assert.equal(value.arithmetic.valid, false);
  assert.equal(value.sourceCheck.valid, false);
  assert.equal(value.result.status, 'critical');
  const before = structuredClone(value), rawErrors = value.result.errors;
  freezeDeep(value);
  const messages = present(value);
  assert.equal(messages.length, 2);
  assert.equal(messageFor(messages, 'single'),
    'Dawka jednorazowa 1000 mg przekracza limit wybranego schematu: 875 mg.');
  assert.equal(messageFor(messages, 'daily'),
    'Dawka dobowa 2000 mg/dobę przekracza limit wybranego schematu: 1750 mg/dobę.');
  assert.deepEqual(value, before);
  assert.strictEqual(value.result.errors, rawErrors);
});

test('a stricter manual or product ceiling retains both threshold facts in one daily alert', () => {
  for (const [patch, limit, origin] of [
    [{ manual: 1500 }, 1500, /wprowadzony przez lekarza/],
    [{ productDaily: 1400 }, 1400, /preparatu|produktu/],
  ]) {
    const value = fixture(patch), messages = present(value);
    assert.equal(messages.length, 2);
    const daily = messageFor(messages, 'daily');
    assert.match(daily, origin);
    assert.ok(daily.includes(`${limit} mg/dobę`));
    assert.match(daily, /limit wybranego schematu: 1750 mg\/dobę/);
    assert.ok(daily.includes('2000 mg/dobę'));
    assert.equal(value.result.valid, false);
  }
});

test('a higher manual value cannot relabel the effective regimen ceiling', () => {
  const messages = present(fixture({ manual: 2500 }));
  assert.equal(messages.length, 2);
  const daily = messageFor(messages, 'daily');
  assert.match(daily, /limit wybranego schematu: 1750 mg\/dobę/);
  assert.doesNotMatch(daily, /lekarza|2500/);
});

test('an equal manual and regimen ceiling keeps both origins without a duplicate alert', () => {
  const messages = present(fixture({ manual: 1750 }));
  assert.equal(messages.length, 2);
  const daily = messageFor(messages, 'daily');
  assert.match(daily, /wprowadzony przez lekarza/);
  assert.match(daily, /wybranego schematu/);
  assert.equal(daily.match(/1750/g)?.length, 1);
});

test('rounding below the ceiling does not hide a failing requested dose', () => {
  const value = fixture({ dose: 880, roundingStep: 2 });
  assert.equal(value.arithmetic.singleMg, 800);
  assert.equal(value.arithmetic.valid, true);
  assert.equal(value.sourceCheck.valid, false);
  const messages = present(value);
  assert.equal(messages.length, 2);
  for (const [scope, requested, administered] of [['single', 880, 800], ['daily', 1760, 1600]]) {
    const message = messageFor(messages, scope);
    assert.match(message, /Wpisana dawka/);
    assert.ok(message.includes(`${requested} mg`));
    assert.match(message, /[Pp]o zaokrągleniu/);
    assert.ok(message.includes(`${administered} mg`));
  }
  assert.equal(value.result.valid, false);
});

test('rounding above the ceiling preserves the administered-dose alert when the source dose passes', () => {
  const value = fixture({ dose: 875, roundingStep: 1 });
  assert.equal(value.sourceCheck.valid, true);
  assert.equal(value.arithmetic.valid, false);
  assert.equal(value.arithmetic.singleMg, 900);
  const messages = present(value);
  assert.equal(messages.length, 2);
  for (const [scope, actual] of [['single', 900], ['daily', 1800]]) {
    const message = messageFor(messages, scope);
    assert.match(message, /po zaokrągleniu/);
    assert.ok(message.includes(`${actual} mg`));
  }
  assert.equal(value.result.valid, false);
  assert.equal(value.result.status, 'critical');
});

test('different requested and administered violations retain both quantities within each scope', () => {
  const value = fixture({ dose: 1001, roundingStep: 1 });
  assert.equal(value.arithmetic.singleMg, 1000);
  assert.equal(value.sourceCheck.dose, 1001);
  const messages = present(value);
  assert.equal(messages.length, 2);
  for (const [scope, requested, administered] of [['single', 1001, 1000], ['daily', 2002, 2000]]) {
    const message = messageFor(messages, scope);
    assert.match(message, /po zaokrągleniu/);
    assert.match(message, /Wpisana dawka/);
    assert.ok(message.includes(`${requested} mg`));
    assert.ok(message.includes(`${administered} mg`));
  }
});

test('manual-only and product-only errors do not invent a selected regimen', () => {
  for (const [patch, origin] of [
    [{ manual: 1500 }, /wprowadzony przez lekarza/],
    [{ productDaily: 1500 }, /preparatu|produktu/],
  ]) {
    const value = fixture({ ...patch, useSource: false }), messages = present(value);
    assert.equal(messages.length, 1);
    assert.match(messages[0], origin);
    assert.ok(messages[0].includes('1500 mg/dobę'));
    assert.doesNotMatch(messages[0], /wybranego schematu/);
    assert.equal(value.result.valid, false);
  }
});

test('floating-point conversion noise is not presented as deliberate rounding', () => {
  const result = calculate({
    form: 'suspension', unitLabel: 'ml', doseMode: 'fixed', dose: 1000,
    frequency: 2, days: 7, concentrationMg: 300, concentrationMl: 5,
    packageSize: 100, maxDailyMg: 1750, roundingStep: null,
  });
  assert.ok(Math.abs(result.roundingDifferencePercent) < 1e-7);
  assert.ok(!result.warningDetails.some(item => item.code === 'dose-rounded'));
  const messages = resultErrorMessages(result, { limitOrigins: { daily: ['manual'] } });
  assert.equal(messages.length, 1);
  assert.match(messages[0], /Dawka dobowa 2000 mg\/dobę/);
  assert.doesNotMatch(messages[0], /zaokrągleniu/);
});

test('unrelated errors stay unchanged even when their wording resembles a dose-limit alert', () => {
  const value = fixture();
  const unrelated = ['Uzupełnij dane pacjenta.', 'Dawka jednorazowa przekracza limit niezależnego warunku.'];
  value.result.errors.push(...unrelated);
  const before = structuredClone(value);
  const messages = present(freezeDeep(value));
  assert.equal(messages.length, 4);
  for (const message of unrelated) assert.equal(messages.filter(item => item === message).length, 1);
  assert.deepEqual(value, before);
});

test('missing, unknown, malformed or stale metadata cannot remove original errors', () => {
  for (const transform of [
    () => undefined,
    issues => issues.map(issue => ({ ...issue, code: 'unrecognized-dose-limit' })),
    issues => issues.map(issue => ({ ...issue, actualMg: null })),
    issues => issues.map(issue => ({ ...issue, message: `Stale: ${issue.message}` })),
  ]) {
    const value = fixture();
    value.result.doseLimitIssues = transform(value.result.doseLimitIssues);
    value.sourceCheck.doseLimitIssues = transform(value.sourceCheck.doseLimitIssues);
    const before = structuredClone(value);
    assert.deepEqual(present(freezeDeep(value)), value.result.errors);
    assert.deepEqual(value, before);
  }
});

test('limit origins describe only the effective threshold and deduplicate conditional product limits', () => {
  assert.deepEqual(limitOriginsFor(1750, { manual: 2500, regimen: 1750, product: 3000 }), ['regimen']);
  assert.deepEqual(limitOriginsFor(1500, { manual: 1500, regimen: 1750 }), ['manual']);
  assert.deepEqual(limitOriginsFor(1400, { product: 1400, conditional: 1400, regimen: 1750 }), ['product']);
  assert.deepEqual(limitOriginsFor(1400, { conditional: 1400 }), ['product']);
  assert.deepEqual(new Set(limitOriginsFor(1500, { manual: 1500, regimen: 1500,
    product: 1500, conditional: 1500 })), new Set(['manual', 'regimen', 'product']));
  assert.deepEqual(limitOriginsFor(1500, { manual: 1750, regimen: 2000 }), []);
  assert.deepEqual(limitOriginsFor(1500), []);
  for (const value of [null, undefined, 0, -1, NaN, Infinity, '1500']) {
    assert.deepEqual(limitOriginsFor(value, { manual: 1500, regimen: 1500, product: 1500 }), []);
  }
});
