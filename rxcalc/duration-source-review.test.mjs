import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { LIQUID_STARTER_REGIMENS } from './liquid-starters.js';
import { REGIMENS } from './regimens.js';
import { reviewedDurationSources } from './duration-source-review.js';
import { resolveDurationGuidance, assessDuration, durationResultWarning } from './duration-guidance.js';
import { durationGuidanceMarkup } from './duration-view.js';

const reviewedIds = [
  'dental-augmentin-tablet-500-125-ge40',
  'dental-augmentin-tablet-875-125-ge40',
  'dental-augmentin-suspension-adult-substitution',
  ...['suspension', 'tablet'].flatMap(form => ['q8', 'q12', 'severe']
    .map(schedule => `dental-ospamox-${form}-ge40-${schedule}`)),
  ...[150, 300].flatMap(strength => ['tid', 'qid']
    .map(schedule => `dental-dalacin-c-${strength}-over14-${schedule}`)),
  ...['periodontal', 'abscess', 'endo', 'ulcerative-gingivitis']
    .map(indication => `metronidazole-${indication}`),
];
const records = [...HUMAN_REGIMENS, ...LIQUID_STARTER_REGIMENS, ...REGIMENS];
const forms = DRUGS.flatMap(drug => drug.forms);
function options(id, changes = {}) {
  const source = structuredClone(records.find(record => record.id === id));
  assert.ok(source, id);
  const form = structuredClone(forms.find(item => item.id === source.formIds[0]));
  return { source, form, context: {
    specialty: 'dental', patientType: 'adult', formId: form.id,
    age: 35, ageUnit: 'years', weight: 70, renalStatus: 'unknown', crcl: null,
    doseMode: source.doseMode, dose: source.dose ?? source.doseRange?.min ?? null,
    frequency: source.frequency ?? source.frequencyOptions?.[0] ?? null,
    days: '', roundingStep: null, ...changes,
  } };
}
function review(id) {
  const result = reviewedDurationSources(id);
  assert.ok(result, `Missing reviewed sources for ${id}`);
  return result;
}
const notes = item => item.entries.map(entry => `${entry.label} ${entry.note}`).join(' ');
const markup = (guidance, days = '') => durationGuidanceMarkup({ guidance, days, choices: [3, 5, 7, 10] });

