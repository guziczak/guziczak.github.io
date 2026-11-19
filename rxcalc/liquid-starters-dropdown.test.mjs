import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DENTAL_SYSTEMIC_REGIMENS} from './dental-systemic.js';
import {LIQUID_STARTER_REGIMENS, liquidStarterMarkup} from './liquid-starters.js';

const choices = DENTAL_SYSTEMIC_REGIMENS.filter(s=>s.formIds.includes('ospamox-250'));

test('liquid starter choices render one closed select, not a stack of action cards',()=>{
  const html=liquidStarterMarkup(choices);
  assert.equal((html.match(/<select\b/g)||[]).length,1);
  assert.match(html,/<label for="regimenId">Uzupełnij ze schematu \(opcjonalnie\)<\/label>/);
  assert.match(html,/<select id="regimenId" data-field="regimenId" aria-describedby="liquid-starter-help">/);
  assert.doesNotMatch(html,/<button\b|liquid-starter-(?:choice|list|item)|data-action="liquid-source"/);
  assert.doesNotMatch(html,/<select[^>]*\b(?:multiple|size)\b/);
});

test('opening the initial selector does not preselect any regimen',()=>{
  const html=liquidStarterMarkup(choices);
  assert.match(html,/<option value="">Wybierz schemat…<\/option>/);
  assert.doesNotMatch(html,/<option[^>]*\bselected\b/);
  assert.equal((html.match(/<option\b/g)||[]).length,choices.length+1);
  for(const source of choices)assert.ok(html.includes(`<option value="${source.id}">`));
  assert.ok(html.includes('250–500 mg · 3 ×/dobę'));
  assert.ok(html.includes('750–1000 mg · 2 ×/dobę'));
  assert.ok(html.includes('20–90 mg/kg/dobę'));
});

test('conditions and exact source links are retained in one initially collapsed disclosure',()=>{
  const html=liquidStarterMarkup([...choices,...LIQUID_STARTER_REGIMENS]);
  assert.equal((html.match(/<details\b/g)||[]).length,1);
  assert.match(html,/<details class="liquid-starter-sources"><summary>Warunki i źródła schematów<\/summary>/);
  assert.doesNotMatch(html,/<details[^>]*\bopen\b/);
  for(const source of [...choices,...LIQUID_STARTER_REGIMENS]) {
    assert.ok(html.includes(source.sourceUrl));
    for(const extra of source.additionalSources||[])assert.ok(html.includes(extra.url));
  }
  assert.ok(html.includes('nie gotowy schemat z polskiej ChPL zawiesiny'));
  assert.match(html,/<option[^>]*>[^<]*Przeliczenie ChPL \+ FDA<\/option>/);
});

test('dropdown rendering escapes labels and ids and never mutates frozen source records',()=>{
  const source=Object.freeze({...choices[0],id:'x" onclick="bad',label:'<img onerror="bad">',indication:'<script>bad</script>',sourceLabel:'<source>'});
  const list=Object.freeze([source]);
  const before=JSON.stringify(list);
  const html=liquidStarterMarkup(list);
  assert.doesNotMatch(html,/<img\b|<script\b|<source>/);
  assert.ok(html.includes('x&quot; onclick=&quot;bad'));
  assert.ok(html.includes('&lt;img onerror=&quot;bad&quot;&gt;'));
  assert.equal(JSON.stringify(list),before);
  assert.equal(liquidStarterMarkup([]),'');
});

test('fixed starter and range records keep the original dosing and duration behavior',()=>{
  const before=JSON.stringify({choices,starters:LIQUID_STARTER_REGIMENS});
  liquidStarterMarkup(choices);liquidStarterMarkup(LIQUID_STARTER_REGIMENS);
  assert.equal(JSON.stringify({choices,starters:LIQUID_STARTER_REGIMENS}),before);
  assert.equal(LIQUID_STARTER_REGIMENS[0].dose,875);
  assert.equal(LIQUID_STARTER_REGIMENS[0].frequency,2);
  assert.equal(LIQUID_STARTER_REGIMENS[0].fixedDays,undefined);
  assert.equal(choices[0].dose,undefined);
});

test('dropdown runtime and cache version match the public mirror',async()=>{
  for(const name of ['liquid-starters.js','liquid-doses.css','sw.js']) {
    assert.equal(await readFile(new URL(name,import.meta.url),'utf8'),
      await readFile(new URL(`../public/rxcalc/${name}`,import.meta.url),'utf8'));
  }
  assert.match(await readFile(new URL('sw.js',import.meta.url),'utf8'),/2026-11-20\.76/);
});
