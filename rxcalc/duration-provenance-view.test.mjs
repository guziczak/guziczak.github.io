import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { LIQUID_STARTER_REGIMENS } from './liquid-starters.js';
import { resolveDurationGuidance } from './duration-guidance.js';
import { durationGuidanceMarkup } from './duration-view.js';

const records = [...HUMAN_REGIMENS, ...LIQUID_STARTER_REGIMENS];
const forms = DRUGS.flatMap(drug => drug.forms);
const adultSubstitution = 'dental-augmentin-suspension-adult-substitution';
function options(id, changes = {}) {
  const source = structuredClone(records.find(record => record.id === id));
  assert.ok(source, id);
  const form = structuredClone(forms.find(item => item.id === source.formIds[0]));
  const child = source.patientTypes?.length === 1 && source.patientTypes[0] === 'child';
  return { source, form, context: {
    specialty: 'dental', patientType: child ? 'child' : 'adult', formId: form.id,
    age: child ? 5 : 35, ageUnit: 'years', weight: child ? 20 : 70,
    renalStatus: 'unknown', crcl: null, doseMode: source.doseMode,
    dose: source.dose ?? source.doseRange?.min ?? null,
    frequency: source.frequency ?? source.frequencyOptions?.[0] ?? null,
    days: 7, roundingStep: null, ...changes,
  } };
}
const pediatric = () => resolveDurationGuidance(options('dental-augmentin-400-57-child', { dose: 45 }));
const markup = (guidance, days = '', choices = [3, 5, 7, 10]) =>
  durationGuidanceMarkup({ guidance, days, choices });
const visibleText = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
function button(html, days) {
  const tile = [...html.matchAll(/<button\b[^>]*data-action="days"[^>]*>[\s\S]*?<\/button>/g)]
    .map(match => match[0]).find(value => value.includes(`data-value="${days}"`));
  assert.ok(tile, `Missing ${days}-day button`);
  return tile;
}
function feedback(html) {
  const status = html.match(/<p\b[^>]*class="[^"]*\bduration-feedback\b[^"]*"[^>]*>[\s\S]*?<\/p>/)?.[0];
  assert.ok(status, 'Missing duration feedback');
  return status;
}

test('external out-of-range tiles name their own organization while in-range tiles stay neutral', () => {
  const examples = [
    { guidance: pediatric(), organization: 'UCSF' },
    { guidance: resolveDurationGuidance(options('dental-ospamox-suspension-ge40-q8', { dose: 500 })), organization: 'SDCEP' },
  ];
  for (const { guidance, organization } of examples) {
    const html = markup(guidance, 10, [2, 3, 7, 10]);
    assert.ok(visibleText(button(html, 2)).includes(`Poniżej zakresu ${organization}`));
    assert.ok(visibleText(button(html, 10)).includes(`Powyżej zakresu ${organization}`));
    for (const days of [2, 10]) assert.match(button(html, days), /\bduration-warning\b/);
    assert.match(button(html, 3), /\bduration-neutral\b/);
    assert.ok(visibleText(button(html, 3)).includes(`W zakresie ${organization}`));
    assert.doesNotMatch(button(html, 3), /\bduration-within\b/);
    assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
    assert.match(visibleText(button(html, 10)), /Wybrano/);
  }
});

test('a warning caused only by a primary restriction is not attributed to UCSF', () => {
  const cases = [
    { patch: { maximum: 4, hardMaximum: false }, days: 5, tone: 'warning' },
    { patch: { minimum: 4 }, days: 3, tone: 'warning' },
    { patch: { maximum: 4, hardMaximum: true }, days: 5, tone: 'critical' },
    { patch: { reviewAfterDays: 4, reviewText: 'Pierwotne źródło wymaga oceny po 4 dniach.' }, days: 5, tone: 'warning' },
  ];
  for (const { patch, days, tone } of cases) {
    const guidance = pediatric();
    guidance.rule = { ...guidance.rule, ...patch };
    const html = markup(guidance, days);
    const tile = button(html, days);
    assert.ok(tile.includes(`duration-${tone}`));
    assert.doesNotMatch(tile, /\bduration-neutral\b/);
    assert.doesNotMatch(visibleText(tile), /UCSF|SDCEP|W zakresie/);
    assert.ok(feedback(html).includes(`duration-${tone}`));
  }
});

