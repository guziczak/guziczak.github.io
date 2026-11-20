import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDIO_FENTANYL_DRUGS, FENTANYL_SINGLE_DOSE_SOURCES as sources } from './cardio-fentanyl.js';
import { availableSingleDoseSources, resolveSingleDose, buildSingleDoseText } from './single-dose.js';
import { calculate } from './engine.js';
import { supportsDailyDose } from './daily-dose.js';
import { supportsDecimalRounding } from './decimal-rounding.js';
import { singleDoseRegimenMarkup, singleDoseResultMarkup, updateSingleDoseView } from './single-dose-view.js';

const drug = CARDIO_FENTANYL_DRUGS.find(item => item.id === 'fentanyl');
const form = drug.forms.find(item => item.id === 'fentanyl-wzf-50');
const initial = sources.find(item => item.id === 'cardio-fentanyl-initial');
const additional = sources.find(item => item.id === 'cardio-fentanyl-additional');
const contextFor = (source = initial, overrides = {}) => ({
  formId:form.id, specialty:'cardio', patientType:'adult', age:35, ageUnit:'years',
  doseMicrograms:100, packId:'10x2ml',
  sourceConfirmations:source.selectionRequirements.map(item => item.id),
  ...overrides,
});
const resolve = (overrides = {}, source = initial) => resolveSingleDose(form, source, contextFor(source, overrides));

test('the exact formulation uses 50 micrograms/ml and keeps ampoule size separate from carton contents', () => {
  assert.equal(form.calculationMode, 'single-dose');
  assert.equal(form.concentrationMicrogramsPerMl, 50);
  assert.equal(form.doseUnit, 'microgram');
  assert.equal(form.unitLabel, 'ml');
  assert.equal(form.routeCode, 'iv');
  assert.deepEqual(form.packOptions.map(pack => [pack.id, pack.containerMl, pack.containersPerPack, pack.quantity]), [
    ['10x2ml', 2, 10, 20], ['50x2ml', 2, 50, 100],
    ['10x10ml', 10, 10, 100], ['50x10ml', 10, 50, 500],
  ]);
  assert.equal(new Set(sources.map(source => source.id)).size, sources.length);
  for (const source of sources) {
    assert.deepEqual(source.formIds, ['fentanyl-wzf-50']);
    assert.deepEqual(source.patientTypes, ['adult']);
    assert.equal(source.minAgeMonths, 216);
    for (const key of ['dose', 'doseMicrograms', 'frequency', 'frequencyOptions', 'days', 'fixedDays', 'minDays', 'maxDays', 'maxDailyMg']) {
      assert.equal(Object.hasOwn(source, key), false, `${source.id} must not supply ${key}`);
    }
  }
});

test('a source and a typed microgram dose are explicit choices, never inferred from a product or legacy mg field', () => {
  assert.deepEqual(availableSingleDoseSources(sources, {}), []);
  // Patient inputs appear after the source selector. Listing scoped choices
  // must not require a completed dose or age; resolving them still does.
  const candidates = availableSingleDoseSources(sources, { formId:form.id, specialty:'cardio', patientType:'adult' });
  assert.deepEqual(candidates.map(source => source.id).sort(), sources.map(source => source.id).sort());
  assert.equal(resolveSingleDose(form, null, contextFor()).valid, false);
  for (const doseMicrograms of [undefined, null, '']) {
    const context = contextFor(initial, { doseMicrograms, dose:100, frequency:2, days:7 });
    const result = resolveSingleDose(form, initial, context);
    assert.equal(result.valid, false);
    assert.equal(result.volumeMl, null);
    assert.equal(result.doseMicrograms, null);
    assert.equal(buildSingleDoseText(drug, form, initial, result, context), '');
  }
});

