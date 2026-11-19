import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { resolveHumanRegimen } from './human-regimen-engine.js';
import { ingredientDailyDose } from './daily-dose.js';
import { dailyDoseMarkup, dailyDoseMotionContext, renderDailyDoseNote } from './dose-safety-view.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

function preview(frequency, { formId = 'ibuprom-200', sourceId = 'dental-ibuprom-200-over12', dose = 200, limit = null } = {}) {
  const drug = DRUGS.find(item => item.forms.some(form => form.id === formId));
  const form = drug.forms.find(item => item.id === formId);
  const source = HUMAN_REGIMENS.find(item => item.id === sourceId);
  const context = { formId, specialty:'dental', patientType:'adult', age:35, ageUnit:'years', weight:70, dose, frequency, days:1 };
  const sourceCheck = resolveHumanRegimen(source, context);
  assert.equal(sourceCheck.valid, true, sourceCheck.errors.join(' '));
  const input = { ...form, patientKind:'human', doseMode:source.doseMode, dose, frequency,
    weight:70, age:35, days:1, packageSize:form.packOptions[0].quantity };
  const note = ingredientDailyDose({ form, drug, input, source, sourceCheck, limit });
  const value = { note, form, source, input, specialty:'dental', patientType:'adult', species:null };
  return { ...value, markup:dailyDoseMarkup({ ...value, eligibility:sourceCheck }), context:dailyDoseMotionContext(value) };
}

// A small layout/WAAPI fixture consumes the actual generated markup. Only the
// browser geometry is simulated: 2/3 px centred boundaries and 76 px clamped
// labels, on a track with a nonzero page offset. No dose/scale model is mocked.
function motionFixture({ width = 300, reduced = false } = {}) {
  const calls = [], listeners = new Set();
  const media = { matches:reduced, addEventListener:(_, fn) => listeners.add(fn), removeEventListener:(_, fn) => listeners.delete(fn) };
  const track = { getBoundingClientRect:() => ({ left:113, width, height:24 }) };
  let rows = [], markup = '';
  const matches = (element, selector) => selector.split(',').some(part => element.className.split(/\s+/).includes(part.trim().slice(1)));
  const position = value => {
    if (!value) return 0;
    const clamp = /^clamp\(38px,([\d.]+)%,calc\(100% - 38px\)\)$/.exec(value);
    return clamp ? Math.max(38, Math.min(width - 38, Number(clamp[1]) / 100 * width)) / width * 100 : Number.parseFloat(value);
  };
  const node = {
    ownerDocument:{ defaultView:{ matchMedia:() => media }, timeline:{ currentTime:1250 } },
    querySelectorAll:selector => selector === '.dose-safety-row' ? rows : rows.flatMap(row => row.querySelectorAll(selector)),
    get innerHTML() { return markup; },
    set innerHTML(value) {
      markup = value;
      rows = [...value.matchAll(/<div class="dose-safety-row">([\s\S]*?)<\/dd><\/div>/g)].map(([, content], rowIndex) => {
        const elements = [...content.matchAll(/<span\b([^>]*)>/g)].map(([, attributes]) => {
          const attrs = Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, text]) => [key, text]));
          if (!/^dose-scheme-(?:fill|band|marker|wall|tick)$/.test(attrs.class || '')) return null;
          const style = Object.fromEntries((attrs.style || '').split(';').filter(Boolean).map(entry => {
            const split = entry.indexOf(':'); return [entry.slice(0, split), entry.slice(split + 1)];
          }));
          const centered = ['dose-scheme-marker', 'dose-scheme-wall', 'dose-scheme-tick'].includes(attrs.class);
          const element = {
            className:attrs.class, dataset:{ doseMotion:attrs['data-dose-motion'] }, style, parentElement:track, visible:{},
            key:`${rowIndex}:${attrs['data-dose-motion'] || attrs.class}`,
            getBoundingClientRect() {
              const elementWidth = this.visible.width !== undefined ? this.visible.width / 100 * width
                : this.className === 'dose-scheme-tick' ? Math.min(76, width * .38)
                  : this.className === 'dose-scheme-marker' ? 2 : this.className === 'dose-scheme-wall' ? 3
                    : position(this.style.width) / 100 * width;
              const left = this.visible.left ?? position(this.style.left);
              return { left:113 + left / 100 * width - (centered ? elementWidth / 2 : 0), width:elementWidth, height:12 };
            },
            animate(frames, options) {
              const element = this;
              let finish;
              const animation = { key:this.key, frames, options, cancelled:false,
                finished:new Promise(resolve => { finish = resolve; }),
                cancel() { this.cancelled = true; element.visible = {}; finish(); },
                finish() { element.visible = {}; finish(); },
              };
              this.visible = Object.fromEntries(Object.entries(frames[0]).map(([key, value]) => [key, Number.parseFloat(value)]));
              calls.push(animation);
              return animation;
            },
          };
          return element;
        }).filter(Boolean);
        return { elements, querySelector:selector => selector === 'dt' ? { textContent:/<dt>([\s\S]*?)<\/dt>/.exec(content)?.[1] } : null,
          querySelectorAll:selector => elements.filter(element => matches(element, selector)) };
      });
    },
  };
  return { node, calls, media, listeners,
    render(value) { renderDailyDoseNote(node, value.markup, value.context); },
    element(role, row = 0) { return rows[row]?.elements.find(element => (element.dataset.doseMotion || element.className) === role); },
  };
}

