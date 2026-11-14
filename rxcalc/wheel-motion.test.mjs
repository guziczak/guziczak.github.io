import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestWheelPosition, wheelReleaseVelocity, planWheelCoast, wheelPositionAt, createWheelMotion } from './wheel-motion.js';

test('release velocity follows the recent gesture and ignores a held finger', () => {
  const samples = [{ position:20, time:0 }, { position:60, time:120 }, { position:110, time:170 }, { position:140, time:200 }];
  assert.equal(wheelReleaseVelocity(samples, 220), 1);
  assert.equal(wheelReleaseVelocity(samples, 281), 0);
  assert.equal(wheelReleaseVelocity([{ position:0, time:0 }], 10), 0);
  assert.equal(wheelReleaseVelocity([{ position:100, time:0 }, { position:20, time:80 }], 90), -1);
  assert.equal(wheelReleaseVelocity([{ position:0, time:0 }, { position:1000, time:10 }], 10), 3.2);
});

test('normal flicks coast progressively for about a second and settle on exact rows', () => {
  for (const velocity of [-2, -1, -0.4, 0.4, 1, 2]) {
    const plan = planWheelCoast({ position:4400, velocity, max:22000 });
    assert.ok(plan.duration >= 800 && plan.duration <= 1400);
    assert.equal(plan.to % 44, 0);
    assert.equal(Math.sign(plan.to - plan.from), Math.sign(velocity));
    const firstQuarter = Math.abs(wheelPositionAt(plan, plan.duration / 4) - plan.from);
    const lastQuarter = Math.abs(plan.to - wheelPositionAt(plan, plan.duration * 3 / 4));
    assert.ok(firstQuarter > lastQuarter * 10);
  }
});

test('short or reduced-motion gestures snap nearby without a distant fling', () => {
  const slow = planWheelCoast({ position:113, velocity:0.1, max:4400 });
  assert.deepEqual(slow, { from:113, to:132, duration:160 });
  const reduced = planWheelCoast({ position:113, velocity:3, max:4400, reducedMotion:true });
  assert.deepEqual(reduced, { from:113, to:132, duration:0 });
});

test('coasting never wraps or overshoots either boundary', () => {
  for (const [position, velocity, target] of [[10,-3,0],[4350,3,4400],[0,-1,0],[4400,1,4400]]) {
    const plan = planWheelCoast({ position, velocity, max:4400 });
    assert.equal(plan.to, target);
    for (let time = 0; time <= 1600; time += 13) assert.ok(wheelPositionAt(plan,time) >= 0 && wheelPositionAt(plan,time) <= 4400);
  }
  assert.equal(nearestWheelPosition(-100,4400),0);
  assert.equal(nearestWheelPosition(9000,4400),4400);
});

test('frame rate does not change the path or final value', () => {
  const plan = planWheelCoast({ position:400, velocity:1.2, max:4400 });
  const sample = step => {
    let position;
    for(let time=0; time<plan.duration; time+=step)position=wheelPositionAt(plan,time);
    return wheelPositionAt(plan,plan.duration);
  };
  assert.equal(sample(1000/60),sample(1000/120));
  assert.equal(wheelPositionAt(plan,plan.duration+200),plan.to);
  assert.equal(wheelPositionAt(plan,0),plan.from);
});

function fixture() {
  let clock=0,serial=0;
  const frames=new Map(),timers=new Map(),media=new EventTarget();
  media.matches=false;
  const win={ performance:{now:()=>clock}, matchMedia:()=>media,
    requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id) };
  const node=new EventTarget();
  Object.assign(node,{ownerDocument:{defaultView:win},scrollTop:0,scrollHeight:4620,clientHeight:220,
    setPointerCapture(){},releasePointerCapture(){},hasPointerCapture(){return false;}});
  const send=(type,values={})=>{const event=new Event(type,{cancelable:true});Object.assign(event,values);node.dispatchEvent(event);};
  const tick=time=>{clock=time;for(const [id,fn] of [...frames]){frames.delete(id);fn(time);}};
  const pointer=(type,y)=>send(type,{isPrimary:true,button:0,pointerId:1,clientY:y});
  return {node,win,frames,timers,send,tick,pointer,setTime:time=>{clock=time;}};
}

test('Done interrupts momentum at the currently visible row, and close cancels later frames', () => {
  const f=fixture(), motion=createWheelMotion(f.node);
  f.pointer('pointerdown',200);f.setTime(50);f.pointer('pointermove',150);f.setTime(100);f.pointer('pointermove',100);f.pointer('pointerup',100);
  assert.equal(f.frames.size,1);
  f.tick(200);
  const visible=nearestWheelPosition(f.node.scrollTop,4400);
  motion.finish();assert.equal(f.node.scrollTop,visible);assert.equal(f.frames.size,0);
  f.tick(2000);assert.equal(f.node.scrollTop,visible);
  motion.setIndex(3);assert.equal(f.node.scrollTop,132);
  motion.destroy();f.node.scrollTop=143;f.send('scroll');assert.equal(f.timers.size,0);
});

test('dragging suppresses the synthetic click while an ordinary tap stays selectable', () => {
  const f=fixture(), motion=createWheelMotion(f.node);
  f.pointer('pointerdown',100);f.pointer('pointerup',100);assert.equal(motion.isClickSuppressed(),false);
  f.setTime(100);f.pointer('pointerdown',200);f.setTime(140);f.pointer('pointermove',150);f.pointer('pointerup',150);
  assert.equal(motion.isClickSuppressed(),true);
  motion.finish();f.setTime(180);f.pointer('pointerdown',100);f.pointer('pointerup',100);
  assert.equal(motion.isClickSuppressed(),false);
  motion.destroy();
});

test('native scroll waits for inactivity and an explicit selection cancels its pending snap', () => {
  const f=fixture(), motion=createWheelMotion(f.node);
  f.node.scrollTop=113;f.send('scroll');assert.equal(f.timers.size,1);
  motion.setIndex(10);assert.equal(f.node.scrollTop,440);assert.equal(f.timers.size,0);
  motion.destroy();
});