test('legacy daily-dose, course and decimal-rounding paths cannot reinterpret the microgram formulation', () => {
  assert.equal(supportsDailyDose(form), false);
  assert.equal(supportsDecimalRounding(form, initial), false);
  for (const doseMode of ['fixed', 'units']) {
    const result = calculate({ ...form, patientKind:'human', doseMode, dose:1,
      frequency:1, days:1, weight:70, age:35, packageSize:20,
      concentrationMg:50, concentrationMl:1 });
    assert.equal(result.valid, false);
    assert.equal(result.singleMg, null);
    assert.equal(result.singleUnits, null);
    assert.equal(result.dailyMg, null);
    assert.equal(result.packages, null);
    assert.ok(result.errors.some(error => /pojedynczego podania/.test(error)));
  }
});

test('50, 100 and 200 micrograms yield exactly 1, 2 and 4 ml without a thousandfold mg conversion', () => {
  for (const [doseMicrograms, volumeMl] of [[50, 1], [100, 2], [200, 4]]) {
    const result = resolve({ doseMicrograms });
    assert.equal(result.valid, true, result.errors.join(' '));
    assert.equal(result.status, 'ok');
    assert.equal(result.doseMicrograms, doseMicrograms);
    assert.equal(result.activeDrugMicrograms, doseMicrograms);
    assert.equal(result.volumeMl, volumeMl);
    assert.equal(result.concentrationMicrogramsPerMl, 50);
    assert.equal(result.containerMl, 2);
    assert.equal(result.containerMicrograms, 100);
  }
});

test('a 200 microgram administration needs two 2 ml ampoules or one 10 ml ampoule with 6 ml discarded', () => {
  for (const packId of ['10x2ml', '50x2ml']) {
    const result = resolve({ doseMicrograms:200, packId });
    assert.equal(result.valid, true, result.errors.join(' '));
    assert.equal(result.volumeMl, 4);
    assert.equal(result.containersNeeded, 2);
    assert.equal(result.volumeWasteMl, 0);
    assert.equal(result.containerMicrograms, 100);
  }
  for (const packId of ['10x10ml', '50x10ml']) {
    const result = resolve({ doseMicrograms:200, packId });
    assert.equal(result.valid, true, result.errors.join(' '));
    assert.equal(result.volumeMl, 4);
    assert.equal(result.containersNeeded, 1);
    assert.equal(result.volumeWasteMl, 6);
    assert.equal(result.containerMicrograms, 500);
    assert.equal(result.activeDrugMicrograms, 200, 'the complete ampoule is not the administered dose');
  }
  const small = resolve({ doseMicrograms:50 });
  assert.equal(small.containersNeeded, 1);
  assert.equal(small.volumeWasteMl, 1);
});

test('adult scope requires the real age and does not inherit dental, veterinary or child eligibility', () => {
  for (const overrides of [
    { patientType:'child' }, { specialty:'dental' }, { specialty:'veterinary' },
    { formId:'metafen-paracetamol-500' }, { age:17.99 },
    { age:215.99, ageUnit:'months' }, { age:3650, ageUnit:'days' },
    { age:null }, { age:NaN }, { age:Infinity }, { age:'35' }, { ageUnit:'unknown' },
  ]) {
    const result = resolve(overrides);
    assert.equal(result.valid, false, JSON.stringify(overrides));
  }
  for (const overrides of [{ age:18 }, { age:216, ageUnit:'months' }]) {
    const result = resolve(overrides);
    assert.equal(result.valid, true, result.errors.join(' '));
  }
  for (const overrides of [{ patientType:'child' }, { specialty:'dental' }, { formId:'unknown' }]) {
    assert.deepEqual(availableSingleDoseSources(sources, contextFor(initial, overrides)), []);
  }
});

test('every declared clinical confirmation is required and unrelated confirmations cannot satisfy it', () => {
  assert.ok(initial.selectionRequirements.length >= 4);
  for (const source of sources) {
    assert.equal(new Set(source.selectionRequirements.map(item => item.id)).size, source.selectionRequirements.length);
    const doseMicrograms = source === additional ? 50 : 100;
    for (const requirement of source.selectionRequirements) {
      const context = contextFor(source, { doseMicrograms,
        sourceConfirmations:source.selectionRequirements.map(item => item.id).filter(id => id !== requirement.id).concat('another-form-confirmed'),
      });
      const result = resolveSingleDose(form, source, context);
      assert.equal(result.valid, false, `${source.id}: ${requirement.id}`);
      assert.equal(buildSingleDoseText(drug, form, source, result, context), '');
    }
  }
});

