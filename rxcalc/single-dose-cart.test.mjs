import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { FENTANYL_SINGLE_DOSE_SOURCES } from './cardio-fentanyl.js';
import { resolveSingleDose, buildSingleDoseText } from './single-dose.js';
import { resolveHumanRegimen } from './human-regimen-engine.js';
import { calculate } from './engine.js';
import { prescriptionHeader, prescriptionText, humanDosingText } from './dental-output.js';
import { createPrescriptionCart, savePrescriptionItem, prescriptionCartText,
  preparePrescriptionEdit, assessPrescriptionCart } from './prescription-cart.js';
import { prescriptionCartMarkup } from './prescription-tools-view.js';

const patient = { specialty:'cardio', patientType:'adult', age:'35', weight:'76',
  humanAgeUnit:'years', renalStatus:'unknown', humanCrCl:'', humanSerumCreatinine:'',
  species:'', vetAgeUnit:'years', foodChainStatus:'unknown' };
const numeric = value => Number(String(value).replace(',', '.'));
const fentanylDrug = DRUGS.find(drug => drug.id === 'fentanyl');
const fentanylForm = fentanylDrug.forms.find(form => form.id === 'fentanyl-wzf-50');
const initial = FENTANYL_SINGLE_DOSE_SOURCES.find(source => source.id === 'cardio-fentanyl-initial');
const additional = FENTANYL_SINGLE_DOSE_SOURCES.find(source => source.id === 'cardio-fentanyl-additional');

function fentanyl({ person = patient, source = initial, doseMicrograms = 200, packId = '10x2ml',
  confirmed = true, sourceConfirmations = source.selectionRequirements.map(item => item.id) } = {}) {
  const context = { formId:fentanylForm.id, specialty:person.specialty,
    patientType:person.patientType, age:numeric(person.age), ageUnit:person.humanAgeUnit,
    doseMicrograms, packId, sourceConfirmations };
  const result = resolveSingleDose(fentanylForm, source, context);
  const texts = Object.fromEntries(['full', 'ds'].map(mode => [mode,
    buildSingleDoseText(fentanylDrug, fentanylForm, source, result, context, { mode })]));
  return { valid:result.valid, confirmed, demo:false, label:fentanylForm.label, texts, result, context,
    snapshot:{ ...person, drugId:fentanylDrug.id, formId:fentanylForm.id, packageId:packId,
      regimenId:source.id, doseMicrograms:String(doseMicrograms), dose:'', doseMode:'fixed',
      frequency:'', days:'', sourceConfirmations:[...sourceConfirmations],
      confirmed, demo:false, rxMode:'full', roundingMode:'off' } };
}

function atoris(person = patient) {
  const drug = DRUGS.find(item => item.id === 'atorvastatin');
  const form = drug.forms.find(item => item.id === 'atoris-10');
  const pack = form.packOptions.find(item => item.id === '30');
  const source = HUMAN_REGIMENS.find(item => item.id === 'cardio-atoris-hypercholesterolaemia-initial');
  const sourceConfirmations = source.selectionRequirements.map(item => item.id);
  const context = { formId:form.id, specialty:'cardio', patientType:person.patientType,
    age:numeric(person.age), ageUnit:person.humanAgeUnit, weight:numeric(person.weight),
    dose:10, frequency:1, days:30, sourceConfirmations };
  const sourceCheck = resolveHumanRegimen(source, context);
  assert.equal(sourceCheck.valid, true, sourceCheck.errors.join(' '));
  const result = calculate({ ...form, ...context, patientKind:'human', doseMode:'fixed',
    maxDailyMg:source.maxDailyMg, packageSize:pack.quantity });
  assert.equal(result.valid, true, result.errors.join(' '));
  const header = prescriptionHeader({ form, name:`${drug.substance}\n${form.label}`, pack, packages:result.packages });
  const dosing = humanDosingText({ source, amount:'1 tabl.', route:form.routeLabel, frequency:1, days:30 });
  return { valid:true, confirmed:true, demo:false, label:form.label,
    texts:Object.fromEntries(['full', 'ds'].map(mode => [mode, prescriptionText({ mode, header, dosing, source })])),
    snapshot:{ ...person, drugId:drug.id, formId:form.id, packageId:pack.id, regimenId:source.id,
      dose:'10', doseMode:'fixed', doseMicrograms:'', frequency:'1', days:'30',
      sourceConfirmations, confirmed:true, demo:false } };
}

function add(cart, draft, options) {
  const saved = savePrescriptionItem(cart, draft, options);
  assert.equal(saved.ok, true, saved.message);
  return saved.cart;
}

