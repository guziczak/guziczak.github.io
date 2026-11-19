import test from 'node:test';
import assert from 'node:assert/strict';
import { dosingDuration, humanDosingText, instructionDosingText, prescriptionText } from './dental-output.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { REGIMENS } from './regimens.js';

test('full prescription starts at Rp.; advice adds only the chosen indication before dosing', () => {
  const source = { indication: 'Ropień okołozębowy', phaseLabel: '250–500 mg, 3 razy/dobę' };
  const header = 'Rp. Amoxicillinum\nOspamox 500 mg · tabletki powlekane\n2 op. po 16 tabl.';
  const dosing = humanDosingText({ source, amount:'1 tabl.', route:'doustnie', frequency:3, days:7 });
  const text = prescriptionText({ source, header, dosing });
  assert.equal(text, `${header}\nD.S. Stosować 1 tabl. doustnie, 3 razy na dobę przez 7 dni.`);
  assert.doesNotMatch(text, /Wskazanie:|Schemat:/);
  assert.equal(prescriptionText({mode:'ds', source, header, dosing}), `Wskazanie: Ropień okołozębowy.\n\n${dosing}`);
  assert.equal(prescriptionText({mode:'ds', source:{...source, indication:'Ropień okołozębowy.'}, header, dosing}), `Wskazanie: Ropień okołozębowy.\n\n${dosing}`);
  assert.equal(prescriptionText({mode:'ds', header, dosing}), dosing);
  assert.equal(prescriptionText({mode:'ds', source:{indication:'  '}, header, dosing}), dosing);
});

test('topical advice adds its indication while preserving user-authored recommendations', () => {
  const source = { indication:'Zapalenie dziąseł', instructionText:'Stosować miejscowo.' };
  const dosing = instructionDosingText({source, extraInstructions:'Schemat: dodatkowa uwaga lekarza.'});
  const header = 'Preparat: Żel miejscowy\nOpakowanie: 10 g';
  assert.equal(prescriptionText({source, header, dosing}), `${header}\n${dosing}`);
  assert.equal(prescriptionText({mode:'ds', source, header, dosing}), `Wskazanie: Zapalenie dziąseł.\n\n${dosing}`);
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

test('reviewed maintenance periods describe supply in the result, full prescription and advice', () => {
  const records = [...HUMAN_REGIMENS, ...REGIMENS];
  for (const id of [
    'cardio-eliquis-nvaf-standard', 'cardio-eliquis-vte-continuation', 'cardio-eliquis-vte-extended',
    'cardio-betaloc-hf-titration-zok25', 'cardio-toramide-oedema-initial',
    'cardio-ramipril-hypertension-10-crcl-ge60', 'cardio-atoris-cv-prevention-10',
    'cardisure-preferred', 'ventipulmin-chronic',
  ]) {
    const source = records.find(record => record.id === id);
    assert.ok(source, id);
    const duration = dosingDuration({source, days:30});
    assert.equal(duration.summary, 'Zapas na 30 dni', id);
    if (source.species) {
      assert.equal(duration.dosingSuffix, '. Zapas na 30 dni', id);
      continue;
    }
    const dosing = humanDosingText({source, amount:'1 tabl.', frequency:2, days:30});
    for (const mode of ['full', 'ds']) {
      const text = prescriptionText({mode, source, header:'Rp. Preparat', dosing});
      assert.match(text, /na dobę\. Zapas na 30 dni\./, id);
      assert.doesNotMatch(text, /przez 30 dni/, id);
    }
  }
});

test('actual courses and initial anticoagulant phases retain their treatment duration', () => {
  for (const [id, days] of [
    ['cardio-eliquis-vte-initial', 7], ['cardio-xarelto-vte-initial', 21],
    ['cardio-betaloc-hf-initial-standard', 14], ['cardio-eliquis-post-knee', 12],
    ['dental-augmentin-tablet-500-125-ge40', 5],
  ]) {
    const source = HUMAN_REGIMENS.find(record => record.id === id);
    assert.ok(source, id);
    assert.equal(dosingDuration({source, days}).summary, `przez ${days} dni`, id);
    const dosing = humanDosingText({source, amount:'1 tabl.', frequency:2, days});
    assert.ok(dosing.includes(`na dobę przez ${days} dni.`), id);
    assert.doesNotMatch(dosing, /Zapas na/, id);
  }
});

test('supply wording requires an unchanged reviewed source and never invents missing days', () => {
  const source = HUMAN_REGIMENS.find(record => record.id === 'cardio-eliquis-nvaf-standard');
  for (const unreviewed of [null, {...source, id:'unreviewed-maintenance'}, {...source, frequency:3}]) {
    assert.equal(dosingDuration({source:unreviewed, days:30}).summary, 'przez 30 dni');
    assert.doesNotMatch(humanDosingText({source:unreviewed, amount:'1 tabl.', frequency:2, days:30}), /Zapas na/);
  }
  for (const days of [null, undefined, NaN, 0]) {
    assert.equal(dosingDuration({source, days}).summary, '');
    assert.doesNotMatch(humanDosingText({source, amount:'1 tabl.', frequency:2, days}), /Zapas na|przez .*dni|NaN|undefined/);
  }
  assert.equal(dosingDuration({source, days:1}).summary, 'Zapas na 1 dzień');
});