test('additional 50 micrograms is a separately selected ChPL phase requiring reassessment, with no repeat schedule', () => {
  assert.equal(initial.phase, 'initial');
  assert.equal(initial.minMicrograms, 50);
  assert.equal(initial.maxMicrograms, 200);
  assert.equal(additional.phase, 'additional');
  assert.equal(additional.referenceDoseMicrograms, 50);
  assert.equal(additional.maxMicrograms, 50);
  assert.ok(additional.selectionRequirements.some(item => item.id === 'fentanyl-additional-reassessment'));
  const result = resolve({ doseMicrograms:50 }, additional);
  assert.equal(result.valid, true, result.errors.join(' '));
  assert.equal(result.volumeMl, 1);
  assert.equal(result.sourceId, additional.id);
  assert.equal(resolve({ doseMicrograms:100 }, additional).valid, false);
  const initialOnly = contextFor(additional, { doseMicrograms:50,
    sourceConfirmations:initial.selectionRequirements.map(item => item.id) });
  assert.equal(resolveSingleDose(form, additional, initialOnly).valid, false);
});

test('a lower individual dose is a visible warning while amounts beyond this view scope cannot be exported', () => {
  for (const source of sources) {
    const context = contextFor(source, { doseMicrograms:25 });
    const result = resolveSingleDose(form, source, context);
    assert.equal(result.valid, true, result.errors.join(' '));
    assert.equal(result.status, 'warning');
    assert.ok(result.warnings.length > 0);
    assert.equal(result.volumeMl, 0.5);
    assert.ok(buildSingleDoseText(drug, form, source, result, context));
  }
  for (const [source, doseMicrograms] of [[initial, 200.01], [initial, 50000], [additional, 50.01]]) {
    const context = contextFor(source, { doseMicrograms });
    const result = resolveSingleDose(form, source, context);
    assert.equal(result.valid, false);
    assert.equal(result.status, 'critical');
    assert.equal(buildSingleDoseText(drug, form, source, result, context), '');
  }
});

test('invalid dose, concentration, pack or blocked formulation cannot produce an exportable administration', () => {
  for (const doseMicrograms of [0, -1, NaN, Infinity, -Infinity, '100', {}, []]) {
    const context = contextFor(initial, { doseMicrograms });
    const result = resolveSingleDose(form, initial, context);
    assert.equal(result.valid, false, String(doseMicrograms));
    assert.equal(result.volumeMl, null);
    assert.equal(buildSingleDoseText(drug, form, initial, result, context), '');
  }
  for (const concentrationMicrogramsPerMl of [0, -50, NaN, Infinity, '50']) {
    const invalid = { ...form, concentrationMicrogramsPerMl };
    assert.equal(resolveSingleDose(invalid, initial, contextFor()).valid, false);
  }
  for (const packId of [undefined, null, '', 'unknown', '2']) {
    assert.equal(resolve({ packId }).valid, false);
  }
  for (const overrides of [{ referenceOnly:true }, { calculationBlocked:true }, { routeCode:'im' }]) {
    assert.equal(resolveSingleDose({ ...form, ...overrides }, initial, contextFor()).valid, false);
  }
});

