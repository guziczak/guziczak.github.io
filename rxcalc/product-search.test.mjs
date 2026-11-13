import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogueProducts, searchProducts, highlightSegments, searchMatchDetails } from './product-search.js';

const drugs = [{ id:'amox', name:'Amoksycylina', substance:'Amoxicillinum', searchTerms:['amoksycylina'], forms:[
  { id:'tablet',label:'Ospamox · 1000 mg',packOptions:[{id:'14',label:'14 tabl.',quantity:14},{id:'20',label:'20 tabl.',quantity:20}] },
  { id:'susp',label:'Ospamox · 250 mg/5 ml · zawiesina',packOptions:[{id:'100',label:'100 ml',quantity:100}] },
] },{id:'oral',name:'Płukanka',substance:'Chlorheksydyna',forms:[{id:'rinse',label:'Preparat · 0,05%',packOptions:[{id:'500',label:'500 ml',quantity:500}]}]}];

test('substance, strength and package tokens resolve the exact commercial variant', () => {
  const found=searchProducts(drugs,'amoksycylina 1000 14');
  assert.equal(found.length,1);
  assert.equal(found[0].key,'amox|tablet|14');
  assert.equal(found[0].pack.quantity,14);
});
test('brand search offers each documented package without silently selecting one', () => {
  assert.deepEqual(searchProducts(drugs,'Ospamox').map(row=>row.key),['amox|tablet|14','amox|tablet|20','amox|susp|100']);
});
test('search tolerates Polish accents and decimal separators', () => {
  assert.equal(searchProducts(drugs,'PLUKANKA 0.05 500')[0].form.id,'rinse');
});
test('search remains within the supplied specialty catalogue and does not mutate it', () => {
  const before=JSON.stringify(drugs);
  assert.equal(searchProducts([drugs[1]],'Ospamox').length,0);
  assert.equal(catalogueProducts([]).length,0);
  searchProducts(drugs,'1000');
  assert.equal(JSON.stringify(drugs),before);
});

test('highlighting preserves original Polish letters and decimal punctuation', () => {
  assert.deepEqual(highlightSegments('Płukanka · 0,05%', 'PLUK 0.05'), [
    {text:'Płuk',matched:true}, {text:'anka · ',matched:false},
    {text:'0,05',matched:true}, {text:'%',matched:false},
  ]);
  assert.deepEqual(highlightSegments('ŁÓDŹ', 'lodz'), [{text:'ŁÓDŹ',matched:true}]);
});

test('overlapping and repeated fragments produce merged original-text segments', () => {
  assert.deepEqual(highlightSegments('Amoksycylina / amoksycylina', 'amoks oksy AMOKS'), [
    {text:'Amoksy',matched:true}, {text:'cylina / ',matched:false},
    {text:'amoksy',matched:true}, {text:'cylina',matched:false},
  ]);
});

test('combining accents and non-BMP characters retain their exact original positions', () => {
  const original='🦷 Z\u0307ółć — a\u0301fta';
  const segments=highlightSegments(original,'zolc afta');
  assert.equal(segments.map(segment=>segment.text).join(''),original);
  assert.deepEqual(segments,[
    {text:'🦷 ',matched:false}, {text:'Z\u0307ółć',matched:true},
    {text:' — ',matched:false}, {text:'a\u0301fta',matched:true},
  ]);
});

test('regex syntax and HTML remain plain data rather than executable highlighting markup', () => {
  assert.deepEqual(highlightSegments('a.b + [mg]', '.'), [
    {text:'a',matched:false}, {text:'.',matched:true}, {text:'b + [mg]',matched:false},
  ]);
  assert.deepEqual(highlightSegments('100 mg', '[mg]*'), [
    {text:'100 ',matched:false}, {text:'mg',matched:true},
  ]);
  assert.deepEqual(highlightSegments('100 mg', '+('), [{text:'100 mg',matched:false}]);
  const original='<img src=x onerror=alert(1)> Ospamox & "test"';
  const segments=highlightSegments(original,'img ospamox');
  assert.equal(segments.map(segment=>segment.text).join(''),original);
  assert.deepEqual(segments.filter(segment=>segment.matched).map(segment=>segment.text),['img','Ospamox']);
  assert.equal(segments.every(segment=>Object.keys(segment).sort().join(',')==='matched,text'),true);
});

test('empty or unmatched queries do not invent highlights', () => {
  assert.deepEqual(highlightSegments('', 'x'), []);
  assert.deepEqual(highlightSegments('Ospamox', ''), [{text:'Ospamox',matched:false}]);
  assert.deepEqual(highlightSegments('Ospamox', 'other'), [{text:'Ospamox',matched:false}]);
  assert.deepEqual(searchMatchDetails(drugs[0], ''), []);
  assert.deepEqual(searchMatchDetails(null, 'x'), []);
});

test('Polish substance queries expose the matching catalogue name behind the commercial name', () => {
  const drug={id:'combination',name:'Amoksycylina + klawulanian',substance:'Amoxicillinum + Acidum clavulanicum',searchTerms:['amoksycylina','ropień'],forms:[{
    id:'susp',label:'Augmentin · 400 + 57 mg/5 ml',packOptions:[{id:'70',label:'70 ml'}],
  }]};
  const [row]=searchProducts([drug],'Amoksy');
  assert.deepEqual(searchMatchDetails(row.drug,'Amoksy',row.form,row.pack),[
    {kind:'name',label:'Nazwa',text:'Amoksycylina + klawulanian'},
  ]);
  assert.deepEqual(searchMatchDetails(drug,'ropien',row.form,row.pack),[
    {kind:'keyword',label:'Hasło',text:'ropień'},
  ]);
});

test('match details explain combined brand, strength, package and alias tokens without duplicates', () => {
  const [row]=searchProducts(drugs,'amoksycylina 1000 14');
  assert.deepEqual(searchMatchDetails(row.drug,'amoksycylina 1000 14',row.form,row.pack),[
    {kind:'product',label:'Preparat',text:'Ospamox · 1000 mg'},
    {kind:'package',label:'Opakowanie',text:'14 tabl.'},
    {kind:'name',label:'Nazwa',text:'Amoksycylina'},
  ]);
  assert.deepEqual(searchMatchDetails(row.drug,'Ospamox',row.form,row.pack),[
    {kind:'product',label:'Preparat',text:'Ospamox · 1000 mg'},
  ]);
});

test('explanations cover formulation-specific keywords and routes without leaking another formulation', () => {
  const drug={...drugs[0],forms:[
    {...drugs[0].forms[0],routeLabel:'doustnie',shortFormLabel:'tabletki',searchTerms:['przewlekłe']},
    {...drugs[0].forms[1],routeLabel:'doustnie',shortFormLabel:'zawiesina',searchTerms:['pediatryczny']},
  ]};
  const before=JSON.stringify(drug);
  assert.deepEqual(searchMatchDetails(drug,'DOUST table przewlek',drug.forms[0]),[
    {kind:'route',label:'Droga podania',text:'doustnie'},
    {kind:'keyword',label:'Postać',text:'tabletki'},
    {kind:'keyword',label:'Hasło',text:'przewlekłe'},
  ]);
  assert.deepEqual(searchMatchDetails(drug,'pediatryczny',drug.forms[0]),[]);
  assert.deepEqual(searchMatchDetails(drug,'250'),[
    {kind:'product',label:'Preparat',text:'Ospamox · 250 mg/5 ml · zawiesina'},
  ]);
  assert.equal(JSON.stringify(drug),before);
});
