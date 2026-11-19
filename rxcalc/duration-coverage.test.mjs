import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HUMAN_REGIMENS} from './human-regimens.js';
import {LIQUID_STARTER_REGIMENS} from './liquid-starters.js';
import {REGIMENS} from './regimens.js';
import {resolveRegimen} from './regimen-engine.js';
import {DRUGS} from './catalogue.js';
import {DURATION_BINDINGS,auditedDurationPolicy} from './duration-rules.js';
import {resolveDurationGuidance,assessDuration,durationDayChoices,durationResultWarning,durationPatientEligibility} from './duration-guidance.js';
import {durationGuidanceMarkup} from './duration-view.js';
import {reviewedDurationSources} from './duration-source-review.js';
const records=[...HUMAN_REGIMENS,...LIQUID_STARTER_REGIMENS,...REGIMENS];
const forms=DRUGS.flatMap(d=>d.forms);
const newlyCovered=records.filter(s=>/^(?:nystatin-|cardio-|ligosan-)/.test(s.id));
const newlyCoveredIds=new Set(newlyCovered.map(s=>s.id));
function options(s, formId=s.formIds[0]) {
 const animal=!!s.species,child=s.patientTypes?.includes('child')&&!s.patientTypes.includes('adult')||s.maxAgeMonths!=null||s.maxWeightExclusive&&s.maxWeight<=40;
 let age=child?60:420;
 if(s.minAgeMonths!=null&&age<=s.minAgeMonths)age=s.minAgeMonths+1;
 if(s.maxAgeMonths!=null&&age>=s.maxAgeMonths)age=s.maxAgeMonths-1;
 let weight=child?20:70;
 if(s.minWeight!=null)weight=Math.max(weight,s.minWeight+(s.minWeightExclusive?1:0));
 if(s.maxWeight!=null)weight=Math.min(weight,s.maxWeight-(s.maxWeightExclusive?1:0));
 if(animal)weight=s.species[0]==='horse'?500:s.species[0]==='cat'?4:10;
 if(s.id==='gastazole-followup')weight=400; // A whole applicator division at this stage's dose.
 if(animal&&s.weightBands)weight=(s.weightBands[0].min+s.weightBands[0].max)/2;
 let crcl=s.requireCrCl?80:null,serumCreatinine=s.patientFields?.includes('serumCreatinine')?1:null;
 if(s.maxCrCl!=null)crcl=((s.minCrCl??0)+s.maxCrCl)/2;
 if(s.anticoagulantRule==='apixaban-nvaf-two-criteria'){age=82*12;weight=55;serumCreatinine=1.6;}
 if(s.anticoagulantRule==='apixaban-nvaf-severe-renal')crcl=20;
 if(['rivaroxaban-nvaf-renal','rivaroxaban-vte-reduced'].includes(s.anticoagulantRule))crcl=40;
 const context=animal?{specialty:'veterinary',species:s.species[0],age:5,ageUnit:'years',weight,foodChainStatus:'excluded'}
 :{specialty:s.specialties[0],patientType:child?'child':'adult',age,ageUnit:'months',weight,renalStatus:'unknown',crcl,serumCreatinine,
  sourceConfirmations:(s.selectionRequirements||[]).map(requirement=>requirement.id)};
 const resolved=animal?resolveRegimen(s,{...context,formId,days:s.fixedDays||s.minDays||1}):null;
 return {source:s,form:forms.find(f=>f.id===formId),context:{...context,formId,days:null,
  doseMode:s.doseMode,dose:animal?resolved.dose:s.dose??s.doseRange?.min??null,
  frequency:animal?resolved.frequency:s.frequency??s.frequencyOptions?.[0]??null}};
}
const lookup=id=>options(records.find(s=>s.id===id));
const guidance=id=>resolveDurationGuidance(lookup(id));