test('Rp. and D.S. preserve the concentration, microgram dose, ml volume and IV route for one administration', () => {
  const context = contextFor(initial, { doseMicrograms:100 });
  const result = resolveSingleDose(form, initial, context);
  const text = buildSingleDoseText(drug, form, initial, result, context);
  assert.match(text, /^Rp\. Fentanylum(?:\n|\s)/);
  assert.equal((text.match(/^Rp\./gm) || []).length, 1);
  assert.equal((text.match(/^D\.S\./gm) || []).length, 1);
  assert.match(text, /Fentanyl WZF/);
  assert.match(text, /50\s*(?:[µμ]g|mikrogramów)\s*\/\s*ml/);
  assert.match(text, /100\s*(?:[µμ]g|mikrogramów)/);
  assert.match(text, /2\s*ml/);
  assert.match(text, /dożyln|i\.v\./i);
  assert.doesNotMatch(text, /mg\/dobę|\d+\s*(?:razy? na dobę|dni)|przez\s+\d+/i);
  const ds = buildSingleDoseText(drug, form, initial, result, context, { mode:'ds' });
  assert.match(ds, /^D\.S\./);
  assert.doesNotMatch(ds, /^Rp\./m);
  assert.equal(text.slice(text.indexOf('D.S.')), ds, 'both modes must preserve the same administration instructions');
  assert.equal(buildSingleDoseText(drug, form, initial, result, context, { mode:'unknown' }), '');
  for (const key of ['frequency', 'days', 'dailyMg', 'dailyUnits', 'packages', 'totalUnits']) {
    assert.equal(Object.hasOwn(result, key), false, `single-administration output must not invent ${key}`);
  }
});

test('export revalidates dose, patient, source confirmations and selected ampoule instead of copying a stale result', () => {
  const context = contextFor();
  const result = resolveSingleDose(form, initial, context);
  assert.ok(buildSingleDoseText(drug, form, initial, result, context));
  for (const mode of ['full', 'ds']) {
    for (const overrides of [
      { doseMicrograms:200 }, { packId:'10x10ml' }, { age:17 }, { age:36 },
      { sourceConfirmations:[] }, { specialty:'dental' },
    ]) {
      assert.equal(buildSingleDoseText(drug, form, initial, result, { ...context, ...overrides }, { mode }), '', `${mode}: ${JSON.stringify(overrides)}`);
    }
    assert.equal(buildSingleDoseText(drug, form, additional, result, contextFor(additional, { doseMicrograms:50 }), { mode }), '');
    assert.equal(buildSingleDoseText(drug, { ...form, concentrationMicrogramsPerMl:500 }, initial, result, context, { mode }), '');
  }
});

test('resolution and text do not modify frozen source, formulation or patient inputs', () => {
  const freeze = value => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  const frozenForm = freeze(structuredClone(form));
  const frozenSource = freeze(structuredClone(initial));
  const context = freeze(contextFor());
  const before = JSON.stringify({ frozenForm, frozenSource, context });
  const first = resolveSingleDose(frozenForm, frozenSource, context);
  assert.equal(first.valid, true, first.errors.join(' '));
  assert.ok(buildSingleDoseText(drug, frozenForm, frozenSource, first, context));
  first.warnings.push('changed externally');
  assert.equal(resolveSingleDose(frozenForm, frozenSource, context).warnings.includes('changed externally'), false);
  assert.equal(JSON.stringify({ frozenForm, frozenSource, context }), before);
});

// Browser primitives only: the real updater decides displayed values and gates.
function viewFixture(context, source = initial) {
  const nodes = new Map();
  const querySelector = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      textContent:'', innerHTML:'', style:{}, classList:{ toggle() {} },
      setAttribute() {}, querySelector,
    });
    return nodes.get(selector);
  };
  const result = resolveSingleDose(form, source, context);
  let text;
  const update = (rxMode = 'full') => {
    text = buildSingleDoseText(drug, form, source, result, context, { mode:rxMode });
    updateSingleDoseView({ querySelector }, { form, source, context, result,
      confirmed:true, demo:false, text, rxMode });
  };
  update();
  return { result, get text() { return text; }, node:querySelector, update };
}