function mixedCart(fentanylOptions) {
  const tablet = atoris(), injection = fentanyl(fentanylOptions);
  const cart = add(add(createPrescriptionCart(), tablet), injection);
  return { cart, tablet, injection };
}

test('mixed copy-all keeps two complete Rp./D.S. blocks and the exact selected full or advice mode', () => {
  const { cart, tablet, injection } = mixedCart();
  const full = prescriptionCartText(cart, patient);
  assert.equal(full.ok, true);
  assert.equal(full.text, `${tablet.texts.full}\n\n${injection.texts.full}`);
  assert.equal((full.text.match(/^Rp\./gm) || []).length, 2);
  assert.equal((full.text.match(/^D\.S\./gm) || []).length, 2);
  assert.match(injection.texts.full, /^Rp\. Fentanylum\n/);
  assert.match(tablet.texts.full, /^Rp\. Atorvastatinum\n/);
  const advice = prescriptionCartText(cart, patient, { mode:'ds' });
  assert.equal(advice.ok, true);
  assert.equal(advice.text, `${tablet.label}\n${tablet.texts.ds}\n\n${injection.label}\n${injection.texts.ds}`);
  assert.doesNotMatch(advice.text, /^Rp\./m);
  assert.equal((advice.text.match(/^D\.S\./gm) || []).length, 2);
  const markup = prescriptionCartMarkup({ items:cart.items, text:full.text, mode:'full', canCopy:full.ok });
  assert.match(markup, /data-action="cart-mode"[^>]*data-value="full"[^>]*>Rp\. \+ D\.S\.</);
  assert.match(markup, /data-action="cart-copy"/);
});

test('prescription quantity is the ampoules needed for one administration, independent of carton count', () => {
  const small = fentanyl({ doseMicrograms:200, packId:'10x2ml' });
  const smallLargeCarton = fentanyl({ doseMicrograms:200, packId:'50x2ml' });
  const large = fentanyl({ doseMicrograms:200, packId:'10x10ml' });
  const largeLargeCarton = fentanyl({ doseMicrograms:200, packId:'50x10ml' });
  assert.equal(small.texts.full, smallLargeCarton.texts.full);
  assert.equal(large.texts.full, largeLargeCarton.texts.full);
  for (const [entry, count, size] of [[small, 2, 2], [large, 1, 10]]) {
    const header = entry.texts.full.split(/^D\.S\./m)[0];
    assert.match(header, new RegExp(`^${count} amp\\. po ${size} ml — na pojedyncze podanie\\.$`, 'm'));
    assert.doesNotMatch(header, /\bop\.|10 amp\.|50 amp\./);
    assert.equal(entry.result.containersNeeded, count);
    assert.equal(entry.result.containerMl, size);
    assert.doesNotMatch(entry.texts.ds, /^Rp\.|^\d+ amp\. po/m);
  }
  assert.equal(large.result.volumeWasteMl, 6);
  assert.match(large.texts.ds, /Niewykorzystaną zawartość otwartych ampułek usunąć\./);
});

test('editing preserves micrograms, exact ampoule and source phase while requiring a fresh final confirmation', () => {
  for (const [source, doseMicrograms, packId] of [[initial, 200, '50x2ml'], [additional, 50, '50x10ml']]) {
    const { cart } = mixedCart({ source, doseMicrograms, packId });
    const item = cart.items[1];
    const edited = preparePrescriptionEdit(item, { ...patient, dose:'10', doseMicrograms:'9999',
      drugId:'atorvastatin', formId:'atoris-10', regimenId:'unrelated', packageId:'30' });
    assert.equal(edited.ok, true);
    assert.equal(edited.state.drugId, 'fentanyl');
    assert.equal(edited.state.formId, 'fentanyl-wzf-50');
    assert.equal(edited.state.doseMicrograms, String(doseMicrograms));
    assert.equal(edited.state.dose, '', 'micrograms must not be restored into the legacy mg field');
    assert.equal(edited.state.frequency, '');
    assert.equal(edited.state.days, '');
    assert.equal(edited.state.packageId, packId);
    assert.equal(edited.state.regimenId, source.id);
    assert.deepEqual(edited.state.sourceConfirmations, source.selectionRequirements.map(item => item.id));
    assert.equal(edited.state.confirmed, false);
    assert.equal(edited.state.demo, false);
    const restored = fentanyl({ person:edited.state, source,
      doseMicrograms:numeric(edited.state.doseMicrograms), packId:edited.state.packageId,
      sourceConfirmations:edited.state.sourceConfirmations, confirmed:edited.state.confirmed });
    assert.equal(restored.valid, true);
    assert.deepEqual(restored.texts, item.texts);
    assert.equal(savePrescriptionItem(cart, restored, { replaceId:item.id }).code, 'unreviewed');
  }
});

