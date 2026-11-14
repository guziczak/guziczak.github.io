import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bindPickerDismissal} from './patient-picker.js';

function fixture() {
  const input={}, label={}, triggerChild={}, outside={};
  const dialog={contains:target=>[dialog,input,label].includes(target)};
  const trigger={contains:target=>[trigger,triggerChild].includes(target)};
  const doc=new EventTarget();
  const calls=[];
  const unbind=bindPickerDismissal({dialog,trigger,doc,dismiss:restore=>calls.push(restore)});
  const send=(type,target=outside,values={})=>{
    const event=new Event(type,{cancelable:true});
    Object.defineProperty(event,'target',{value:target});
    Object.assign(event,{detail:1,isPrimary:true,button:0,pointerId:1,clientX:100,clientY:100,...values});
    doc.dispatchEvent(event);return event;
  };
  return {dialog,trigger,input,label,triggerChild,outside,doc,calls,send,unbind};
}

test('ordinary outside click cancels without claiming focus or blocking the click',()=>{
  const f=fixture();f.send('pointerdown');const click=f.send('click');
  assert.deepEqual(f.calls,[false]);assert.equal(click.defaultPrevented,false);f.unbind();
});
test('interactions in the editor or its trigger do not dismiss it',()=>{
  const f=fixture();
  for(const target of [f.dialog,f.input,f.label,f.trigger,f.triggerChild]) {
    f.send('pointerdown',target);f.send('click',target);f.send('focusin',target);
  }
  assert.deepEqual(f.calls,[]);f.unbind();
});
test('scrolling the page keeps the editor open and does not prevent the event',()=>{
  const f=fixture();f.send('pointerdown');
  assert.equal(f.send('scroll',f.doc).defaultPrevented,false);
  f.send('click');assert.deepEqual(f.calls,[]);f.unbind();
});
test('wheel scrolling outside neither cancels nor consumes the gesture',()=>{
  const f=fixture();assert.equal(f.send('wheel').defaultPrevented,false);
  assert.deepEqual(f.calls,[]);f.unbind();
});
test('touch drag and pointer cancellation cannot turn into outside dismissal',()=>{
  for(const end of ['pointermove','pointercancel']) {
    const f=fixture();f.send('pointerdown');f.send(end,f.outside,{clientY:140});f.send('click');
    assert.deepEqual(f.calls,[]);f.unbind();
  }
});
test('release outside after starting a gesture in the editor never dismisses',()=>{
  const f=fixture();f.send('pointerdown',f.input);f.send('click');
  assert.deepEqual(f.calls,[]);f.unbind();
});
test('secondary pointer and right click do not dismiss',()=>{
  for(const values of [{isPrimary:false},{button:2}]) {
    const f=fixture();f.send('pointerdown',f.outside,values);f.send('click');
    assert.deepEqual(f.calls,[]);f.unbind();
  }
});
test('keyboard-generated outside click works without a pointer sequence',()=>{
  const f=fixture();f.send('click',f.outside,{detail:0});
  assert.deepEqual(f.calls,[false]);f.unbind();
});
test('leaving by keyboard or focusing another field is allowed without committing',()=>{
  const f=fixture();const tab=f.send('keydown',f.input,{key:'Tab'});
  assert.equal(tab.defaultPrevented,false);assert.deepEqual(f.calls,[]);
  f.send('focusin');assert.deepEqual(f.calls,[false]);f.unbind();
});
test('Escape explicitly cancels and requests focus restoration; IME Escape is ignored',()=>{
  const f=fixture();f.send('keydown',f.input,{key:'Escape',isComposing:true});
  assert.deepEqual(f.calls,[]);
  const escape=f.send('keydown',f.input,{key:'Escape'});
  assert.equal(escape.defaultPrevented,true);assert.deepEqual(f.calls,[true]);f.unbind();
});
test('closing removes all document listeners, including across repeated openings',()=>{
  const f=fixture();f.unbind();f.unbind();
  for(const type of ['pointerdown','pointermove','pointercancel','scroll','click','focusin','keydown'])
    f.send(type,f.outside,{key:'Escape'});
  assert.deepEqual(f.calls,[]);
});
test('the picker uses a non-modal dialog, no page scroll lock and no blurred backdrop',async()=>{
  const js=await readFile(new URL('patient-picker.js',import.meta.url),'utf8');
  const css=await readFile(new URL('patient-picker.css',import.meta.url),'utf8');
  assert.match(js,/dialog\.show\(\)/);assert.doesNotMatch(js,/\.showModal\(/);
  assert.match(js,/setAttribute\('aria-modal', 'false'\)/);
  assert.doesNotMatch(js+css,/patient-picker-open/);
  assert.match(css,/\.patient-picker::backdrop\{background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none\}/);
  assert.match(js,/session\.unbindDismissal\?\.\(\)/);
  assert.match(js,/const rect = session\.anchorRect/);
});
