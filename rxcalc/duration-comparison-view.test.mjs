import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { LIQUID_STARTER_REGIMENS } from './liquid-starters.js';
import {
  resolveDurationGuidance, assessDuration, assessDurationTime, durationResultWarning,
} from './duration-guidance.js';
import { durationGuidanceMarkup } from './duration-view.js';

const records = [...HUMAN_REGIMENS, ...LIQUID_STARTER_REGIMENS];
const forms = DRUGS.flatMap(drug => drug.forms);
function options(id, changes = {}) {
  const source = structuredClone(records.find(record => record.id === id));
  assert.ok(source, id);
  const form = structuredClone(forms.find(item => item.id === source.formIds[0]));
  const child = source.patientTypes?.length === 1 && source.patientTypes[0] === 'child';
  return {
    source, form,
    context: {
      specialty: 'dental', patientType: child ? 'child' : 'adult', formId: form.id,
      age: child ? 5 : 35, ageUnit: 'years', weight: child ? 20 : 70,
      renalStatus: 'unknown', crcl: null,
      doseMode: source.doseMode, dose: source.dose ?? source.doseRange?.min ?? null,
      frequency: source.frequency ?? source.frequencyOptions?.[0] ?? null,
      days: 7, roundingStep: null, ...changes,
    },
  };
}
const pediatric = (changes = {}) => options('dental-augmentin-400-57-child', changes);
const resolve = (changes = {}) => resolveDurationGuidance(pediatric(changes));
const markup = (guidance, days = '', choices = [3, 5, 7, 10]) =>
  durationGuidanceMarkup({ guidance, days, choices });
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
function button(html, days) {
  const found = [...html.matchAll(/<button\b[^>]*data-action="days"[^>]*>[\s\S]*?<\/button>/g)]
    .map(match => match[0]).find(item => item.includes(`data-value="${days}"`));
  assert.ok(found, `Missing ${days}-day button`);
  return found;
}
function shared(html) {
  const found = html.match(/<div\b[^>]*class="[^"]*\bduration-regimen-context\b[^"]*"[^>]*>[\s\S]*?<\/div>/)?.[0];
  assert.ok(found, 'Missing shared regimen context');
  assert.equal((html.match(/class="[^"]*\bduration-regimen-context\b/g) || []).length, 1);
  return found;
}
function feedback(html) {
  const found = html.match(/<p\b[^>]*class="[^"]*\bduration-feedback\b[^"]*"[^>]*>[\s\S]*?<\/p>/)?.[0];
  assert.ok(found, 'Missing time feedback');
  return found;
}
function neutralReferenceButton(html, days, organization) {
  const tile = button(html, days);
  assert.match(tile, /\bduration-neutral\b/);
  assert.doesNotMatch(tile, /\bduration-(?:warning|critical|within)\b/);
  assert.ok(tile.includes(`W zakresie ${organization}`));
  assert.doesNotMatch(tile, /Zgodne ze schematem|Wymaga oceny/);
}

test('time comparison is separate from full-regimen assessment and remains pure', () => {
  const scenario = pediatric({ dose: 25, days: 7, confirmed: false, roundingReviewed: false });
  const initial = structuredClone(scenario);
  const guidance = resolveDurationGuidance(scenario);
  const guidanceBefore = structuredClone(guidance);
  for (const days of [3, 5, 7]) {
    assert.equal(assessDurationTime(days, guidance).state, 'within');
    assert.deepEqual(assessDurationTime(days, guidance), assessDurationTime(String(days), guidance));
    assert.equal(assessDuration(days, guidance).state, 'regimen-mismatch');
    assert.equal(assessDuration(days, guidance).tone, 'warning');
    markup(guidance, days);
  }
  assert.deepEqual(scenario, initial);
  assert.deepEqual(guidance, guidanceBefore);
});

test('25 and 35 mg/kg/day show neutral in-range UCSF days with one shared mismatch', () => {
  for (const dose of [25, 35]) {
    const guidance = resolve({ dose });
    const html = markup(guidance, 5);
    for (const days of [3, 5, 7]) neutralReferenceButton(html, days, 'UCSF');
    const context = shared(html);
    const visible = html.split('<details')[0];
    assert.equal(guidance.regimen.state, 'mismatch');
    for (const reason of guidance.regimen.reasons) {
      const encoded = escape(reason);
      assert.ok(context.includes(encoded));
      assert.equal(visible.split(encoded).length - 1, 1, 'Mismatch must appear once beside the group');
      assert.ok(!feedback(html).includes(encoded));
    }
    assert.match(context, /UCSF/);
  }
});

