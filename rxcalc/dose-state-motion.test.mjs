import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { LIQUID_STARTER_REGIMENS } from './liquid-starters.js';
import { resolveHumanRegimen } from './human-regimen-engine.js';
import { automaticRoundingStep, assessDoseRounding, resolveRoundingRegimen, roundingValidationSource } from './rounding-assessment.js';
import { ingredientDailyDose } from './daily-dose.js';
import { dailyDoseMarkup, dailyDoseMotionContext } from './dose-safety-view.js';

const drug = DRUGS.find(item => item.id === 'amoxicillin-clavulanate');
const form = drug.forms.find(item => item.id === 'augmentin-400-57');
const source = LIQUID_STARTER_REGIMENS.find(item => item.id === 'dental-augmentin-suspension-adult-substitution');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

// Reproduce the app's actual source → rounding → arithmetic → markup path.
// In particular, never hardcode ceilingKind or pass the unadjusted source to
// ingredientDailyDose: either shortcut would hide the reported state change.
function preview(frequency) {
  const context = { patientKind:'human', formId:form.id, specialty:'dental', patientType:'adult',
    doseMode:'fixed', dose:875, frequency, days:7, weight:70, age:35, ageUnit:'years',
    renalStatus:'normal', crcl:90, roundingMode:'auto' };
  context.roundingStep = automaticRoundingStep({ form, source, context });
  const options = { form, source, context, limits:{ daily:null, single:null } };
  const roundingAssessment = assessDoseRounding(options);
  const sourceCheck = resolveRoundingRegimen(options, { allowNumericOverrides:true });
  assert.equal(sourceCheck.valid, true, sourceCheck.errors.join(' '));
  const input = { ...form, ...context, form:form.form, packageSize:35,
    maxSingleMg:sourceCheck.maxSingleMg, maxDailyMg:sourceCheck.maxDailyMg };
  const note = ingredientDailyDose({ form, drug, input,
    source:roundingValidationSource(source, roundingAssessment), sourceCheck,
    limit:{ daily:sourceCheck.maxDailyMg, single:sourceCheck.maxSingleMg, kind:'catalogue' } });
  const eligibility = resolveHumanRegimen(source, { ...context, dose:source.dose, frequency:source.frequency });
  const markup = dailyDoseMarkup({ note, input, source, eligibility, roundingAssessment,
    doseProblems:[...sourceCheck.errors, ...sourceCheck.warnings], modified:frequency !== source.frequency });
  const motionContext = dailyDoseMotionContext({ note, form, source, specialty:'dental', patientType:'adult', species:'dog' });
  return { context, input, roundingAssessment, sourceCheck, note, markup, motionContext };
}

test('Augmentin Auto 2→1→2 keeps both source comparisons while current numbers and tones change', () => {
  const before = structuredClone({ form, source });
  const states = [preview(2), preview(1), preview(2)];
  assert.deepEqual(states.map(value => value.context.roundingStep), [1, null, 1]);
  assert.deepEqual(states.map(value => value.roundingAssessment?.state ?? null), ['rule', null, 'rule']);
  assert.deepEqual(states.map(value => value.note.ceilingKind), [null, 'source', null]);

  for (const [index, value] of states.entries()) {
    const rounded = index !== 1;
    const amounts = rounded ? [1760, 250.8] : [875, 124.6875];
    for (const [ingredient, row] of value.note.rows.entries()) {
      close(row.daily, amounts[ingredient]);
      close(value.note.schemeRows[ingredient].maximum, ingredient === 0 ? 1750 : 249.375);
      assert.equal(value.note.schemeRows[ingredient].kind, 'fixed');
      assert.equal(value.note.schemeRows[ingredient].limit, null);
    }
    const amountsInMarkup = [...value.markup.matchAll(/<div class="dose-safety-amount[^\"]*"><strong>([^<]+) <span>mg\/dobę<\/span>/g)].map(match => match[1]);
    assert.deepEqual(amountsInMarkup, rounded ? ['1760', '250,8'] : ['875', '124,6875']);
    assert.equal((value.markup.match(rounded ? /class="dose-scheme-current rule[^\"]*"><b>100,57%/g
      : /class="dose-scheme-current below[^\"]*"><b>50%/g) || []).length, 2);
    assert.equal((value.markup.match(rounded ? /class="dose-scheme-meter\s+rule\s*"/g
      : /class="dose-scheme-meter\s+below\s*"/g) || []).length, 2);
    const fills = [...value.markup.matchAll(/class="dose-scheme-fill" style="width:([\d.]+)%"/g)];
    assert.equal(fills.length, 2);
    for (const fill of fills) close(Number(fill[1]), rounded ? 1760 / 1750 * 80 : 40);
  }

  // This equality is the regression gate: previously null → source discarded
  // the old geometry even though the source, units and endpoints stayed equal.
  assert.equal(states[1].motionContext, states[0].motionContext);
  assert.equal(states[2].motionContext, states[1].motionContext);
  assert.deepEqual({ form, source }, before);
});

test('a bare limit meter still distinguishes catalogue and clinician-entered limit identities', () => {
  const { input } = preview(1);
  const contexts = ['catalogue', 'manual'].map(kind => {
    const note = ingredientDailyDose({ form, drug, input, source:null, limit:{ daily:2000, kind } });
    assert.equal(note.schemeRows, null);
    assert.equal(note.ceilingKind, kind);
    assert.ok(note.rows.every(row => row.ceiling > 0));
    return dailyDoseMotionContext({ note, form, source:null, specialty:'dental', patientType:'adult', species:'dog' });
  });
  assert.notEqual(contexts[0], contexts[1]);
});