function transition(fixture, role, property, from, to, row = 0) {
  const animation = fixture.calls.findLast(item => item.key === `${row}:${role}`);
  assert.ok(animation, `Missing animation of ${role}`);
  assert.match(animation.frames[0][property], /^-?[\d.]+%$/);
  assert.match(animation.frames[1][property], /^-?[\d.]+%$/);
  close(Number.parseFloat(animation.frames[0][property]), from);
  close(Number.parseFloat(animation.frames[1][property]), to);
  assert.equal(animation.options.duration, 240);
  assert.equal(animation.options.easing, 'ease-out');
  assert.equal(animation.options.delay || 0, 0);
  assert.equal(animation.startTime, fixture.node.ownerDocument.timeline.currentTime);
  return animation;
}

test('Ibuprom PRN frequency edits keep the comparison identity while changing real daily bounds', () => {
  const one = preview(1), two = preview(2), three = preview(3);
  assert.deepEqual([one, two, three].map(value => value.note.rows[0].daily), [200, 400, 600]);
  assert.deepEqual([one, two, three].map(value => value.note.schemeRows[0].maximum), [400, 800, 1200]);
  assert.deepEqual([one, two, three].map(value => value.note.schemeRows[0].kind), ['asNeeded', 'asNeeded', 'asNeeded']);
  assert.equal(one.context, two.context);
  assert.equal(one.context, three.context);
  const before = structuredClone(two.note);
  dailyDoseMotionContext(two);
  assert.deepEqual(two.note, before);
});

test('Ibuprom 1→2 and 3→1 animate the fill, source boundary and 100% label together', () => {
  for (const [from, to] of [[1, 2], [3, 1]]) {
    const fixture = motionFixture();
    fixture.render(preview(from));
    assert.equal(fixture.calls.length, 0);
    fixture.render(preview(to));
    transition(fixture, 'dose-scheme-fill', 'width', from * 200 / 1500 * 100, to * 200 / 1500 * 100);
    transition(fixture, 'end', 'left', from * 400 / 1500 * 100, to * 400 / 1500 * 100);
    transition(fixture, 'tick-end', 'left', from * 400 / 1500 * 100, to * 400 / 1500 * 100);
    assert.match(fixture.node.innerHTML, new RegExp(`<strong>${to * 200} <span>mg/dobę`));
    assert.equal(new Set(fixture.calls.map(animation => animation.startTime)).size, 1);
  }
});

