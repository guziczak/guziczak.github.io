import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestWheelPosition, wheelReleaseVelocity, planWheelCoast, wheelPositionAt, createWheelMotion } from './wheel-motion.js';

test('release velocity follows the recent gesture and ignores a held finger', () => {
  const samples = [{ position:20, time:0 }, { position:60, time:120 }, { position:110, time:170 }, { position:140, time:200 }];
  assert.equal(wheelReleaseVelocity(samples, 220), 0.75);
  assert.equal(wheelReleaseVelocity(samples, 281), 0);
  assert.equal(wheelReleaseVelocity([{ position:0, time:0 }], 10), 0);
  assert.equal(wheelReleaseVelocity([{ position:100, time:0 }, { position:20, time:80 }], 90), -0.875);
  assert.equal(wheelReleaseVelocity([{ position:0, time:0 }, { position:1000, time:10 }], 10), 3.2);
});

test('normal flicks coast progressively for about a second and settle on exact rows', () => {
  for (const velocity of [-2, -1, -0.8, 0.8, 1, 2]) {
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

test('release velocity follows a final direction change instead of the earlier movement', () => {
  const samples=[{position:0,time:0},{position:80,time:40},{position:100,time:60},{position:90,time:80},{position:80,time:100}];
  assert.equal(wheelReleaseVelocity(samples,100),-0.5);
  assert.equal(wheelReleaseVelocity(samples.map(s=>({...s,position:-s.position})),100),0.5);
});

test('holding the finger still progressively removes momentum before release', () => {
  const samples=[{position:0,time:0},{position:40,time:40},{position:80,time:80}];
  const speeds=[80,100,120,159,160,200].map(time=>wheelReleaseVelocity(samples,time));
  assert.equal(speeds[0],1);
  for(let i=1;i<4;i++)assert.ok(speeds[i]<speeds[i-1]);
  assert.ok(speeds[3]<0.02);
  assert.equal(speeds[4],0);assert.equal(speeds[5],0);
});

test('controlled release speeds only centre the nearest row, without a sudden minimum fling', () => {
  for(const velocity of [-0.45,-0.4,-0.2,0,0.2,0.4,0.45]) {
    assert.equal(planWheelCoast({position:113,velocity,max:4400}).to,132);
  }
  assert.equal(planWheelCoast({position:440,velocity:0.46,max:4400}).to,440);
});

function fixture() {
  let clock=0,serial=0;
  const frames=new Map(),timers=new Map(),media=new EventTarget(),captures=new Set();
  media.matches=false;
  const win={ performance:{now:()=>clock}, matchMedia:()=>media,
    requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:(fn,delay)=>{timers.set(++serial,{fn,at:clock+delay});return serial;},clearTimeout:id=>timers.delete(id) };
  const node=new EventTarget();
  Object.assign(node,{ownerDocument:{defaultView:win},scrollTop:0,scrollHeight:4620,clientHeight:220,
    setPointerCapture(id){captures.add(id);},
    releasePointerCapture(pointerId){captures.delete(pointerId);send('lostpointercapture',{pointerId});},
    hasPointerCapture:id=>captures.has(id)});
  const send=(type,values={},target=node)=>{
    const event=new Event(type,{bubbles:true,cancelable:true});Object.assign(event,values);
    // Node's EventTarget has no DOM bubbling; preserve the originating row when
    // delivering an event to the wheel's listener, as a browser would do.
    if(target!==node)Object.defineProperty(event,'target',{value:target});
    node.dispatchEvent(event);return event;
  };
  const tick=time=>{clock=time;for(const [id,fn] of [...frames]){frames.delete(id);fn(time);}};
  const runTimers=time=>{clock=time;for(const [id,timer] of [...timers])if(timer.at<=time){timers.delete(id);timer.fn();}};
  const pointer=(type,y,pointerType='touch',target=node)=>send(type,{isPrimary:true,button:0,pointerId:1,clientY:y,pointerType},target);
  return {node,win,frames,timers,captures,send,tick,runTimers,pointer,setTime:time=>{clock=time;}};
}

test('slow one-row touch movements follow the finger and remain one row after release', () => {
  for(const duration of [250,500,1000])for(const direction of [-1,1]) {
    const f=fixture(), motion=createWheelMotion(f.node);
    f.node.scrollTop=440;f.pointer('pointerdown',200);
    for(let step=1;step<=4;step++) {
      f.setTime(duration*step/4);f.pointer('pointermove',200-direction*step*11);
      assert.equal(f.node.scrollTop,440+direction*step*11);
      f.send('scroll');assert.equal(f.timers.size,0);
    }
    f.pointer('pointerup',200-direction*44);f.tick(duration+1600);
    assert.equal(f.node.scrollTop,440+direction*44,`${duration}ms, direction ${direction}`);
    motion.destroy();
  }
});

test('small finger corrections do not start a long spin, even when their final sample is quick', () => {
  for(const [distance,duration] of [[7,35],[12,12]])for(const direction of [-1,1]) {
    const f=fixture(), motion=createWheelMotion(f.node);
    f.node.scrollTop=440;f.pointer('pointerdown',200);
    f.setTime(duration);f.pointer('pointermove',200-direction*distance);f.pointer('pointerup',200-direction*distance);
    f.tick(duration+1600);
    assert.equal(f.node.scrollTop,440,`${distance}px in ${duration}ms`);
    assert.equal(motion.isClickSuppressed(),false);
    motion.destroy();
  }
});

test('a short reverse correction does not restart momentum in the previous direction', () => {
  const f=fixture(), motion=createWheelMotion(f.node);
  f.node.scrollTop=440;f.pointer('pointerdown',200);
  for(const [time,y] of [[20,180],[40,160],[65,165],[90,170]]) {
    f.setTime(time);f.pointer('pointermove',y);
  }
  assert.equal(f.node.scrollTop,470);
  f.pointer('pointerup',170);f.tick(1700);
  assert.equal(f.node.scrollTop,484);
  motion.destroy();
});

test('a moving wheel can be caught and adjusted slowly without another unintended fling', () => {
  const f=fixture(), motion=createWheelMotion(f.node);
  f.pointer('pointerdown',200);f.setTime(50);f.pointer('pointermove',150);f.setTime(100);f.pointer('pointermove',100);f.pointer('pointerup',100);
  f.tick(200);assert.equal(f.frames.size,1);
  const caught=f.node.scrollTop;
  f.pointer('pointerdown',200);assert.equal(f.frames.size,0);
  for(let step=1;step<=4;step++) {
    f.setTime(200+250*step/4);f.pointer('pointermove',200-step*11);
    assert.equal(f.node.scrollTop,caught+step*11);
  }
  f.pointer('pointerup',156);f.tick(2100);
  assert.equal(f.node.scrollTop,nearestWheelPosition(caught+44,4400));
  motion.destroy();
});

test('the final finger position at pointerup completes a slow drag across the row midpoint', () => {
  const f=fixture(), motion=createWheelMotion(f.node);
  f.node.scrollTop=440;f.pointer('pointerdown',200);
  f.setTime(200);f.pointer('pointermove',180);assert.equal(f.node.scrollTop,460);
  f.setTime(300);f.pointer('pointerup',175);
  assert.equal(f.node.scrollTop,465);
  f.tick(1900);assert.equal(f.node.scrollTop,484);
  motion.destroy();
});

test('a finger keeps dragging and coasts after implicit capture transfers from a row to the wheel', () => {
  const f=fixture(), row=new EventTarget(), motion=createWheelMotion(f.node);
  f.node.scrollTop=440;
  // Touch starts with implicit capture on the row actually touched.
  f.pointer('pointerdown',200,'touch',row);
  f.send('gotpointercapture',{pointerId:1},row);
  f.setTime(30);f.pointer('pointermove',170,'touch',row);
  assert.equal(f.node.scrollTop,470);
  assert.equal(f.captures.has(1),true);

  // setPointerCapture on the wheel makes the old row lose capture. That event
  // bubbles through the wheel before its next pointermove, but is not a cancel.
  f.send('lostpointercapture',{pointerId:1},row);
  f.send('gotpointercapture',{pointerId:1});
  assert.equal(f.node.scrollTop,470);
  assert.equal(f.captures.has(1),true);
  f.setTime(70);const move=f.pointer('pointermove',130);
  assert.equal(move.defaultPrevented,true);
  assert.equal(f.node.scrollTop,510);

  f.setTime(90);f.pointer('pointerup',130);
  assert.equal(f.captures.size,0);
  assert.equal(f.frames.size,1);
  assert.equal(motion.isClickSuppressed(),true);
  f.tick(220);assert.ok(f.node.scrollTop>510);
  f.tick(1600);assert.equal(f.frames.size,0);assert.equal(f.node.scrollTop%44,0);
  motion.destroy();
});

test('losing capture on the wheel still stops dragging without starting a coast', () => {
  const f=fixture(), motion=createWheelMotion(f.node);
  f.node.scrollTop=440;
  f.pointer('pointerdown',200);f.setTime(30);f.pointer('pointermove',170);
  assert.equal(f.node.scrollTop,470);
  f.node.releasePointerCapture(1);
  assert.equal(f.node.scrollTop,484);
  assert.equal(f.captures.size,0);
  f.setTime(70);f.pointer('pointermove',130);f.pointer('pointerup',130);
  assert.equal(f.node.scrollTop,484);
  assert.equal(f.frames.size,0);
  motion.destroy();
});

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

test('desktop wheel interrupts custom inertia, preserves native scrolling and zoom, and snaps only after inactivity', () => {
  const f=fixture(), motion=createWheelMotion(f.node);
  f.pointer('pointerdown',200);f.setTime(50);f.pointer('pointermove',150);f.setTime(100);f.pointer('pointermove',100);f.pointer('pointerup',100);
  f.tick(200);
  const interrupted=f.node.scrollTop;
  const wheel=f.send('wheel',{deltaY:90,deltaMode:0,ctrlKey:false});
  assert.equal(wheel.defaultPrevented,false);
  assert.equal(f.frames.size,0);
  assert.equal(f.node.scrollTop,interrupted); // The browser, not the handler, applies deltaY.

  // Native wheel/trackpad scrolling can keep producing scroll events after wheel.
  f.node.scrollTop=113;f.send('scroll');
  f.setTime(300);f.node.scrollTop=145;f.send('scroll');
  f.runTimers(479);assert.equal(f.frames.size,0);assert.equal(f.node.scrollTop,145);
  f.runTimers(480);assert.equal(f.frames.size,1);
  f.tick(640);assert.equal(f.node.scrollTop,132);assert.equal(f.frames.size,0);
  f.send('scroll');assert.equal(f.timers.size,0); // The settled frame cannot restart a snap loop.

  const zoom=f.send('wheel',{deltaY:-50,deltaMode:0,ctrlKey:true});
  assert.equal(zoom.defaultPrevented,false);
  assert.equal(f.node.scrollTop,132);
  assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
  motion.destroy();
});

test('a left mouse click during inertia remains selectable, including slight pointer jitter', () => {
  const f=fixture(), motion=createWheelMotion(f.node);
  f.pointer('pointerdown',200);f.setTime(50);f.pointer('pointermove',150);f.setTime(100);f.pointer('pointermove',100);f.pointer('pointerup',100);
  f.tick(200);assert.equal(f.frames.size,1);
  const interrupted=f.node.scrollTop;
  f.pointer('pointerdown',100,'mouse');
  assert.equal(f.frames.size,0);
  f.setTime(210);const move=f.pointer('pointermove',95,'mouse');
  const up=f.pointer('pointerup',95,'mouse');
  assert.equal(move.defaultPrevented,false);assert.equal(up.defaultPrevented,false);
  assert.equal(f.captures.size,0);
  assert.equal(motion.isClickSuppressed(),false);
  assert.equal(f.node.scrollTop,interrupted);
  motion.setIndex(12);f.tick(2000);
  assert.equal(f.node.scrollTop,528);
  motion.destroy();
});

test('left mouse clicks remain selectable while native scrolling waits or animates its final snap', () => {
  for (const snapping of [false,true]) {
    const f=fixture(), motion=createWheelMotion(f.node);
    f.send('wheel',{deltaY:145,deltaMode:0});f.node.scrollTop=145;f.send('scroll');
    if (snapping) {f.runTimers(180);f.tick(200);assert.equal(f.frames.size,1);}
    else assert.equal(f.timers.size,1);
    f.setTime(210);f.pointer('pointerdown',100,'mouse');f.pointer('pointerup',100,'mouse');
    assert.equal(motion.isClickSuppressed(),false);
    assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);assert.equal(f.captures.size,0);
    motion.setIndex(4);f.runTimers(1000);f.tick(2000);
    assert.equal(f.node.scrollTop,176);
    motion.destroy();
  }
});

test('a real mouse drag captures the pointer and suppresses its ghost click', () => {
  const f=fixture(), motion=createWheelMotion(f.node);
  f.pointer('pointerdown',200,'mouse');f.setTime(30);f.pointer('pointermove',188,'mouse');
  assert.equal(f.captures.size,1);
  f.setTime(60);f.pointer('pointermove',170,'mouse');
  const up=f.pointer('pointerup',170,'mouse');
  assert.equal(up.defaultPrevented,true);
  assert.equal(f.captures.size,0);
  assert.equal(motion.isClickSuppressed(),true);
  assert.equal(f.frames.size,1);
  motion.destroy();
});

test('a touch tap during a coast still stops the wheel before a second tap selects', () => {
  const f=fixture(), motion=createWheelMotion(f.node);
  f.pointer('pointerdown',200);f.setTime(50);f.pointer('pointermove',150);f.setTime(100);f.pointer('pointermove',100);f.pointer('pointerup',100);
  f.tick(200);
  f.pointer('pointerdown',100);f.pointer('pointerup',100);
  assert.equal(motion.isClickSuppressed(),true);
  f.tick(400);
  f.pointer('pointerdown',100);f.pointer('pointerup',100);
  assert.equal(motion.isClickSuppressed(),false);
  motion.destroy();
});