test('numeric UCSF agreement has compact neutral feedback and clinical conditions only in details', () => {
  const guidance = resolve({ dose: 45 });
  assert.equal(guidance.reference.doseComparison, 'same');
  assert.equal(guidance.regimen.state, 'reference-matched');
  assert.deepEqual(guidance.regimen.reasons, []);
  const html = markup(guidance, 7);
  for (const days of [3, 5, 7]) neutralReferenceButton(html, days, 'UCSF');
  assert.doesNotMatch(html, /duration-regimen-context/);
  const message = feedback(html);
  assert.match(message, /duration-neutral/);
  for (const text of [/dawka/i, /częstość/i, /czas/i, /liczbow/i, /UCSF/]) assert.match(message, text);
  assert.doesNotMatch(message, /⚠|wymaga.*oceny|niewystarczającej odpowiedzi|powikłani/i);
  assert.doesNotMatch(html.split('<details')[0], /niewystarczającej odpowiedzi|powikłani/i);
  const details = html.match(/<details\b[^>]*class="duration-sources"[^>]*>[\s\S]*?<\/details>/)?.[0];
  assert.ok(details, 'Clinical source conditions remain available in the disclosure');
  assert.ok(details.includes(escape(guidance.reference.note)));
  for (const text of [/niewystarczającej odpowiedzi/, /powikłanych/, /konsultację stomatologiczną/, /14 dni/])
    assert.match(details, text);
  assert.doesNotMatch(html, /duration-within|Zgodne ze schematem/);
  for (const days of [3, 5, 7]) assert.equal(durationResultWarning(days, guidance), null);
});

test('matching UCSF dosing does not invent selected days or suppress a changed-frequency warning', () => {
  const pending = markup(resolve({ dose: 45 }));
  assert.doesNotMatch(feedback(pending), /czas zgodne liczbowo|Zgodność liczbowa/);
  assert.doesNotMatch(pending, /aria-pressed="true"|duration-regimen-context/);
  const changed = resolve({ dose: 45, frequency: 1 });
  assert.equal(changed.regimen.state, 'mismatch');
  const html = markup(changed, 5);
  neutralReferenceButton(html, 5, 'UCSF');
  assert.match(shared(html), /podań|często/i);
  assert.ok(durationResultWarning(5, changed));
  assert.doesNotMatch(feedback(html), /Dawka, częstość i czas zgodne liczbowo/);
});

test('below and above the UCSF range remain time warnings with explicit direction', () => {
  const guidance = resolve({ dose: 45 });
  const html = markup(guidance, 10, [2, 3, 7, 10]);
  assert.match(button(html, 2), /duration-warning/);
  assert.match(button(html, 2), /Poniżej zakresu/);
  assert.match(button(html, 10), /duration-warning/);
  assert.match(button(html, 10), /Powyżej zakresu/);
  assert.match(feedback(html), /UCSF/);
  for (const days of [2, 10]) assert.equal(assessDurationTime(days, guidance).tone, 'warning');
});

test('a primary hard maximum inside an external range retains critical severity', () => {
  const guidance = resolve({ dose: 45 });
  guidance.rule = { ...guidance.rule, maximum: 4, hardMaximum: true };
  const html = markup(guidance, 5);
  assert.equal(assessDurationTime(5, guidance).tone, 'critical');
  assert.match(button(html, 5), /duration-critical/);
  assert.doesNotMatch(button(html, 5), /duration-neutral|W zakresie UCSF/);
  assert.match(feedback(html), /Przekroczony czas/);
});

test('a primary review threshold inside an external range remains visible and yellow', () => {
  const guidance = resolve({ dose: 45 });
  guidance.rule = { ...guidance.rule, reviewAfterDays: 4, reviewText: 'Ponowna ocena po 4 dniach.' };
  const html = markup(guidance, 5);
  assert.equal(assessDurationTime(5, guidance).state, 'review');
  assert.match(button(html, 5), /duration-warning/);
  assert.doesNotMatch(button(html, 5), /duration-neutral|W zakresie UCSF/);
  assert.match(feedback(html), /Ponowna ocena po 4 dniach/);
});

test('15 days preserves both external range deviation and the primary 14-day review', () => {
  for (const dose of [25, 45]) {
    const guidance = resolve({ dose });
    const html = markup(guidance, 15, [3, 7, 10, 15]);
    assert.match(button(html, 15), /duration-warning/);
    const message = feedback(html);
    assert.match(message, /3–7 dni w UCSF/);
    assert.match(message, /Nie przedłużać leczenia ponad 14 dni/);
    assert.equal(assessDurationTime(15, guidance).sourceState, 'review');
    assert.ok(durationResultWarning(15, guidance));
  }
});