test('saving an edited ampoule replaces one row and leaves the other drug and original snapshot intact', () => {
  const { cart } = mixedCart();
  const item = cart.items[1];
  const changed = fentanyl({ doseMicrograms:100, packId:'10x10ml' });
  assert.equal(savePrescriptionItem(cart, changed).code, 'duplicate');
  const updated = add(cart, changed, { replaceId:item.id });
  assert.equal(updated.items.length, 2);
  assert.deepEqual(updated.items.map(item => item.id), cart.items.map(item => item.id));
  assert.equal(updated.nextId, cart.nextId);
  assert.equal(updated.items[0], cart.items[0]);
  assert.equal(updated.items[1].snapshot.packageId, '10x10ml');
  assert.equal(updated.items[1].snapshot.doseMicrograms, '100');
  assert.equal(updated.items[1].snapshot.regimenId, initial.id);
  assert.match(updated.items[1].texts.full, /^1 amp\. po 10 ml — na pojedyncze podanie\.$/m);
  assert.equal(changed.result.volumeWasteMl, 8);
  assert.match(updated.items[1].texts.ds, /Niewykorzystaną zawartość otwartych ampułek usunąć\./);
  assert.equal(cart.items[1].snapshot.packageId, '10x2ml');
  assert.equal(cart.items[1].snapshot.doseMicrograms, '200');
  assert.equal(prescriptionCartText(updated, patient).text, `${updated.items[0].texts.full}\n\n${changed.texts.full}`);
});

test('changed patient data block both cart modes and editing clears source confirmations until revalidation', () => {
  const { cart } = mixedCart();
  for (const patch of [{ age:'36' }, { weight:'77' }, { humanAgeUnit:'months' },
    { patientType:'child' }, { renalStatus:'impaired' }, { humanCrCl:'30' }]) {
    const current = { ...patient, ...patch };
    assert.deepEqual(assessPrescriptionCart(cart, current).staleIds, cart.items.map(item => item.id));
    for (const mode of ['full', 'ds']) {
      const output = prescriptionCartText(cart, current, { mode });
      assert.equal(output.ok, false);
      assert.equal(output.text, '');
    }
  }
  const current = { ...patient, age:'36' };
  const edit = preparePrescriptionEdit(cart.items[1], current);
  assert.equal(edit.ok, true);
  assert.equal(edit.state.age, '36');
  assert.equal(edit.state.doseMicrograms, '200');
  assert.equal(edit.state.packageId, '10x2ml');
  assert.equal(edit.state.regimenId, initial.id);
  assert.equal(edit.state.confirmed, false);
  assert.deepEqual(edit.state.sourceConfirmations, []);
  const unresolved = fentanyl({ person:edit.state, sourceConfirmations:edit.state.sourceConfirmations, confirmed:false });
  assert.equal(unresolved.valid, false);
  assert.equal(unresolved.texts.full, '');
  assert.equal(unresolved.texts.ds, '');
  assert.equal(savePrescriptionItem(cart, unresolved, { replaceId:cart.items[1].id }).ok, false);
  const refreshedFentanyl = add(cart, fentanyl({ person:current }), { replaceId:cart.items[1].id });
  assert.deepEqual(assessPrescriptionCart(refreshedFentanyl, current).staleIds, [cart.items[0].id]);
  assert.equal(prescriptionCartText(refreshedFentanyl, current).ok, false);
  const refreshedBoth = add(refreshedFentanyl, atoris(current), { replaceId:cart.items[0].id });
  assert.equal(prescriptionCartText(refreshedBoth, current).ok, true);
});

test('unsaved microgram or pack edits do not rewrite a reviewed cart entry or create false patient staleness', () => {
  const { cart } = mixedCart();
  const active = { ...patient, age:'35,0', weight:76, doseMicrograms:'50',
    packageId:'10x10ml', regimenId:additional.id, rxMode:'ds' };
  assert.equal(assessPrescriptionCart(cart, active).canCopy, true);
  for (const mode of ['full', 'ds']) {
    assert.equal(prescriptionCartText(cart, active, { mode }).text, prescriptionCartText(cart, patient, { mode }).text);
  }
  assert.equal(cart.items[1].snapshot.doseMicrograms, '200');
  assert.equal(cart.items[1].snapshot.packageId, '10x2ml');
  assert.equal(cart.items[1].snapshot.regimenId, initial.id);
});
