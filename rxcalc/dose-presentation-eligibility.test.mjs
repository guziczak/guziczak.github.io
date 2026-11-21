import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { resolveHumanRegimen } from './human-regimen-engine.js';
import { ingredientDailyDose } from './daily-dose.js';
import { dailyDoseMarkup, dailyDoseMotionContext, dailyDosePresentationModel } from './dose-safety-view.js';
import { regimenMeterModel, regimenPercentModel } from './dose-regimen.js';
import { renalRegimenContext } from './renal-state.js';

const source = HUMAN_REGIMENS.find(item => item.id === 'cardio-eliquis-nvaf-standard');
const drug = DRUGS.find(item => item.forms.some(form => form.id === 'eliquis-5'));
const form = drug.forms.find(item => item.id === 'eliquis-5');
const context = {
  formId:form.id, specialty:'cardio', patientType:'adult', age:70, ageUnit:'years',
  weight:75, serumCreatinine:1.1, crcl:80, renalStatus:'unknown',
  dose:5, frequency:2, days:30,
  sourceConfirmations:source.selectionRequirements.map(item => item.id),
};

function preview(updates = {}, {limit=null} = {}) {
  const current = {...context, ...updates};
  const sourceCheck = resolveHumanRegimen(source, current);
  // The application checks the patient against source values separately from
  // the entered quantity. Excess must remain visible even when it is invalid.
  const eligibility = resolveHumanRegimen(source, {...current,
    dose:source.dose, frequency:source.frequency, days:source.fixedDays || source.minDays || 1});
  const input = {...form, ...current, patientKind:'human', doseMode:'fixed',
    packageSize:form.packOptions[0].quantity, roundingStep:null,
    maxDailyMg:sourceCheck.maxDailyMg, maxSingleMg:sourceCheck.maxSingleMg};
  const note = ingredientDailyDose({form, drug, input, source, sourceCheck,
    limit:limit || {daily:sourceCheck.maxDailyMg, kind:'catalogue'}});
  const args = {note, input, source, eligibility, doseProblems:sourceCheck.errors};
  const presentation = dailyDosePresentationModel({source, eligibility, comparisonEligibility:note.comparisonEligibility});
  return {...args, sourceCheck, presentation, markup:dailyDoseMarkup(args),
    motionContext:dailyDoseMotionContext({note, form, source, specialty:'cardio', patientType:'adult'})};
}

test('apixaban 10/10 without assessed CrCl keeps neutral 100% and one actionable missing-data message', () => {
  const value = preview({crcl:null});
  assert.equal(value.eligibility.valid, false);
  assert.equal(value.note.rows[0].daily, 10);
  assert.equal(value.note.schemeRows[0].maximum, 10);
  assert.equal(value.presentation.state, 'missing');
  assert.equal(value.presentation.neutral, true);
  assert.equal(value.presentation.clinicalConfirmed, false);
  assert.equal(value.presentation.comparisonAllowed, true);
  assert.equal(regimenPercentModel(value.note.rows[0], value.note.schemeRows[0]).current, 100);
  assert.match(value.markup, /dose-scheme-current same neutral[^>]*><b>100%/);
  assert.match(value.markup, /class="dose-scheme-fill" style="width:80%"/);
  assert.match(value.markup, /dose-clinical-status missing/);
  assert.equal((value.markup.match(/data-action="complete-patient-data"/g) || []).length, 1);
  assert.match(value.markup, /data-focus-field="crcl"/);
  assert.match(value.markup, /Do uzupełnienia: CrCl \(ml\/min\)\./);
  assert.doesNotMatch(value.markup, /Taka sama ilość dobowa jak w schemacie|Dobowo w zakresie|Warunki porównania niepotwierdzone/);
  // Both validators may retain their messages for export; neither should be
  // repeated as a second dose-error card beside the compact patient status.
  assert.doesNotMatch(value.markup, /class="dose-safety-notice"/);
  for (const error of value.eligibility.errors) assert.ok(!value.markup.includes(error));
});

test('complete valid patient data restores the ordinary display without changing the numeric geometry', () => {
  const missing = preview({crcl:null}), complete = preview();
  assert.equal(complete.eligibility.valid, true, complete.eligibility.errors.join(' '));
  assert.equal(complete.presentation.neutral, false);
  assert.equal(complete.presentation.state, 'confirmed');
  assert.match(complete.markup, /dose-scheme-current same[^>]*><b>100%/);
  assert.match(complete.markup, /Taka sama ilość dobowa jak w schemacie/);
  assert.doesNotMatch(complete.markup, /dose-clinical-status|complete-patient-data| same neutral/);
  assert.equal(missing.motionContext, complete.motionContext);
  assert.deepEqual(regimenMeterModel(missing.note.rows[0], missing.note.schemeRows[0]),
    regimenMeterModel(complete.note.rows[0], complete.note.schemeRows[0]));
});

