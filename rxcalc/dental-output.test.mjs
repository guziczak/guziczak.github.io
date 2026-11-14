import test from 'node:test';
import assert from 'node:assert/strict';
import { humanDosingText, instructionDosingText, prescriptionText } from './dental-output.js';

test('human full prescription starts at Rp.; source indication and regimen stay out of the copy', () => {
  const source = { indication: 'Ropień okołozębowy', phaseLabel: '250–500 mg, 3 razy/dobę' };
  const header = 'Rp. Amoxicillinum\nOspamox 500 mg · tabletki powlekane\n2 op. po 16 tabl.';
  const dosing = humanDosingText({ source, amount:'1 tabl.', route:'doustnie', frequency:3, days:7 });
  const text = prescriptionText({ source, header, dosing });
  assert.equal(text, `${header}\nD.S. Stosować 1 tabl. doustnie, 3 razy na dobę przez 7 dni.`);
  assert.doesNotMatch(text, /Wskazanie:|Schemat:/);
  assert.equal(prescriptionText({mode:'ds', source, header, dosing}), dosing);
});

test('topical instruction copy excludes indication without changing user-authored recommendations', () => {
  const source = { indication:'Zapalenie dziąseł', instructionText:'Stosować miejscowo.' };
  const dosing = instructionDosingText({source, extraInstructions:'Schemat: dodatkowa uwaga lekarza.'});
  const header = 'Preparat: Żel miejscowy\nOpakowanie: 10 g';
  assert.equal(prescriptionText({source, header, dosing}), `${header}\n${dosing}`);
  assert.equal(prescriptionText({mode:'ds', source, header, dosing}), dosing);
  assert.match(dosing, /Schemat: dodatkowa uwaga lekarza\./);
});

test('veterinary copy retains patient, food-chain and treatment-stage context', () => {
  const veterinaryContext = 'Gatunek: Koń. Masa ciała: 500 kg. Status w paszporcie: wykluczony z uboju do spożycia przez ludzi.';
  const source = {indication:'Przykładowe wskazanie', phaseLabel:'Etap podtrzymujący'};
  const header = 'Preparat: Przykładowy preparat';
  const dosing = 'D.S. Instrukcja oraz kalibracja strzykawki.';
  const context = `${veterinaryContext}\nWskazanie: Przykładowe wskazanie.\nSchemat: Etap podtrzymujący.`;
  assert.equal(prescriptionText({veterinaryContext, source, header, dosing}), `${context}\n${header}\n${dosing}`);
  assert.equal(prescriptionText({mode:'ds', veterinaryContext, source, header, dosing}), `${context}\n${dosing}`);
});

test('PRN export retains maximum administrations, minimum interval and total substance ceiling', () => {
  const text=humanDosingText({source:{asNeeded:true,minIntervalHours:4,maxDailyMg:1200},amount:'2 tabl.',route:'doustnie',frequency:3,days:2});
  assert.match(text,/w razie potrzeby, nie więcej niż 3 razy na dobę/);
  assert.match(text,/co najmniej 4 godz/);
  assert.match(text,/1200 mg.*ze wszystkich preparatów/);
  assert.doesNotMatch(text,/co 8 godzin/);
});
test('qualitative instruction does not fabricate grams, millilitres or package quantity', () => {
  const text=instructionDosingText({source:{instructionText:'Nanieść pasek około 1 cm.',administration:'Nie jeść przez 30 minut.'},frequency:3,days:null});
  assert.match(text,/1 cm/);
  assert.match(text,/3 razy na dobę/);
  assert.doesNotMatch(text,/g\b|ml\b|op\.|dni|undefined|NaN/);
});
test('bounded instruction exports the explicitly chosen duration', () => {
  const text=instructionDosingText({source:{instructionText:'Aplikacja miejscowa.'},frequency:2,days:7});
  assert.match(text,/Czas stosowania: 7 dni/);
});
test('a clinician-tightened ceiling survives the copied PRN instructions', () => {
  const text=humanDosingText({source:{asNeeded:true,minIntervalHours:4,maxDailyMg:4000},amount:'1 tabl.',frequency:4,days:2,effectiveDailyLimit:2000});
  assert.match(text,/2000 mg/);
  assert.doesNotMatch(text,/4000 mg/);
});