test('SDCEP uses the same presentation split and keeps its review instruction visible', () => {
  const guidance = resolveDurationGuidance(options('dental-ospamox-suspension-ge40-q8', { dose: 500 }));
  const html = markup(guidance, 5);
  for (const days of [3, 5]) neutralReferenceButton(html, days, 'SDCEP');
  for (const days of [7, 10]) assert.match(button(html, days), /duration-warning/);
  assert.match(shared(html), /SDCEP/);
  assert.match(html.split('<details')[0], /Ponowna ocena.*3 dniach/);
  assert.match(html.split('<details')[0], /nie jest automatyczny koniec kuracji/);
  assert.ok(durationResultWarning(5, guidance));
});

test('adult Augmentin without a range remains unassessed and keeps its extension warning', () => {
  const guidance = resolveDurationGuidance(options('dental-augmentin-suspension-adult-substitution'));
  assert.equal(guidance.reference, undefined);
  const html = markup(guidance, 7, [3, 5, 7, 10, 15]);
  for (const days of [3, 5, 7, 10]) {
    assert.match(button(html, days), /duration-neutral/);
    assert.doesNotMatch(button(html, days), /W zakresie|Zgodne ze schematem/);
  }
  assert.match(button(html, 15), /duration-warning/);
  assert.doesNotMatch(html, /duration-regimen-context/);
  assert.match(feedback(html), /Czas nieoceniony — źródło wybranego schematu nie określa zakresu dni/);
  assert.match(html.split('<details')[0], /Nie przedłużać leczenia ponad 14 dni bez ponownej oceny/);
});

test('rounding to 448 mg retains the dose mismatch while showing the time range separately', () => {
  const guidance = resolve({ dose: 45, roundingStep: 0.1 });
  assert.equal(guidance.reference.doseComparison, 'different');
  assert.equal(guidance.regimen.state, 'mismatch');
  const html = markup(guidance, 5);
  neutralReferenceButton(html, 5, 'UCSF');
  assert.match(shared(html), /po przeliczeniu i zaokrągleniu/);
  assert.match(durationResultWarning(5, guidance), /po przeliczeniu i zaokrągleniu/);
  assert.doesNotMatch(shared(html), /Dawkowanie liczbowe odpowiada (?:odniesieniu )?UCSF/);
});

test('missing eligibility or changed source audit cannot imply a valid external time comparison', () => {
  const missingAge = pediatric({ age: null, dose: 45 });
  const changedSource = pediatric({ dose: 45 });
  changedSource.source.indication = 'Other indication';
  for (const scenario of [missingAge, changedSource]) {
    const guidance = resolveDurationGuidance(scenario);
    assert.equal(guidance.applicable, false);
    const html = markup(guidance, 5);
    for (const days of [3, 5, 7]) {
      assert.match(button(html, days), /duration-neutral/);
      assert.doesNotMatch(button(html, days), /W zakresie|Zgodne ze schematem/);
    }
    assert.doesNotMatch(html, /duration-within/);
  }
});

test('incomplete dosing keeps a shared data prompt without turning a time match green', () => {
  const guidance = resolve({ dose: null, frequency: null });
  assert.equal(guidance.applicable, true);
  assert.equal(guidance.regimen.state, 'incomplete');
  const html = markup(guidance);
  neutralReferenceButton(html, 3, 'UCSF');
  const context = shared(html);
  for (const reason of guidance.regimen.reasons) assert.ok(context.includes(escape(reason)));
  assert.doesNotMatch(html, /duration-within|aria-pressed="true"/);
});

test('a matched local source retains its existing green duration meaning', () => {
  const guidance = resolveDurationGuidance(options('metronidazole-ulcerative-gingivitis'));
  assert.equal(guidance.regimen.state, 'matched');
  assert.equal(assessDuration(7, guidance).tone, 'within');
  const html = markup(guidance, 7);
  assert.match(button(html, 7), /duration-within/);
  assert.match(button(html, 7), /Zgodne ze schematem/);
  assert.doesNotMatch(html, /duration-regimen-context/);
});

test('selection has its own visible label and never converts warning status to approval', () => {
  for (const days of [3, 10]) {
    const html = markup(resolve({ dose: 45 }), days);
    const selected = button(html, days);
    assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
    assert.match(selected, /aria-pressed="true"/);
    const visible = selected.replace(/<[^>]+>/g, ' ');
    assert.match(visible, /Wybrano/);
    assert.match(selected, days === 3 ? /duration-neutral/ : /duration-warning/);
    assert.doesNotMatch(selected, /duration-within/);
    for (const other of [3, 5, 7, 10].filter(value => value !== days))
      assert.doesNotMatch(button(html, other).replace(/<[^>]+>/g, ' '), /Wybrano/);
  }
});
