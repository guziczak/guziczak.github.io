'use strict';

// Run with: node --test "4lapy4/tools/*.test.cjs"
// Guards the generated pages: they must be current, structurally identical in both
// languages, internally consistent, and in step with the opening hours in site.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build, hourGroups } = require('./build.cjs');
const site = require('../site.js');

const root = path.join(__dirname, '..');
const disk = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const pages = build();
const content = JSON.parse(disk('src/content.json'));
const css = disk('styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
const LANGUAGES = { pl: 'index.html', en: 'en/index.html' };

// Attributes whose values are translated or language-specific; everything else is structure.
const TEXT_ATTRIBUTES = new Set(['aria-label', 'title', 'alt', 'content', 'placeholder', 'lang', 'hreflang', 'href', 'src', 'srcset']);
function skeleton(html) {
  const tags = [];
  const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>]+))?)*)\s*\/?>/g;
  let tag;
  while ((tag = tagPattern.exec(html))) {
    if (tag[1]) { tags.push(`</${tag[2]}>`); continue; }
    const attributes = [];
    const attributePattern = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/g;
    let attribute;
    while ((attribute = attributePattern.exec(tag[3]))) {
      const value = attribute[2] ?? attribute[3] ?? attribute[4] ?? '';
      attributes.push(TEXT_ATTRIBUTES.has(attribute[1]) ? attribute[1] : `${attribute[1]}=${value}`);
    }
    tags.push(`<${tag[2]} ${attributes.sort().join(' ')}>`);
  }
  return tags;
}

test('the generated pages on disk are current', () => {
  for (const [file, html] of Object.entries(pages)) {
    assert.equal(disk(file), html, `${file} is stale: run "node 4lapy4/tools/build.cjs"`);
    assert.doesNotMatch(html, /\{\{|\}\}/, `${file} has an unresolved placeholder`);
  }
});

test('Polish and English pages share one structure', () => {
  const pl = skeleton(pages['index.html']);
  const en = skeleton(pages['en/index.html']);
  assert.equal(pl.length, en.length);
  pl.forEach((tag, index) => assert.equal(en[index], tag, `tag #${index}`));
});

test('both languages define the same texts', () => {
  const shape = value => Array.isArray(value) ? value.map(shape)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, shape(value[key])]))
      : typeof value;
  const neutral = copy => ({ ...copy, rangeLowercase: true });
  assert.deepEqual(shape(neutral(content.en)), shape(neutral(content.pl)));
  for (const language of Object.keys(LANGUAGES)) {
    assert.equal(content[language].weekdays.length, 7);
    assert.equal(content[language].daysFull.length, 7);
    assert.equal(content[language].services.length, 4);
  }
});

test('ids are unique and every in-page reference resolves', () => {
  for (const [file, html] of Object.entries(pages)) {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(ids.filter((id, index) => ids.indexOf(id) !== index), [], `${file}: duplicate ids`);
    const fragments = [...html.matchAll(/href="#([^"]+)"/g)].map(match => match[1]);
    const references = [...html.matchAll(/(?:aria-labelledby|aria-describedby|aria-controls|for)="([^"]+)"/g)].flatMap(match => match[1].split(/\s+/));
    for (const id of [...fragments, ...references]) assert.ok(ids.includes(id), `${file}: missing #${id}`);
    for (const image of html.match(/<img\b[^>]*>/g) || []) {
      assert.match(image, /\salt="[^"]+"/);
      assert.match(image, /\swidth="\d+"/);
      assert.match(image, /\sheight="\d+"/);
    }
    for (const link of html.match(/<a\b[^>]*target="_blank"[^>]*>/g) || []) assert.match(link, /rel="noopener noreferrer"/);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: exactly one h1`);
  }
});

test('every local file a page or the stylesheet points to exists, and nothing in assets is orphaned', () => {
  const referenced = new Set();
  for (const [file, html] of Object.entries(pages)) {
    const base = path.posix.dirname(file);
    const urls = [...html.matchAll(/\s(?:src|href|srcset)="([^"#]+)"/g)].map(match => match[1])
      .filter(url => !/^(?:[a-z]+:|\/\/)/i.test(url) && !url.endsWith('/'));
    for (const url of urls) {
      const target = path.posix.normalize(path.posix.join(base, url.split('?')[0]));
      assert.ok(fs.existsSync(path.join(root, target)), `${file}: ${url} does not exist`);
      referenced.add(target);
    }
  }
  for (const match of css.matchAll(/url\(([^)]+)\)/g)) {
    const target = match[1].replace(/['"]/g, '');
    assert.ok(fs.existsSync(path.join(root, target)), `styles.css: ${target} does not exist`);
    referenced.add(target);
  }
  const walk = directory => fs.readdirSync(path.join(root, directory), { withFileTypes: true })
    .flatMap(entry => entry.isDirectory() ? walk(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]);
  // The link-preview card is referenced by its absolute public URL in og:image.
  for (const html of Object.values(pages)) {
    assert.ok(html.includes(`content="${content.shared.siteUrl}assets/og-card.png"`));
    referenced.add('assets/og-card.png');
  }
  const orphaned = walk('assets').filter(file => !referenced.has(file) && !/-OFL\.txt$/.test(file));
  assert.deepEqual(orphaned, []);
});

test('the page shows the opening hours that the status logic uses', () => {
  const clock = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  for (const [language, file] of Object.entries(LANGUAGES)) {
    const html = pages[file];
    for (const group of hourGroups()) {
      const value = group.hours ? `${clock(group.hours[0])}–${clock(group.hours[1])}` : content[language].closedWord;
      assert.ok(html.includes(`data-hours-days="${group.days.join(' ')}"`), `${file}: row for days ${group.days}`);
      assert.ok(html.includes(`<dd>${value}</dd>`), `${file}: ${value}`);
    }
    const data = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
    const open = data.openingHoursSpecification.flatMap(spec => spec.dayOfWeek.map(day => `${day} ${spec.opens}-${spec.closes}`));
    const expected = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      .flatMap((day, index) => site.HOURS[index] ? [`${day} ${clock(site.HOURS[index][0])}-${clock(site.HOURS[index][1])}`] : []);
    assert.deepEqual(open.sort(), expected.sort());
    assert.equal((html.match(/data-week-day="/g) || []).length, 7);
  }
});

test('the static reminder preview matches what the script renders first', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  for (const language of Object.keys(LANGUAGES)) {
    const preview = site.reminderPreview({ name: '', date: '', days: '7' }, now, language);
    assert.equal(content[language].previewTitle, preview.title);
    assert.equal(content[language].previewDate, preview.date);
    assert.equal(content[language].previewNote, preview.note);
  }
});

test('the stylesheet keeps text legible and avoids syntax that breaks older browsers', () => {
  const sizes = [...css.matchAll(/font-size:\s*(?:clamp\()?(\d*\.?\d+)rem/g)].map(match => Number(match[1]));
  assert.ok(sizes.length > 20);
  assert.ok(Math.min(...sizes) >= 0.8125, `smallest font-size is ${Math.min(...sizes)}rem; the floor is 13px`);
  // light-dark() only inside the @supports block: older browsers keep the plain light tokens.
  const supports = /@supports \(color: light-dark\(#000, #fff\)\) \{([\s\S]*?)\n\}/.exec(css);
  assert.ok(supports, 'the light-dark() tokens are wrapped in @supports');
  assert.equal(css.replace(supports[0], '').includes('light-dark('), false);
});
