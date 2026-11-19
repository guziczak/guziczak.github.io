import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import {
  prescriptionPrefix, prescriptionHeader, prescriptionText,
  instructionDosingText, humanDosingText,
} from './dental-output.js';
import { createPrescriptionCart, savePrescriptionItem, prescriptionCartText } from './prescription-cart.js';
import { prescriptionCartMarkup } from './prescription-tools-view.js';

const product = formId => {
  const drug = DRUGS.find(row => row.forms.some(form => form.id === formId));
  assert.ok(drug, `Missing catalogue form: ${formId}`);
  return { drug, form: drug.forms.find(form => form.id === formId) };
};
const sourceById = id => HUMAN_REGIMENS.find(source => source.id === id);
const patient = { specialty: 'dental', patientType: 'adult', age: '35',
  humanAgeUnit: 'years', weight: '76', renalStatus: 'unknown', humanCrCl: '' };
const texts = (header, dosing, source) => ({
  full: prescriptionText({ header, dosing, source }),
  ds: prescriptionText({ mode: 'ds', header, dosing, source }),
});

function baikadent(packages = 2) {
  const { drug, form } = product('baikadent-gel');
  const pack = form.packOptions[0];
  const source = sourceById('baikadent-chronic-mucosa');
  const dosing = instructionDosingText({ source, frequency: 3, days: 14 });
  const header = prescriptionHeader({ form, pack, packages });
  return { drug, form, pack, source, dosing, texts: texts(header, dosing, source) };
}

function augmentin() {
  const { drug, form } = product('augmentin-tablet-500-125');
  const pack = form.packOptions.find(row => row.quantity === 21);
  const source = sourceById('dental-augmentin-tablet-500-125-ge40');
  const dosing = humanDosingText({ source, amount: '1 tabl.', route: form.routeLabel,
    frequency: 3, days: 5 });
  const header = prescriptionHeader({ form, name: `${drug.substance}\n${form.label}`, pack, packages: 1 });
  return { drug, form, pack, source, dosing, texts: texts(header, dosing, source) };
}

function add(cart, entry) {
  const result = savePrescriptionItem(cart, {
    valid: true, confirmed: true, label: entry.form.label, texts: entry.texts,
    snapshot: { ...patient, drugId: entry.drug.id, formId: entry.form.id, packageId: entry.pack.id },
  });
  assert.equal(result.ok, true, result.message);
  return result.cart;
}

const fullModeLabel = markup =>
  /<button\b[^>]*data-action="cart-mode"[^>]*data-value="full"[^>]*>([^<]*)<\/button>/.exec(markup)?.[1];

test('Baikadent exports Rp. and the manually selected tube count with its unchanged instructions', () => {
  const entry = baikadent();
  assert.equal(entry.texts.full,
    'Rp. Baikadent · 5,77 mg/g, żel\n2 op. po 15 g\n' +
    'D.S. Po szczotkowaniu zębów wcierać w zmienione miejsce pasek żelu około 2 cm. ' +
    'Częstotliwość: 3 razy na dobę. Czas stosowania: 14 dni. ' +
    'Nie spożywać posiłków przez co najmniej 30 minut po aplikacji.');
  assert.equal(entry.form.calculationMode, 'instruction');
  assert.equal(entry.source.doseMode, 'instruction');
  assert.equal(entry.pack.quantity, 1, 'The package sentinel must not become a gram capacity');
  assert.doesNotMatch(entry.texts.full, /Produkt leczniczy|Opakowanie:|ustalona przez lekarza/);
});

test('an unentered topical package count stays unspecified instead of becoming one tube', () => {
  const { form } = product('baikadent-gel');
  for (const packages of [null, undefined]) {
    const header = prescriptionHeader({ form, pack: form.packOptions[0], packages });
    assert.equal(header, 'Rp. Baikadent · 5,77 mg/g, żel\nOpakowanie: tuba 15 g');
    assert.doesNotMatch(header, /\bop\.|NaN|undefined|null/);
  }
});

test('Dentinox receives the same prescription format without estimating applications per tube', () => {
  const { form } = product('dentinox-n-gel');
  assert.equal(prescriptionHeader({ form, pack: form.packOptions[0], packages: 1 }),
    'Rp. Dentinox N · 15% + 0,34% + 0,32%, żel\n1 op. po 10 g');
  assert.equal(form.calculationMode, 'instruction');
  assert.equal(form.packOptions[0].quantity, 1);
});