test('additional source reviews are explicitly scoped to the seventeen audited adult dental records', () => {
  const actualIds = records.filter(source => reviewedDurationSources(source.id)).map(source => source.id).sort();
  assert.deepEqual(actualIds, [...reviewedIds].sort());
  for (const id of reviewedIds) {
    const result = review(id);
    assert.match(result.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(result.entries.length > 0);
    for (const entry of result.entries) {
      assert.ok(entry.label?.trim());
      assert.ok(entry.note?.trim());
      assert.equal(new URL(entry.url).protocol, 'https:');
    }
    for (const field of ['dose', 'frequency', 'days', 'minimum', 'maximum', 'minDays', 'maxDays'])
      assert.equal(Object.hasOwn(result, field), false, `Source review must not supply ${field}`);
  }
  for (const id of ['unknown-regimen', 'dental-augmentin-400-57-child', 'dental-ospamox-child-tid', '__proto__', 'constructor', null])
    assert.equal(reviewedDurationSources(id), null);
});

test('Augmentin source notes distinguish the adult 500 and 875 schedules and their clinical scope', () => {
  const lower = review('dental-augmentin-tablet-500-125-ge40');
  const upper = review('dental-augmentin-tablet-875-125-ge40');
  assert.notDeepEqual(lower.entries, upper.entries);
  const ada = lower.entries.find(entry => /ADA|ada\.org/i.test(`${entry.label} ${entry.url}`));
  assert.ok(ada, 'The reviewed 500 mg option must identify the ADA source explicitly');
  assert.match(ada.note, /500/);
  assert.match(ada.note, /(?:3 razy|3 daw|3 poda|co 8|TID)/i);
  assert.match(ada.note, /7 dni/);
  assert.match(ada.note, /24/);
  const upperText = notes(upper);
  assert.match(upperText, /875/);
  assert.match(upperText, /(?:cięż|ogóln|systemow)/i);
  assert.match(upperText, /(?:warunk|zakres|dotyczy|odniesieni)/i);
});

test('Dalacin notes distinguish three and four daily administrations without claiming no TID reference exists', () => {
  const tid = review('dental-dalacin-c-300-over14-tid');
  const qid = review('dental-dalacin-c-300-over14-qid');
  assert.notDeepEqual(tid.entries, qid.entries);
  const tidText = notes(tid);
  assert.match(tidText, /Queensland/i);
  assert.match(tidText, /300/);
  assert.match(tidText, /(?:3 razy|3 daw|3 poda|co 8|TID)/i);
  const sdcep = qid.entries.find(entry => /SDCEP|sdcep/i.test(`${entry.label} ${entry.url}`));
  assert.ok(sdcep, 'QID comparison needs an explicitly identified SDCEP source');
  assert.match(sdcep.note, /300/);
  assert.match(sdcep.note, /(?:4 razy|4 daw|4 poda|co 6|QID)/i);
  assert.match(sdcep.note, /5 dni/);
  for (const item of [tid, qid]) assert.match(notes(item), /(?:warunk|zakres|wskazan|przypadk|odniesieni)/i);
});

test('local metronidazole reviews keep topical procedures and dressing retention separate from oral courses', () => {
  for (const suffix of ['periodontal', 'abscess', 'endo', 'ulcerative-gingivitis']) {
    const text = notes(review(`metronidazole-${suffix}`));
    assert.match(text, /(?:miejscow|maś[ćc]|maści)/i);
  }
  assert.match(notes(review('metronidazole-abscess')), /(?:odbarcz|procedur|zabieg)/i);
  const endo = notes(review('metronidazole-endo'));
  assert.match(endo, /(?:opatrunk|wkładk)/i);
  assert.match(endo, /(?:całej|całego|całkowit|nie.*kurac|nie.*leczeni)/i);
});

test('source review metadata is attached only after source signature and patient applicability checks', () => {
  const id = 'dental-augmentin-suspension-adult-substitution';
  const eligible = options(id);
  const result = resolveDurationGuidance(eligible);
  assert.equal(result.applicable, true);
  assert.deepEqual(result.sourceReview, review(id));
  const candidates = [
    options(id, { weight: null }),
    options(id, { custom: true }),
    options(id, { weight: 30 }),
    options(id), options(id), options(id),
  ];
  candidates[3].source.id = 'new-unreviewed-adult-source';
  candidates[4].source.indication = 'A different indication';
  candidates[5].form.id = 'a-different-form';
  for (const scenario of candidates) {
    const guidance = resolveDurationGuidance(scenario);
    assert.equal(guidance.applicable, false);
    assert.equal(guidance.sourceReview, undefined);
    assert.doesNotMatch(markup(guidance), /duration-source-review/);
  }
});

test('additional references do not introduce a seven-day minimum or change existing evaluation thresholds', () => {
  for (const id of reviewedIds) {
    const guidance = resolveDurationGuidance(options(id));
    assert.ok(guidance.sourceReview, id);
    const withoutReview = { ...guidance };
    delete withoutReview.sourceReview;
    for (const days of [3, 5, 7, 10, 14, 15]) {
      assert.deepEqual(assessDuration(days, guidance), assessDuration(days, withoutReview), id);
      assert.equal(durationResultWarning(days, guidance), durationResultWarning(days, withoutReview), id);
    }
  }
  for (const id of reviewedIds.filter(value => value.startsWith('dental-augmentin') || value.startsWith('dental-dalacin'))) {
    const guidance = resolveDurationGuidance(options(id));
    assert.equal(guidance.rule.minimum, null, id);
    assert.equal(guidance.rule.maximum, null, id);
    assert.equal(assessDuration(3, guidance).state, 'unassessed', id);
    assert.equal(assessDuration(5, guidance).state, 'unassessed', id);
    if (id.startsWith('dental-augmentin')) {
      assert.equal(guidance.rule.reviewAfterDays, 14);
      assert.equal(assessDuration(15, guidance).state, 'review');
    }
  }
  const amoxicillin = resolveDurationGuidance(options('dental-ospamox-suspension-ge40-q8'));
  assert.equal(amoxicillin.rule.minimum, 3);
  assert.equal(amoxicillin.rule.maximum, 5);
  for (const id of ['metronidazole-periodontal', 'metronidazole-ulcerative-gingivitis']) {
    const guidance = resolveDurationGuidance(options(id));
    assert.equal(guidance.rule.minimum, 7, 'The existing local topical range is not removed');
    assert.equal(guidance.rule.maximum, 10);
  }
});

test('the source-review disclosure contains its actual check date and escapes source labels and notes', () => {
  const guidance = resolveDurationGuidance(options('dental-augmentin-tablet-875-125-ge40'));
  const html = markup(guidance);
  assert.ok(html.indexOf('class="duration-source-review"') > html.indexOf('<details class="duration-sources"'));
  assert.match(html, /Sprawdzono dodatkowe źródła:/);
  assert.ok(html.includes(guidance.sourceReview.checkedAt));
  const unsafe = {
    ...guidance,
    sourceReview: { checkedAt: '2026-11-18', entries: [{
      label: '<script>label</script>', url: 'https://example.org/source?a=1&b=2',
      note: '<img src=x onerror="alert(1)"> & source note',
    }] },
  };
  const escaped = markup(unsafe);
  assert.doesNotMatch(escaped, /<script>|<img src=x/);
  assert.match(escaped, /&lt;script&gt;label&lt;\/script&gt;/);
  assert.match(escaped, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; source note/);
  assert.match(escaped, /href="https:\/\/example\.org\/source\?a=1&amp;b=2"/);
});

test('review resolution and rendering preserve dose, frequency, selected days and confirmation state', () => {
  const scenario = options('dental-augmentin-suspension-adult-substitution', {
    dose: 875, frequency: 2, days: 7, confirmed: false, roundingReviewed: false,
  });
  const before = structuredClone(scenario);
  const guidance = resolveDurationGuidance(scenario);
  const guidanceBefore = structuredClone(guidance);
  const html = markup(guidance, scenario.context.days);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  assert.match(html, /data-value="7" aria-pressed="true"/);
  assert.deepEqual(scenario, before);
  assert.deepEqual(guidance, guidanceBefore);
  const blank = options('dental-augmentin-tablet-500-125-ge40', { days: '' });
  const blankBefore = structuredClone(blank);
  const pending = resolveDurationGuidance(blank);
  assert.doesNotMatch(markup(pending), /aria-pressed="true"/);
  assert.deepEqual(blank, blankBefore);
});

test('the imported review module ships in the build, offline cache and identical public mirror', async () => {
  const file = 'duration-source-review.js';
  const original = await readFile(new URL(file, import.meta.url), 'utf8');
  const mirror = await readFile(new URL(`../public/rxcalc/${file}`, import.meta.url), 'utf8');
  assert.equal(mirror, original, 'Published source-review metadata must match the evaluated module');
  for (const manifest of ['build.mjs', 'sw.js']) {
    const source = await readFile(new URL(manifest, import.meta.url), 'utf8');
    assert.ok(source.includes(`'${file}'`), `${manifest} must include the required imported module`);
  }
});
