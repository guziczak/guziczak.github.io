import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { DRUGS } from './catalogue.js';
import { HUMAN_REGIMENS } from './human-regimens.js';
import { calculate, formatNumber } from './engine.js';
import { resolveHumanRegimen } from './human-regimen-engine.js';
import { tabletDoseChoices } from './tablet-doses.js';

const form = DRUGS.find(drug => drug.id === 'paracetamol').forms.find(item => item.id === 'metafen-paracetamol-500');
const source = HUMAN_REGIMENS.find(item => item.id === 'dental-metafen-paracetamol-over12-over50');
const choicesAt = frequency => tabletDoseChoices(form, { source, frequency });

test('paracetamol 1000 mg × 5 stays selectable with the exact 5000/4000 daily-limit warning', () => {
  const excess = choicesAt(5).find(choice => choice.tablets === 2);
  assert.equal(excess.value, 1000);
  assert.equal(excess.allowed, true);
  assert.equal(excess.withinLimits, false);
  assert.equal(excess.severity, 'critical');
  assert.equal(excess.reason, 'Ponad limit dobowy');
  assert.deepEqual(excess.warnings, [{ code:'daily-limit', severity:'critical', message:excess.reason,
    actual:5000, limit:4000, unit:'mg/dobę' }]);

  const atLimit = choicesAt(4).find(choice => choice.tablets === 2);
  assert.equal(atLimit.allowed, true);
  assert.equal(atLimit.withinLimits, true);
  assert.equal(atLimit.severity, null);
  assert.equal(atLimit.reason, '');
  assert.deepEqual(atLimit.warnings, []);

  for (const frequency of [4, 5]) {
    const half = choicesAt(frequency).find(choice => choice.tablets === 0.5);
    assert.equal(half.allowed, false, 'the actual formulation cannot be split');
    assert.equal(half.withinLimits, false);
    assert.equal(half.reason, 'Brak podziału na połowy');
    assert.deepEqual(half.warnings, []);
  }
});

test('selectable 5000 mg still fails both the arithmetic limit and real source validation', () => {
  for (const frequency of [4, 5]) {
    const choice = choicesAt(frequency).find(item => item.tablets === 2);
    assert.equal(choice.allowed, true);
    const context = { formId:form.id, specialty:'dental', patientType:'adult', age:35, ageUnit:'years',
      weight:70, dose:choice.value, frequency, days:1 };
    const result = calculate({ ...form, patientKind:'human', doseMode:'fixed', dose:choice.value,
      frequency, weight:70, age:35, days:1, packageSize:form.packOptions[0].quantity,
      maxSingleMg:source.maxSingleMg, maxDailyMg:source.maxDailyMg });
    const sourceCheck = resolveHumanRegimen(source, context, { allowNumericOverrides:true });
    assert.equal(result.dailyMg, frequency * 1000);
    assert.equal(result.valid, frequency === 4);
    assert.equal(sourceCheck.valid, frequency === 4);
    if (frequency === 5) {
      assert.equal(result.status, 'critical');
      assert.ok(result.errors.some(error => /5000/.test(error) && /4000/.test(error)));
      assert.ok(sourceCheck.errors.some(error => /Dawka dobowa przekracza limit/.test(error)));
    }
  }
});

test('range deviations remain selectable with warning below and critical above', () => {
  const divisible = { form:'tablet', strengthMg:500, allowedFractions:[0.5, 1] };
  const range = { doseMode:'fixed', doseRange:{ min:500, max:750 } };
  const choices = tabletDoseChoices(divisible, { source:range });
  assert.deepEqual(choices.map(choice => [choice.tablets, choice.allowed, choice.withinLimits, choice.severity]), [
    [2, true, false, 'critical'], [1, true, true, null], [0.5, true, false, 'warning'],
  ]);
  assert.deepEqual(choices[0].warnings.map(warning => warning.code), ['above-range']);
  assert.deepEqual(choices[2].warnings.map(warning => warning.code), ['below-range']);
});

test('editable fixed-source amounts flag deviations without silently becoming compliant', () => {
  const divisible = { form:'tablet', strengthMg:500, allowedFractions:[0.5, 1] };
  const fixed = { doseMode:'fixed', dose:500, frequency:2 };
  assert.deepEqual(tabletDoseChoices(divisible, { source:fixed }), []);
  const choices = tabletDoseChoices(divisible, { source:fixed, allowFixedSource:true });
  assert.deepEqual(choices.map(choice => [choice.tablets, choice.allowed, choice.withinLimits, choice.severity]), [
    [2, true, false, 'critical'], [1, true, true, null], [0.5, true, false, 'warning'],
  ]);
  assert.deepEqual(choices[0].warnings.map(warning => warning.code), ['above-source']);
  assert.deepEqual(choices[2].warnings.map(warning => warning.code), ['below-source']);
});

test('a concrete ceiling takes priority even when the same dose is below the source range', () => {
  const divisible = { form:'tablet', strengthMg:500, allowedFractions:[0.5, 1] };
  const range = { doseMode:'fixed', doseRange:{ min:750, max:1000 }, frequency:2 };
  for (const options of [{ maxSingleMg:400 }, { maxSingleMg:400, maxDailyMg:800 }]) {
    const choice = tabletDoseChoices(divisible, { source:range, ...options }).find(item => item.tablets === 1);
    assert.equal(choice.allowed, true);
    assert.equal(choice.withinLimits, false);
    assert.equal(choice.severity, 'critical');
    assert.ok(choice.warnings.some(warning => warning.code === 'below-range' && warning.severity === 'warning'));
    const primary = choice.warnings.find(warning => warning.message === choice.reason);
    assert.equal(primary.code, options.maxDailyMg ? 'daily-limit' : 'single-limit');
  }
});

