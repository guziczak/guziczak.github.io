import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogueProducts, searchProducts } from './product-search.js';

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