test('a rapid reverse edit starts from each visible position before cancelling prior motion', () => {
  const fixture = motionFixture();
  fixture.render(preview(1));
  fixture.render(preview(3));
  const old = [...fixture.calls];
  fixture.element('dose-scheme-fill').visible.width = 24;
  fixture.element('end').visible.left = 48;
  fixture.element('tick-end').visible.left = 48;
  fixture.render(preview(1));
  assert.ok(old.every(animation => animation.cancelled));
  transition(fixture, 'dose-scheme-fill', 'width', 24, 200 / 1500 * 100);
  transition(fixture, 'end', 'left', 48, 400 / 1500 * 100);
  transition(fixture, 'tick-end', 'left', 48, 400 / 1500 * 100);
});

test('a real source range moves both band edges and separate manual limits move their own wall', () => {
  const options = { formId:'tantum-verde-spray', sourceId:'tantum-spray-over12', dose:4 };
  const fixture = motionFixture();
  fixture.render(preview(2, options));
  fixture.render(preview(3, options));
  const band = transition(fixture, 'dose-scheme-band', 'left', 80 * 8 / 48, 80 * 12 / 48);
  assert.equal(transition(fixture, 'dose-scheme-band', 'width', 80 * 8 / 48, 80 * 12 / 48), band);
  transition(fixture, 'start', 'left', 80 * 8 / 48, 80 * 12 / 48);
  transition(fixture, 'end', 'left', 80 * 16 / 48, 80 * 24 / 48);
  transition(fixture, 'tick-range', 'left', 80 * 12 / 48, 80 * 18 / 48);

  const limits = motionFixture();
  const lower = preview(3, { limit:{ daily:800, kind:'manual' } });
  const higher = preview(3, { limit:{ daily:1000, kind:'manual' } });
  assert.equal(lower.context, higher.context);
  limits.render(lower); limits.render(higher);
  transition(limits, 'dose-scheme-wall', 'left', 800 / 1500 * 100, 1000 / 1500 * 100);
});

test('narrow layouts animate to the clamped label centre, without moving the actual boundary', () => {
  const fixture = motionFixture({ width:120 });
  fixture.render(preview(3));
  fixture.render(preview(1));
  transition(fixture, 'end', 'left', 80, 400 / 1500 * 100);
  transition(fixture, 'tick-end', 'left', 82 / 120 * 100, 38 / 120 * 100);
  assert.match(fixture.element('tick-end').style.left, /^clamp\(/);
});

test('reduced motion cancels every moving part and renders later values immediately', () => {
  const fixture = motionFixture();
  fixture.render(preview(1)); fixture.render(preview(2));
  assert.ok(fixture.calls.length >= 3);
  fixture.media.matches = true;
  for (const listener of [...fixture.listeners]) listener({ matches:true });
  assert.ok(fixture.calls.every(animation => animation.cancelled));
  assert.equal(fixture.listeners.size, 0);
  const count = fixture.calls.length;
  fixture.render(preview(3));
  assert.equal(fixture.calls.length, count);
  assert.equal(fixture.node.innerHTML, preview(3).markup);
  const initial = motionFixture({ reduced:true });
  initial.render(preview(1)); initial.render(preview(2));
  assert.equal(initial.calls.length, 0);
});

test('another medicine, source or measurement unit resets motion instead of morphing comparisons', () => {
  const one = preview(1), two = preview(2);
  const differentDrug = preview(2, { formId:'tantum-verde-spray', sourceId:'tantum-spray-over12', dose:4 });
  const differentSource = { ...two, source:HUMAN_REGIMENS.find(item => item.id === 'dental-ibuprom-200-child10to12') };
  const differentUnit = { ...two, note:{ ...two.note, rows:two.note.rows.map(row => ({ ...row, unit:'j.m.' })) } };
  for (const next of [differentDrug, differentSource, differentUnit]) {
    const fixture = motionFixture();
    fixture.render(one); fixture.render(two);
    const count = fixture.calls.length;
    const context = dailyDoseMotionContext(next);
    assert.notEqual(context, two.context);
    fixture.render({ ...next, context });
    assert.equal(fixture.calls.length, count);
    assert.ok(fixture.calls.every(animation => animation.cancelled));
    assert.equal(fixture.node.innerHTML, next.markup);
  }
});