test('result markup exposes normal Rp./D.S. tabs and basket controls, and live mode changes update copy labels and content', () => {
  const fixture = viewFixture(contextFor());
  const fullText = fixture.text;
  for (const mode of ['full', 'ds', 'full']) {
    const markup = singleDoseResultMarkup({ form, state:{ rxMode:mode, packageId:'10x2ml', confirmed:false }, icon:() => '' });
    const tabs = [...markup.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)].map(([, attributes, label]) => ({
      ...Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value])), label,
    })).filter(button => button['data-action'] === 'rx-mode');
    assert.equal(tabs.length, 2);
    assert.equal(tabs.find(tab => tab['data-value'] === mode)['aria-pressed'], 'true');
    assert.equal(tabs.find(tab => tab['data-value'] !== mode)['aria-pressed'], 'false');
    assert.equal(tabs.find(tab => tab['data-value'] === 'full').label, 'Rp. + D.S.');
    assert.equal(tabs.find(tab => tab['data-value'] === 'ds').label, 'Zalecenia');
    assert.match(markup, /id="cart-add"[^>]*data-action="cart-add"[^>]*disabled/);
    assert.match(markup, /id="cart-editing-note"/);
    assert.doesNotMatch(markup, /id="(?:frequency|days)"/);
    fixture.update(mode);
    assert.equal(fixture.node('#copy-button').innerHTML, mode === 'ds' ? 'Kopiuj zalecenia' : 'Kopiuj zapis');
    assert.equal(fixture.node('#copy-button').disabled, false);
    assert.equal(fixture.node('#rx-preview').textContent, fixture.text);
    if (mode === 'full') assert.equal(fixture.text, fullText);
    else {
      assert.match(fixture.text, /^D\.S\./);
      assert.doesNotMatch(fixture.text, /^Rp\./m);
    }
  }
});

test('an inherited age of 17 leaves the source and patient controls accessible, but copying waits for an eligible age', () => {
  const childAge = contextFor(initial, { age:17 });
  const adultAge = { ...childAge, age:35 };
  const choices = availableSingleDoseSources(sources, childAge);
  assert.deepEqual(choices.map(source => source.id), availableSingleDoseSources(sources, adultAge).map(source => source.id));
  assert.equal(choices.length, 2, 'an invalid retained age must not remove the selector before it can be corrected');
  const markup = singleDoseRegimenMarkup({
    form, source:null, choices, state:{ doseMicrograms:'' },
    patientMarkup:'<input id="age" value="17">', conditionsMarkup:'', icon:() => '', field:() => '',
  });
  assert.match(markup, /id="regimenId"/);
  assert.match(markup, /id="age"/);
  assert.doesNotMatch(markup, /id="doseMicrograms"/, 'no dose is selected or exposed before the source');
  const blocked = viewFixture(childAge);
  assert.equal(blocked.result.valid, false);
  assert.equal(blocked.text, '');
  assert.equal(blocked.node('#copy-button').disabled, true);
  assert.equal(blocked.node('#mobile-copy').disabled, true);
  const eligible = viewFixture(adultAge);
  assert.equal(eligible.result.valid, true);
  assert.ok(eligible.text);
  assert.equal(eligible.node('#copy-button').disabled, false);
  assert.equal(eligible.node('#mobile-copy').disabled, false);
});

test('a tiny positive entered amount remains positive in the real UI and export instead of rounding to zero', () => {
  const fixture = viewFixture(contextFor(initial, { doseMicrograms:1e-9 }));
  assert.equal(fixture.result.valid, true, fixture.result.errors.join(' '));
  assert.equal(fixture.result.status, 'warning');
  assert.equal(fixture.result.volumeMl, 2e-11);
  const displayedVolume = Number(fixture.node('#single-dose-value').textContent.replace(',', '.').replace('−', '-'));
  assert.equal(displayedVolume, 2e-11);
  const exportedVolume = /\((\S+) ml nierozcieńczonego/.exec(fixture.text)?.[1];
  assert.equal(Number(exportedVolume?.replace(',', '.').replace('−', '-')), 2e-11);
  assert.doesNotMatch(fixture.node('#single-dose-current').textContent, /^0\s*µg$/);
});