// Exercise the actual private app functions, without booting unrelated catalogue,
// service-worker or browser services. Only DOM button primitives are supplied.
const appText = await readFile(new URL('./app.js', import.meta.url), 'utf8');
const prefillFunction = appText.match(/function prefillSourceTabletDose\(\)\s*\{[\s\S]*?\n\}/)?.[0];
const tabletStart = appText.indexOf('const tabletChoiceLabel =');
const tabletEnd = appText.indexOf('\nfunction highlightedSearchText(', tabletStart);
const primitives = appText.match(/^const (?:esc|num) = .+;$/gm)?.join('\n');
assert.ok(prefillFunction && tabletStart >= 0 && tabletEnd > tabletStart && primitives);

function appFixture({ frequency = 5, dose = '1000', maxDailyMg = null } = {}) {
  const state = { frequency, dose, custom:false };
  const choices = () => tabletDoseChoices(form, { source, frequency:state.frequency, maxDailyMg });
  let buttons = [];
  const slot = { querySelectorAll:() => buttons };
  const api = runInNewContext(`${primitives}\n${prefillFunction}\n${appText.slice(tabletStart, tabletEnd)}
    ({ render:tabletDoseChoicesMarkup, update:updateTabletDoseButtons, prefill:prefillSourceTabletDose });`, {
    state, n:formatNumber, getForm:() => form, getSourceRegimen:() => source,
    isVeterinary:() => false, doseUnit:() => 'mg', currentTabletDoseChoices:choices,
    document:{ querySelector:selector => selector === '.tablet-dose-slot' ? slot : null },
  });
  return { state, choices, ...api,
    mount() {
      const markup = api.render(choices());
      buttons = [...markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([, attributes, content]) => {
        const attrs = Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
        const classes = new Set(attrs.class.split(/\s+/).filter(Boolean));
        const children = Object.fromEntries(['amount', 'reason', 'detail'].map(name => {
          const textContent = new RegExp(`class="tablet-dose-${name}">([^<]*)<`).exec(content)?.[1] || '';
          return [`.tablet-dose-${name}`, { textContent }];
        }));
        children['.tablet-dose-icon'] = { dataset:{ splittable:/data-splittable="([^"]*)"/.exec(content)?.[1] } };
        return { attrs, classes, dataset:{ value:attrs['data-value'] },
          disabled:/(?:^|\s)disabled(?:\s|$)/.test(attributes), title:attrs.title,
          classList:{ toggle(name, active) { active ? classes.add(name) : classes.delete(name); } },
          setAttribute(name, value) { attrs[name] = value; },
          querySelector:selector => children[selector],
        };
      });
      assert.equal(buttons.length, 3);
      return buttons;
    },
  };
}

test('initial and live tablet UI keep 1000 mg selected and enabled while 5→4→5 toggles critical feedback', () => {
  const fixture = appFixture();
  const buttons = fixture.mount();
  const selected = buttons.find(button => button.dataset.value === '2');
  const half = buttons.find(button => button.dataset.value === '0.5');
  for (const frequency of [5, 4, 5]) {
    if (fixture.state.frequency !== frequency) {
      fixture.state.frequency = frequency;
      fixture.update();
    }
    assert.equal(selected.disabled, false);
    assert.equal(selected.classes.has('active'), true);
    assert.equal(selected.attrs['aria-pressed'], 'true');
    assert.equal(selected.classes.has('tablet-dose-critical'), frequency === 5);
    assert.equal(selected.classes.has('tablet-dose-warning'), false);
    assert.equal(selected.querySelector('.tablet-dose-amount').textContent, '1000');
    assert.equal(selected.querySelector('.tablet-dose-reason').textContent, frequency === 5 ? 'Ponad limit dobowy' : '');
    assert.equal(selected.querySelector('.tablet-dose-detail').textContent, frequency === 5 ? '5000 mg/dobę · limit 4000' : '');
    assert.equal(half.disabled, true);
    assert.equal(half.attrs['aria-pressed'], 'false');
    assert.equal(fixture.state.dose, '1000', 'changing frequency must not replace the selected dose');
  }
});

test('actual source prefill chooses a compliant whole tablet but never an active warning', () => {
  const safe = appFixture({ frequency:4, dose:'' });
  safe.prefill();
  assert.equal(safe.state.dose, '500');

  // A caller may apply a stricter patient-specific cap. The whole tablet stays
  // selectable, but 500 mg × 4 exceeds that cap and must not fill an empty field.
  const excess = appFixture({ frequency:4, dose:'', maxDailyMg:1500 });
  const whole = excess.choices().find(choice => choice.tablets === 1);
  assert.equal(whole.allowed, true);
  assert.equal(whole.withinLimits, false);
  assert.equal(whole.severity, 'critical');
  excess.prefill();
  assert.equal(excess.state.dose, '');

  const entered = appFixture({ frequency:5, dose:'1000' });
  entered.prefill();
  assert.equal(entered.state.dose, '1000');
});
