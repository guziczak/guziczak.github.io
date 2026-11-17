import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {conciseLabel,compactInterface} from './concise-ui.js';

test('compact labels retain direction and the source context',()=>{
 assert.equal(conciseLabel('Poniżej zakresu schematu'),'Poniżej zakresu');
 assert.equal(conciseLabel('Powyżej zakresu schematu'),'Powyżej zakresu');
 assert.equal(conciseLabel('Poniżej dawki ze źródła'),'Poniżej dawki źródłowej');
 assert.equal(conciseLabel('Powyżej dawki ze źródła'),'Powyżej dawki źródłowej');
});
test('a personal rounding review is never relabelled as clinical approval',()=>{
 assert.equal(conciseLabel('Zaokrąglenie wymaga indywidualnej oceny'),'Zaokrąglenie do oceny');
 assert.equal(conciseLabel('Zaokrąglenie ocenione indywidualnie'),'Zaokrąglenie ocenione');
 assert.doesNotMatch(conciseLabel('Zaokrąglenie ocenione indywidualnie'),/bezpiecz|zatwierdzone|zweryfikowan/i);
});
test('companion-ingredient caveat keeps its independent-maximum distinction',()=>{
 assert.match(conciseLabel('Z proporcji składników preparatu — nie jest to niezależne maksimum tej substancji.'),/nie osobne maksimum/);
});
test('unknown/clinical messages and their values are never guessed or truncated',()=>{
 for(const text of ['Ponad limit dobowy','CrCl <30 ml/min','Brak potwierdzonego zakresu wieku','Powyżej zakresu o 0,57%','Nieprawidłowa masa: 0 kg','Wymagana ponowna ocena źródła','880 mg = 11 ml','<script>'])
  assert.equal(conciseLabel(text),text);
});
test('manual duration and reviewed-no-range stay unassessed in compact text',()=>{
 assert.match(conciseLabel('Wybierz schemat, aby ocenić czas. W trybie ręcznym przyciski są tylko skrótami wpisywania.'),/nie zaleceniem/);
 assert.match(conciseLabel('Źródło sprawdzone: nie określa pełnego zakresu dni dla tego wskazania. Czas ustala lekarz.'),/Brak.*ustala lekarz/);
});
test('presentation helper is importable without a browser and accepts an absent view',()=>{
 assert.doesNotThrow(()=>compactInterface(null));assert.doesNotThrow(()=>compactInterface({}));
});
test('presentation module has no engine/state dependencies, synthetic edits or storage',async()=>{
 const js=await readFile(new URL('concise-ui.js',import.meta.url),'utf8');
 assert.doesNotMatch(js,/import .*from|localStorage|sessionStorage|dispatchEvent|\.value\s*=|\.checked\s*=/);
 assert.match(js,/MutationObserver/);assert.match(js,/finally \{ observe\(\); \}/);
 assert.match(js,/duration-warning, \.duration-critical/);
});
test('concise assets are present in the hosted mirror, CSP-preserving shell, build and cache',async()=>{
 for(const name of ['concise-ui.js','concise-ui.css','index.html','build.mjs','sw.js']){
  assert.equal(await readFile(new URL(name,import.meta.url),'utf8'),await readFile(new URL('../public/rxcalc/'+name,import.meta.url),'utf8'));
 }
 const html=await readFile(new URL('index.html',import.meta.url),'utf8');
 assert.match(html,/Content-Security-Policy/);assert.match(html,/src="\.\/concise-ui.js"/);
 for(const file of ['build.mjs','sw.js'])for(const asset of ['concise-ui.js','concise-ui.css'])
  assert.ok((await readFile(new URL(file,import.meta.url),'utf8')).includes(`'${asset}'`));
});