test('every shipped explicit regimen has exactly one reviewed duration binding',()=>{
 assert.equal(records.length,128);assert.equal(newlyCovered.length,68);assert.equal(DURATION_BINDINGS.length,records.length);
 assert.deepEqual([...new Set(DURATION_BINDINGS.map(b=>b[0]))].sort(),records.map(s=>s.id).sort());
});
for(const s of records) test(`reviewed duration coverage: ${s.id}`,()=>{
 assert.equal(auditedDurationPolicy(s).status,'reviewed');
 for(const formId of s.formIds){const o=options(s,formId),g=resolveDurationGuidance(o);
  assert.ok(o.form,formId);assert.equal(g.coverage,'reviewed');
  assert.ok(g.rule?.url.startsWith('https://'));assert.ok(g.rule.note);assert.equal(g.rule.checkedAt,newlyCoveredIds.has(s.id)?'2026-11-19':'2026-11-16');
  assert.equal(g.applicable,true,JSON.stringify({id:s.id,o,g}));
  for(const d of [1,3,5,7,10,14,30])assert.deepEqual(assessDuration(d,g),assessDuration(String(d),g));
  const before=JSON.stringify(o);assessDuration(10,g);durationDayChoices(s,g);assert.equal(JSON.stringify(o),before);
 }
});
test('new and clinically modified sources remain explicitly unverified, never verified-no-range',()=>{
 const o=lookup('dental-ospamox-suspension-ge40-q8');
 for(const change of [s=>s.id='new',s=>s.indication='other',s=>s.maxDays=20,s=>s.minAgeMonths=0,s=>s.sourceUrl='https://example.org/changed']){
  const s=structuredClone(o.source);change(s);const g=resolveDurationGuidance({...o,source:s});
  assert.equal(g.applicable,false);assert.notEqual(g.coverage,'reviewed');assert.equal(assessDuration(5,g).tone,'neutral');
 }
});
test('reviewed-no-range differs from unreviewed and manual statuses',()=>{
 const g=guidance('dental-dalacin-c-300-over14-tid');assert.equal(g.applicable,true);assert.equal(g.rule.minimum,null);assert.equal(g.rule.maximum,null);
 assert.match(assessDuration(10,g).message,/Źródło sprawdzone/);assert.equal(assessDuration(10,g).tone,'neutral');
 assert.equal(resolveDurationGuidance({}).coverage,'manual');
});
test('all 68 added records have explicit primary-source duration review without inheriting a neighbouring drug review',()=>{
 for(const s of newlyCovered){
  const review=reviewedDurationSources(s.id);
  assert.ok(review,s.id);assert.equal(review.checkedAt,'2026-11-19');
  assert.ok(review.entries.some(entry=>entry.url===s.sourceUrl),s.id);
  assert.ok(review.entries.every(entry=>entry.label&&entry.note),s.id);
 }
 assert.equal(reviewedDurationSources('cardio-atoris-new-unreviewed-phase'),null);
 assert.equal(reviewedDurationSources('nystatin-new-unreviewed-route'),null);
});
test('new renal, patient, phase-confirmation and source-lock edits suspend the duration audit',()=>{
 for(const [id,change] of [
  ['cardio-ramipril-hypertension-5-crcl10to60',s=>s.maxCrCl=90],
  ['cardio-ramipril-hypertension-5-crcl10to60',s=>s.maxCrClExclusive=false],
  ['cardio-eliquis-nvaf-standard',s=>s.anticoagulantRule='apixaban-nvaf-two-criteria'],
  ['cardio-eliquis-nvaf-standard',s=>s.patientFields=['crcl']],
  ['cardio-eliquis-vte-initial',s=>s.selectionRequirements[1].detail='Zmieniono warunek początku etapu.'],
  ['cardio-betaloc-hf-initial-standard',s=>s.selectionRequirements=[]],
  ['nystatin-adult-oral',s=>s.lockSourceValues=false],
 ]){
  const o=lookup(id),source=structuredClone(o.source);change(source);
  const g=resolveDurationGuidance({...o,source});
  assert.equal(g.coverage,'changed',id);assert.equal(g.applicable,false,id);
  assert.equal(assessDuration(source.fixedDays??30,g).tone,'neutral',id);
 }
});
test('new reviewed periods remain inapplicable when confirmations, renal data or NVAF criteria are missing',()=>{
 for(const [id,changes] of [
  ['cardio-betaloc-hf-initial-standard',{sourceConfirmations:[]}],
  ['cardio-eliquis-post-hip',{sourceConfirmations:[]}],
  ['cardio-ramipril-hypertension-10-crcl-ge60',{crcl:null}],
  ['cardio-ramipril-hypertension-5-crcl10to60',{crcl:60}],
  ['cardio-eliquis-nvaf-standard',{serumCreatinine:null}],
  ['cardio-eliquis-nvaf-two-criteria',{age:35*12,weight:70,serumCreatinine:1}],
  ['cardio-xarelto-nvaf-renal',{crcl:60}],
 ]){
  const o=lookup(id);Object.assign(o.context,changes);const g=resolveDurationGuidance(o);
  assert.equal(g.coverage,'reviewed',id);assert.equal(g.applicable,false,id);
  assert.equal(assessDuration(o.source.fixedDays??30,g).tone,'neutral',id);
 }
});
test('new acute and HF starts use their actual source phase lengths without repeating the whole treatment',()=>{
 for(const [id,days] of [
  ['cardio-eliquis-vte-initial',7],['cardio-xarelto-vte-initial',21],
  ['cardio-betaloc-hf-initial-standard',14],['cardio-betaloc-hf-initial-nyha3to4',7],
 ]){
  const o=lookup(id),g=resolveDurationGuidance(o);
  assert.equal(g.rule.kind,'stage');assert.equal(g.rule.minimum,days);assert.equal(g.rule.maximum,days);
  assert.equal(assessDuration(days,g).tone,'within');
  assert.equal(assessDuration(days-1,g).tone,'warning');
  assert.equal(assessDuration(days+1,g).tone,'critical');
  assert.deepEqual(durationDayChoices(o.source,g),[]);
 }
});
test('apixaban hip and knee prophylaxis keep the distinct complete-course source ranges',()=>{
 for(const [id,min,max] of [['cardio-eliquis-post-hip',32,38],['cardio-eliquis-post-knee',10,14]]){
  const g=guidance(id);assert.equal(g.rule.minimum,min);assert.equal(g.rule.maximum,max);
  assert.equal(assessDuration(min-1,g).tone,'warning');
  assert.equal(assessDuration(min,g).tone,'within');assert.equal(assessDuration(max,g).tone,'within');
  assert.equal(assessDuration(max+1,g).tone,'critical');
 }
});
test('Nystatin shelf life and Ligosan hygiene days never create treatment duration bounds',()=>{
 for(const s of newlyCovered.filter(s=>s.id.startsWith('nystatin-')||s.id.startsWith('ligosan-'))){
  const o=options(s),g=resolveDurationGuidance(o);
  assert.equal(g.rule.minimum,null,s.id);assert.equal(g.rule.maximum,null,s.id);
  assert.equal(g.rule.reviewAfterDays,null,s.id);assert.deepEqual(durationDayChoices(s,g),[]);
  for(const days of [1,7,8,14,30])assert.equal(assessDuration(days,g).tone,'neutral',s.id);
 }
 assert.match(guidance('nystatin-adult-oral').rule.note,/trwałość.*nie.*leczenia/);
 assert.equal(guidance('ligosan-adult-periodontal-procedure').rule.kind,'procedural');
 assert.match(guidance('ligosan-adult-periodontal-procedure').rule.note,/czyszczenia.*nie.*podawania/);
});
test('chronic supplies, VTE prerequisites and titration intervals do not become invented course endpoints',()=>{
 const bounded=new Set(['cardio-eliquis-vte-initial','cardio-xarelto-vte-initial','cardio-eliquis-post-hip',
  'cardio-eliquis-post-knee','cardio-betaloc-hf-initial-standard','cardio-betaloc-hf-initial-nyha3to4']);
 for(const s of newlyCovered.filter(s=>s.id.startsWith('cardio-')&&!bounded.has(s.id))){
  const g=resolveDurationGuidance(options(s));
  assert.equal(g.rule.minimum,null,s.id);assert.equal(g.rule.maximum,null,s.id);assert.equal(g.rule.reviewAfterDays,null,s.id);
  for(const days of [1,7,14,28,30,90,180])assert.equal(assessDuration(days,g).tone,'neutral',s.id);
  assert.match(g.rule.note,/zapas|zapasu/,s.id);assert.match(g.rule.note,/odstawienia/,s.id);
 }
 assert.match(guidance('cardio-eliquis-vte-extended').rule.note,/6 miesięcy/);
 assert.match(guidance('cardio-atoris-hypercholesterolaemia-initial').rule.note,/4 tygodnie/);
 assert.match(guidance('cardio-toramide-hypertension-initial').rule.note,/12 tygodni/);
 assert.match(guidance('cardio-betaloc-hf-titration-zok50').rule.note,/2 tygodnie/);
});
test('changed phase, weight table, dose limits or instructions suspend audited agreement',()=>{
 for(const [id,change] of [
  ['butagran-horse-days-two-four',s=>s.phaseLabel='Inny etap'],
  ['iverpraz-horse-mixed-infestation-table',s=>s.weightBands[0].units+=1],
  ['dental-augmentin-400-57-child',s=>s.maxDailyMgPerKg=90],
  ['baikadent-chronic-mucosa',s=>s.instructionText='Inna instrukcja'],
 ]){
  const o=lookup(id),source=structuredClone(o.source);change(source);
  const g=resolveDurationGuidance({...o,source});
  assert.equal(g.coverage,'changed',id);assert.equal(g.applicable,false);
  assert.equal(assessDuration(3,g).tone,'neutral');
 }
});
test('Augmentin primary policies retain extension threshold; pediatric comparison is separate',()=>{
 for(const s of records.filter(s=>s.id.startsWith('dental-augmentin'))){const g=resolveDurationGuidance(options(s));
  assert.equal(g.rule.reviewAfterDays,14);
  assert.equal(g.rule.minimum,null);assert.equal(g.rule.maximum,null);
  for(const d of [3,5,7,10,14])assert.equal(assessDuration(d,g).tone,g.reference?'warning':'neutral');
  assert.equal(assessDuration(15,g).tone,'warning');assert.match(g.rule.reviewText,/Nie przedłużać.*ponad 14/);
 }
});
test('analgesic consultation threshold does not invent a 3-day course or green minimum',()=>{
 for(const s of records.filter(s=>s.id.startsWith('dental-ibuprom')||s.id.startsWith('dental-metafen'))){const g=resolveDurationGuidance(options(s));
 assert.equal(g.rule.kind,'as-needed');assert.equal(assessDuration(1,g).tone,'neutral');assert.equal(assessDuration(3,g).tone,'neutral');assert.equal(assessDuration(4,g).tone,'warning');
 assert.deepEqual(durationDayChoices(s,g),[1,2,3,5]);}
});
test('conditional teething follow-up never mandates a 7-day course',()=>{
 const g=guidance('dentinox-teething');assert.equal(g.rule.reviewMode,'conditional');assert.match(g.rule.reviewText,/Brak poprawy/);assert.equal(assessDuration(7,g).tone,'neutral');assert.equal(assessDuration(8,g).tone,'warning');
});
test('Tantum consultation and maximum have distinct meanings from unconditional vet maxima',()=>{
 const t=guidance('tantum-rinse-use'),v=guidance('onsior-cat-acute');
 assert.equal(assessDuration(8,t).tone,'warning');assert.equal(assessDuration(7,t).tone,'neutral');
 assert.equal(assessDuration(7,v).tone,'critical');assert.equal(assessDuration(5,v).tone,'neutral');
});
test('ulcerative-gingivitis procedural review does not remove its separate duration cap',()=>{
 const g=guidance('metronidazole-ulcerative-gingivitis');assert.equal(g.rule.reviewAfterDays,null);
 assert.match(g.rule.reviewText,/sanację.*3–5/);assert.equal(assessDuration(7,g).tone,'within');assert.equal(assessDuration(11,g).tone,'critical');
});
test('procedures never reuse dressing-retention interval as course length',()=>{
 for(const id of ['metronidazole-endo','metronidazole-abscess']){const o=lookup(id),g=resolveDurationGuidance(o);
 assert.equal(g.rule.kind,'procedural');assert.equal(g.rule.minimum,null);assert.equal(g.rule.maximum,null);
 assert.deepEqual(durationDayChoices(o.source,g),[]);assert.equal(assessDuration(5,g).tone,'neutral');}
});
test('fixed phases and single treatments have no editable multi-day quick choices',()=>{
 for(const s of records.filter(s=>s.fixedDays)){const g=resolveDurationGuidance(options(s));
 assert.deepEqual(durationDayChoices(s,g),[]);assert.equal(assessDuration(s.fixedDays,g).tone,'within');assert.equal(assessDuration(s.fixedDays+1,g).tone,'critical');}
});
test('a correct duration does not approve a dose outside the applicator divisions',()=>{
 const o=lookup('gastazole-followup');o.context.weight=500;
 const g=resolveDurationGuidance(o),a=assessDuration(28,g);
 assert.equal(a.timeState,'within');assert.equal(a.tone,'warning');
 assert.match(a.message,/podział|dział/);
 assert.equal(assessDuration(29,g).tone,'critical');
});
test('chronic Cardisure and daily Eludril are not silently treated as finite courses',()=>{
 for(const id of ['cardisure-preferred','eludril-care-adult','eludril-care-child']){const o=lookup(id),g=resolveDurationGuidance(o);
 for(const d of [5,30,90])assert.equal(assessDuration(d,g).tone,'neutral');assert.match(g.rule.note,/nie.*(?:odstawienia|zakończenia)/);}
});
test('chronic minimum is not permission to mark every longer course green',()=>{
 const g=guidance('ventipulmin-chronic');assert.equal(assessDuration(14,g).tone,'warning');assert.equal(assessDuration(28,g).tone,'neutral');assert.equal(assessDuration(90,g).tone,'neutral');
});
test('vet no-response instructions are not unconditional maximum for responders or new stage',()=>{
 for(const id of ['metacam-dog-maintenance','metacam-cat-chronic-maintenance','butagran-horse-daily-continuation']){const g=guidance(id);
 assert.equal(g.rule.maximum,null);assert.equal(g.rule.reviewAfterDays,null);assert.match(g.rule.note,/całego leczenia/);assert.equal(assessDuration(30,g).tone,'neutral');}
});
test('no duration scope crosses species or human/veterinary profile',()=>{
 const v=lookup('onsior-cat-acute');v.context.species='dog';assert.equal(resolveDurationGuidance(v).applicable,false);
 const h=lookup('dental-augmentin-tablet-875-125-ge40');h.context.specialty='veterinary';assert.equal(resolveDurationGuidance(h).applicable,false);
 v.context.specialty='dental';assert.equal(resolveDurationGuidance(v).applicable,false);
});
test('required vet mass, age and food-chain exclusion still suspend colors',()=>{
 for(const [id,field,value] of [['onsior-cat-acute','weight',null],['onsior-cat-acute','age',null],['butagran-horse-day-one','foodChainStatus','unknown']]){
 const o=lookup(id);o.context[field]=value;assert.equal(resolveDurationGuidance(o).applicable,false,id);}
});
test('reviewed sources disclose pending patient conditions rather than unreviewed content',()=>{
 const o=lookup('dental-augmentin-400-57-child');o.context.weight=null;const g=resolveDurationGuidance(o);
 assert.equal(g.coverage,'reviewed');assert.equal(g.applicable,false);assert.match(g.reason,/dane pacjenta/);assert.equal(assessDuration(5,g).tone,'neutral');
});
test('maximum-only 14 days never turns every shorter choice green',()=>{
 for(const id of ['equioxx-horse-osteoarthritis','metacam-horse-msk','cerenia-vomiting-16']){const g=guidance(id);assert.equal(assessDuration(10,g).tone,'neutral');assert.equal(assessDuration(15,g).tone,'critical');}
});
test('range/fixed source views preserve independent selection and text cues',()=>{
 const g=guidance('ventipulmin-acute'),html=durationGuidanceMarkup({choices:[3,10,14,15],days:15,guidance:g});
 assert.match(html,/duration-critical active/);assert.match(html,/aria-pressed="true"/);assert.match(html,/⚠/);assert.doesNotMatch(html,/disabled/);
});
test('empty procedural and fixed shortcut lists do not create empty visible grids',()=>{
 const g=guidance('baikadent-chronic-mucosa');const h=durationGuidanceMarkup({choices:[],days:14,guidance:g});
 assert.doesNotMatch(h,/class="quick-days/);assert.match(h,/14 dni/);assert.match(h,/Źródło i zakres oceny czasu/);
});
test('all application branches use the same view and instruction path gets result warnings',async()=>{
 const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
 const fn=app.slice(app.indexOf('function durationChoices'),app.indexOf('const deviceDivisions'));
 assert.doesNotMatch(fn,/if\(isVeterinary\(\)\)/);assert.match(app,/isVeterinary\(\)\?regimenContext\(\):humanContext\(\)/);
 const instruction=app.slice(app.indexOf('function updateInstructionResult'),app.indexOf('function updateResultContent'));
 assert.match(instruction,/durationResultWarning/);
 assert.doesNotMatch(app,/!instruction \? `\$\{durationChoices/);
});
test('coverage assets are mirrored and included in offline build/cache',async()=>{
 for(const path of ['duration-rules.js','duration-guidance.js','duration-view.js','app.js','sw.js'])
 assert.equal(await readFile(new URL(path,import.meta.url),'utf8'),await readFile(new URL('../public/rxcalc/'+path,import.meta.url),'utf8'));
 for(const file of ['sw.js','build.mjs'])assert.match(await readFile(new URL(file,import.meta.url),'utf8'),/'duration-rules.js'/);
});