test('a missing dose never becomes zero percent or a fabricated fill despite a known source', () => {
  const value = preview({dose:null, crcl:null});
  assert.equal(value.note.dailyUnits, null);
  assert.equal(value.note.rows[0].daily, null);
  assert.equal(value.note.schemeRows[0].maximum, 10);
  assert.match(value.markup, /<strong>— <span>mg\/dobę/);
  assert.doesNotMatch(value.markup, /class="dose-scheme-fill"|class="dose-scheme-current/);
  assert.equal((value.markup.match(/data-action="complete-patient-data"/g) || []).length, 1);
});

test('a missing denominator is not replaced by an invented reference or a progress fill', () => {
  const value = preview();
  const note = {...value.note, schemeRows:null, ceilingKind:null,
    rows:value.note.rows.map(row => ({...row, ceiling:null, ceilingPerKg:null}))};
  const markup = dailyDoseMarkup({note, input:value.input, source:null});
  assert.match(markup, /10 <span>mg\/dobę/);
  assert.doesNotMatch(markup, /class="dose-(?:scheme|safety)-fill"|% granicy|dose-scheme-current/);
});

test('invalid and out-of-scope renal states remain distinct while the known arithmetic stays visible', () => {
  for (const [crcl, state] of [[-1, 'invalid'], [10, 'out-of-scope']]) {
    const value = preview({crcl});
    assert.equal(value.eligibility.valid, false);
    assert.equal(value.presentation.state, state);
    assert.match(value.markup, new RegExp(`dose-clinical-status ${state}`));
    assert.match(value.markup, /dose-scheme-current same neutral[^>]*><b>100%/);
    assert.doesNotMatch(value.markup, /Taka sama ilość dobowa jak w schemacie/);
    if (state === 'invalid') assert.match(value.markup, /data-focus-field="crcl"/);
    else assert.match(value.markup, /Dane pacjenta poza zakresem schematu/);
  }
});

test('numeric excess and a tighter real limit remain explicit before clinical qualification is complete', () => {
  const excess = preview({dose:10, crcl:null});
  assert.equal(excess.sourceCheck.valid, false);
  assert.match(excess.markup, /dose-scheme-current above neutral[^>]*><b>200%/);
  assert.match(excess.markup, /Powyżej dawki dobowej schematu o 100%/);
  assert.match(excess.markup, /Dawka różni się od stałej dawki tego schematu przeciwkrzepliwego/);
  const manual = preview({crcl:null}, {limit:{daily:8, kind:'manual'}});
  assert.match(manual.markup, /dose-scheme-meter[^>]*neutral limit-exceeded/);
  assert.match(manual.markup, /Przekroczony dodatkowy limit/);
  assert.match(manual.markup, /Limit wpisany przez lekarza/);
  assert.equal(manual.note.schemeRows[0].maximum, 10);
});

test('structured issue kinds and fields, not message wording, determine missing-data deduplication', () => {
  const errors = ['Renal assessment is absent.', 'A second validator needs the same value.'];
  const eligibility = {valid:false, errors, issues:errors.map((message, index) => ({
    code:`renal-${index}`, field:'crcl', kind:'missing', message,
  }))};
  const value = dailyDosePresentationModel({source, eligibility});
  assert.equal(value.state, 'missing');
  assert.equal(value.issues.length, 1);
  assert.equal(value.focusField, 'crcl');
  const current = preview();
  const markup = dailyDoseMarkup({...current, eligibility, doseProblems:errors});
  assert.match(markup, /Do uzupełnienia: CrCl \(ml\/min\)\./);
  assert.doesNotMatch(markup, /Renal assessment|second validator|class="dose-safety-notice"/);
});

test('the real unconfirmed CrCl calculation exposes its missing inputs once instead of asking for manual CrCl', () => {
  const renal = renalRegimenContext({renalInputMode:'calculate', humanCrCl:'90',
    humanSerumCreatinine:'88,4', renalCreatinineUnit:'umol/l', age:'70', humanAgeUnit:'years',
    weight:'75', renalSex:'', renalCalculationWeight:'', renalCalculationReviewed:false}, source);
  assert.equal(renal.crcl, null);
  const value = preview(renal);
  assert.equal(value.eligibility.valid, false);
  assert.equal(value.presentation.state, 'missing');
  assert.match(value.markup, /dose-scheme-current same neutral[^>]*><b>100%/);
  assert.match(value.markup, /data-focus-field="sex"/);
  assert.equal((value.markup.match(/warunki oszacowania CrCl/g) || []).length, 1);
  assert.equal((value.markup.match(/data-action="complete-patient-data"/g) || []).length, 1);
  assert.doesNotMatch(value.markup, /Uzupełnij oceniony|Podaj oceniony|Do uzupełnienia: CrCl/);
});

test('clinical presentation does not change validation, mutate data or reinterpret veterinary eligibility', () => {
  const value = preview({crcl:null});
  const args = {note:value.note, source, input:value.input, eligibility:value.eligibility};
  const before = structuredClone(args);
  dailyDoseMarkup(args);
  assert.deepEqual(args, before);
  assert.equal(value.sourceCheck.valid, false);
  const veterinary = dailyDosePresentationModel({source, veterinary:true, eligibility:{valid:false,
    errors:['Masa poza zakresem schematu.']}, comparisonEligibility:{valid:false, errors:[]}});
  assert.equal(veterinary.neutral, false);
  assert.equal(veterinary.comparisonAllowed, false);
  const malicious = dailyDoseMarkup({...args, eligibility:{valid:false, errors:['<img src=x onerror=alert(1)>'],
    issues:[{code:'invalid', field:'crcl', kind:'invalid', message:'<img src=x onerror=alert(1)>'}]}});
  assert.doesNotMatch(malicious, /<img/);
  assert.match(malicious, /&lt;img/);
});

test('missing numeric inputs are completed before confirmations invalidated by those edits', () => {
  const issues = [
    {code:'confirm',field:'sourceConfirmations',kind:'missing',message:'Confirm source.'},
    {code:'review',field:'renalStable',kind:'missing',message:'Review estimate.'},
    {code:'creatinine',field:'serumCreatinine',kind:'missing',message:'Enter creatinine.'},
  ];
  const presentation = dailyDosePresentationModel({source,eligibility:{valid:false,issues,errors:issues.map(issue=>issue.message)}});
  assert.equal(presentation.focusField,'serumCreatinine');
  assert.deepEqual(presentation.issues.map(issue=>issue.field),['serumCreatinine','renalStable','sourceConfirmations']);
});