test('reviewed adult Augmentin without a range explicitly remains unassessed before and after selection', () => {
  const guidance = resolveDurationGuidance(options(adultSubstitution));
  assert.equal(guidance.applicable, true);
  assert.equal(guidance.coverage, 'reviewed');
  assert.equal(guidance.rule.kind, 'review-only');
  for (const days of ['', 7]) {
    const html = markup(guidance, days);
    const status = feedback(html);
    assert.match(status, /\bduration-neutral\b/);
    assert.match(visibleText(status), /Czas nieoceniony/);
    assert.match(visibleText(status), /źródło wybranego schematu nie określa zakresu dni/);
    assert.match(html.split('<details')[0], /Nie przedłużać leczenia ponad 14 dni bez ponownej oceny/);
    for (const choice of [3, 5, 7, 10]) {
      assert.match(button(html, choice), /\bduration-neutral\b/);
      assert.doesNotMatch(visibleText(button(html, choice)), /W zakresie|Zgodne ze schematem/);
    }
  }
});

test('a reviewed individual-duration source receives the same explicit unassessed status', () => {
  const guidance = resolveDurationGuidance(options('dental-dalacin-c-300-over14-tid'));
  assert.equal(guidance.applicable, true);
  assert.equal(guidance.coverage, 'reviewed');
  assert.equal(guidance.rule.kind, 'individual');
  assert.equal(guidance.rule.minimum, null);
  assert.equal(guidance.rule.maximum, null);
  for (const days of ['', 7]) {
    const status = feedback(markup(guidance, days));
    assert.match(status, /\bduration-neutral\b/);
    assert.match(visibleText(status), /Czas nieoceniony/);
    assert.match(visibleText(status), /źródło wybranego schematu nie określa zakresu dni/);
  }
});

test('missing patient scope and new or changed sources retain their specific unresolved reason', () => {
  const missingPatient = options(adultSubstitution, { weight: null });
  const newSource = options(adultSubstitution);
  newSource.source.id = 'new-unreviewed-substitution';
  const changedSource = options(adultSubstitution);
  changedSource.source.indication = 'A different indication not yet reviewed';
  for (const scenario of [missingPatient, newSource, changedSource]) {
    const guidance = resolveDurationGuidance(scenario);
    assert.equal(guidance.applicable, false);
    assert.ok(guidance.reason);
    for (const days of ['', 7]) {
      const status = feedback(markup(guidance, days));
      assert.ok(status.includes(escape(guidance.reason)));
      assert.doesNotMatch(visibleText(status), /Czas nieoceniony — źródło wybranego schematu nie określa zakresu dni/);
    }
  }
});

test('an actual adult extension warning takes precedence without changing data or selected state', () => {
  const scenario = options(adultSubstitution, { days: 15, confirmed: false, roundingReviewed: false });
  const before = structuredClone(scenario);
  const guidance = resolveDurationGuidance(scenario);
  const guidanceBefore = structuredClone(guidance);
  const html = markup(guidance, 15, [3, 7, 10, 15]);
  const status = feedback(html);
  assert.match(status, /\bduration-warning\b/);
  assert.match(visibleText(status), /Nie przedłużać leczenia ponad 14 dni bez ponownej oceny/);
  assert.doesNotMatch(visibleText(status), /Czas nieoceniony|nie określa zakresu dni/);
  const selected = button(html, 15);
  assert.match(selected, /\bduration-warning\b/);
  assert.match(selected, /aria-pressed="true"/);
  assert.match(visibleText(selected), /Wybrano/);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  assert.deepEqual(scenario, before);
  assert.deepEqual(guidance, guidanceBefore);
});