test('Augmentin and custom human medicines retain their prescription heading', () => {
  const entry = augmentin();
  assert.equal(entry.form.productKind, undefined, 'This exercises the legacy catalogue format');
  assert.equal(entry.texts.full,
    'Rp. Amoxicillinum + Acidum clavulanicum\n' +
    'Augmentin · 500 + 125 mg · tabletki powlekane\n1 op. po 21 tabl.\n' +
    'D.S. Stosować 1 tabl. doustnie, 3 razy na dobę przez 5 dni. ' +
    'Doustnie, z posiłkiem. Przyjmować całą dawkę tabletki; kreska nie służy do podziału na równe dawki.');
  assert.equal(prescriptionHeader({ form: { label: 'Preparat własny' },
    pack: { label: '20 tabl.' }, packages: 1 }), 'Rp. Preparat własny\n1 op. po 20 tabl.');
});

test('cosmetics, devices, unclassified nonmedicines and veterinary output remain descriptive', () => {
  for (const formId of ['eludril-care-rinse', 'chlosite-025']) {
    const { form } = product(formId);
    assert.equal(prescriptionPrefix(form), 'Preparat:');
    assert.match(prescriptionHeader({ form, pack: form.packOptions[0], packages: 1 }), /^Preparat: /);
  }
  assert.equal(prescriptionPrefix({ productKind: 'supplement' }), 'Preparat:');
  const veterinary = DRUGS.find(drug => drug.specialties.includes('veterinary')).forms[0];
  assert.equal(prescriptionPrefix(veterinary, true), 'Preparat:');
  assert.match(prescriptionHeader({ form: veterinary, pack: veterinary.packOptions[0],
    packages: 1, veterinary: true }), /^Preparat: /);
});

test('special package descriptions survive without reducing them to a mass or container count', () => {
  for (const [formId, expected] of [
    ['metronidazol-chema-ointment', '2 op. po 5 g (tuba z kaniulą)'],
    ['ligosan-periodontal-gel', '2 op. po 2 wkładów × 260 mg żelu'],
    ['chlosite-025', '2 op. po 6 strzykawek × 0,25 ml'],
  ]) {
    const { form } = product(formId);
    const header = prescriptionHeader({ form, pack: form.packOptions[0], packages: 2 });
    assert.equal(header.split('\n').at(-1), expected);
  }
});

test('Augmentin and Baikadent keep separate complete prescription blocks in the basket', () => {
  const first = augmentin(), second = baikadent();
  const cart = add(add(createPrescriptionCart(), first), second);
  const output = prescriptionCartText(cart, patient);
  assert.equal(output.ok, true);
  assert.equal(output.text, `${first.texts.full}\n\n${second.texts.full}`);
  assert.equal((output.text.match(/^Rp\./gm) || []).length, 2);
  assert.equal((output.text.match(/^D\.S\./gm) || []).length, 2);
  assert.equal(fullModeLabel(prescriptionCartMarkup({ items: cart.items, text: output.text,
    canCopy: true })), 'Rp. + D.S.');

  const advice = prescriptionCartText(cart, patient, { mode: 'ds' });
  assert.equal(advice.ok, true);
  assert.match(advice.text, /Baikadent.*\nWskazanie: Przewlekłe stany zapalne/);
  assert.ok(advice.text.includes(second.dosing));
  assert.doesNotMatch(advice.text, /^Rp\.|\bop\. po|ustalona przez lekarza/gm);
});

test('a mixed basket preserves cosmetic wording and uses a neutral full-output label', () => {
  const { drug, form } = product('eludril-care-rinse');
  const pack = form.packOptions[0];
  const source = sourceById('eludril-care-adult');
  const dosing = humanDosingText({ source, amount: '15 ml', route: form.routeLabel,
    frequency: 2, days: 14 });
  const cosmetic = { drug, form, pack,
    texts: texts(prescriptionHeader({ form, pack, packages: 1 }), dosing, source) };
  const cart = add(add(createPrescriptionCart(), baikadent()), cosmetic);
  const output = prescriptionCartText(cart, patient);
  assert.equal(output.ok, true);
  assert.equal((output.text.match(/^Rp\./gm) || []).length, 1);
  assert.match(output.text, /^Preparat: Eludril Care/gm);
  assert.equal(fullModeLabel(prescriptionCartMarkup({ items: cart.items, text: output.text,
    canCopy: true })), 'Pełny zapis');
  assert.equal(cart.items[1].texts.full, cosmetic.texts.full);
});
