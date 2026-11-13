import test from 'node:test';
import assert from 'node:assert/strict';
import { DENTAL_TOPICAL_DRUGS, DENTAL_TOPICAL_FORM_PATCHES, DENTAL_TOPICAL_REGIMENS } from './dental-topicals.js';

const forms = DENTAL_TOPICAL_DRUGS.flatMap(drug => drug.forms);
const formById = id => forms.find(form => form.id === id);
const regimenById = id => DENTAL_TOPICAL_REGIMENS.find(regimen => regimen.id === id);

test('every source regimen is tied to an exact known dental form', () => {
  const ids = [...forms.map(form => form.id), ...DENTAL_TOPICAL_FORM_PATCHES.map(patch => patch.formId)];
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(DENTAL_TOPICAL_REGIMENS.map(regimen => regimen.id)).size, DENTAL_TOPICAL_REGIMENS.length);
  for (const regimen of DENTAL_TOPICAL_REGIMENS) {
    assert.deepEqual(regimen.specialties, ['dental']);
    assert.ok(regimen.formIds.length);
    for (const id of regimen.formIds) assert.ok(ids.includes(id), `${regimen.id} refers to unknown ${id}`);
    assert.equal(new URL(regimen.sourceUrl).protocol, 'https:');
    assert.ok(regimen.sourceSection);
    assert.ok(regimen.sourceCheckedAt);
  }
});

test('unmeasured mucosal applications cannot acquire invented gram doses or arithmetic package capacities', () => {
  for (const form of forms.filter(form => form.calculationMode === 'instruction')) {
    assert.equal(form.defaultDose, null, `${form.id}: default dose`);
    assert.equal(form.defaultFrequency, null, `${form.id}: default frequency`);
    assert.equal(form.defaultDays, null, `${form.id}: default course`);
    assert.equal(form.strengthMg, null, `${form.id}: quantitative conversion`);
    assert.equal(form.maxDailyMg, null, `${form.id}: universal mg ceiling`);
    assert.ok(form.packOptions.every(pack => pack.quantity === 1), `${form.id}: packages must be metadata only`);
    for (const regimen of DENTAL_TOPICAL_REGIMENS.filter(regimen => regimen.formIds.includes(form.id))) {
      assert.equal(regimen.doseMode, 'instruction');
      assert.equal(regimen.dose, undefined);
      assert.equal(regimen.doseRange, undefined);
      assert.ok(regimen.instructionText);
    }
  }
});

test('foreign, historical and insufficiently current references expose no executable regimen', () => {
  for (const form of forms.filter(form => form.referenceOnly)) {
    assert.equal(form.calculationMode, 'instruction');
    assert.equal(form.defaultDose, null);
    assert.equal(DENTAL_TOPICAL_REGIMENS.some(regimen => regimen.formIds.includes(form.id)), false, form.id);
    assert.match(form.marketStatusLabel, /niepotwierdz|do potwierdzenia|historyczn/);
  }
  assert.equal(formById('actisite-fibre-reference').packOptions[0].packageUnverified, true);
  assert.match(formById('dentomycin-gel-ie').marketStatusLabel, /Irlandia.*2022-12-07/);
});

test('topical products retain distinct medicinal, device and cosmetic classifications', () => {
  assert.equal(formById('eludril-care-rinse').productKind, 'cosmetic');
  assert.equal(formById('chlosite-025').productKind, 'device');
  assert.equal(formById('ligosan-periodontal-gel').productKind, 'medicine');
});

test('Dentinox source suggestion excludes infants needing unimplemented co-medication screening', () => {
  const regimen = regimenById('dentinox-teething');
  assert.equal(regimen.minAgeMonths, 12);
  assert.deepEqual(regimen.patientTypes, ['child']);
  assert.match(regimen.indication, /zębów mlecznych/);
  assert.match(formById('dentinox-n-gel').notes.join(' '), /poniżej 3 miesięcy.*poniżej 12 miesięcy/);
  assert.deepEqual(regimen.frequencyOptions, [2, 3]);
});

test('Tantum preserves age-specific actuation ranges and does not round preschool weight dosing', () => {
  const young = regimenById('tantum-spray-under6');
  const child = regimenById('tantum-spray-6to12');
  const older = regimenById('tantum-spray-over12');
  assert.equal(young.doseMode, 'instruction');
  assert.equal(young.dose, undefined);
  assert.equal(young.maxAgeMonths, 72);
  assert.equal(young.maxAgeExclusive, true);
  assert.equal(child.minAgeMonths, 72);
  assert.equal(child.maxAgeMonths, 144);
  assert.equal(child.maxAgeExclusive, undefined);
  assert.equal(child.dose, 4);
  assert.equal(child.maxDailyUnits, 24);
  assert.equal(older.minAgeMonths, 144);
  assert.equal(older.minAgeExclusive, true);
  assert.deepEqual(older.doseRange, { min: 4, max: 8 });
  assert.equal(older.dose, undefined);
  assert.equal(older.maxDailyUnits, 48);
  assert.deepEqual(older.frequencyOptions, [2, 3, 4, 5, 6]);
});

test('measurable rinses calculate physical ml without manufacturing mg/kg limits', () => {
  const eludril = formById('eludril-care-rinse');
  assert.equal(eludril.packOptions[0].quantity, 500);
  assert.equal(eludril.unitLabel, 'ml');
  assert.equal(eludril.strengthMg, null);
  assert.equal(eludril.maxDailyMg, null);
  assert.equal(regimenById('eludril-care-adult').dose, 15);
  assert.equal(regimenById('eludril-care-child').dose, 10);
  assert.equal(regimenById('eludril-care-child').minAgeMonths, 72);
  assert.match(regimenById('eludril-care-adult').administration, /wypluć/);
});

test('periodontal and endodontic uses remain separate procedural instructions', () => {
  const metronidazole = DENTAL_TOPICAL_REGIMENS.filter(regimen => regimen.formIds.includes('metronidazol-chema-ointment'));
  for (const regimen of metronidazole) {
    assert.equal(regimen.doseMode, 'instruction');
    assert.equal(regimen.professionalUse, true);
    assert.equal(regimen.dose, undefined);
    assert.equal(regimen.maxDailyMgPerKg, undefined);
  }
  assert.match(regimenById('metronidazole-abscess').instructionText, /Po odbarczeniu/);
  assert.equal(regimenById('metronidazole-abscess').frequency, undefined);
  assert.equal(regimenById('metronidazole-endo').frequency, undefined);
  assert.equal(regimenById('metronidazole-periodontal').frequency, 2);
});
