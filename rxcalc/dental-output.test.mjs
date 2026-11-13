import test from 'node:test';
import assert from 'node:assert/strict';
import { humanDosingText, instructionDosingText } from './dental-output.js';

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
