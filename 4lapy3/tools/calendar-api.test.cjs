'use strict';
const assert = require('node:assert/strict');
const api = require('../calendar-api.js');
const { buildReminder } = require('../site.js');
const reminder = buildReminder({ name: 'Reksio', date: '2030-07-20', days: '7' }, new Date('2030-01-01T00:00:00Z'), 'pl');
const ID = '0123456789abcdef0123456789abcdef';
const response = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const eventFor = payload => ({ ...payload, status: 'confirmed', htmlLink: 'https://calendar.google.com/calendar/event?eid=test' });
const code = expected => error => error.code === expected;
function fixture(fetch) {
  const calls = [], auth = [];
  let loads = 0, ids = 0;
  const identity = {
    initTokenClient(config) {
      const item = { config, requested: false };
      auth.push(item);
      return { requestAccessToken() { item.requested = true; } };
    },
    hasGrantedAllScopes(result, scope) { return result.scope === scope; }
  };
  const client = api.createClient({
    googleClientId: 'test.apps.googleusercontent.com',
    loadIdentity: async () => { loads += 1; return identity; },
    createId: () => { ids += 1; return ID; },
    now: () => 1000000,
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (!fetch) throw new Error('Unexpected mocked network call');
      return fetch(url, options, calls.length);
    }
  });
  return { client, calls, auth, get loads() { return loads; }, get ids() { return ids; } };
}
async function login(fx) {
  await fx.client.ready();
  const pending = fx.client.authorize();
  const auth = fx.auth[fx.auth.length - 1];
  assert.equal(auth.requested, true, 'the popup request starts synchronously');
  auth.config.callback({ access_token: 'mock-token', expires_in: 3600, scope: api.SCOPE });
  await pending;
}
const tests = [];
function test(name, run) { tests.push({ name, run }); }

test('Payload preserves Warsaw time, explicit popup, transparent time and no guests', () => {
  const payload = api.eventPayload(reminder, ID);
  assert.equal(payload.start.dateTime, '2030-07-13T07:00:00.000Z');
  assert.equal(payload.end.dateTime, '2030-07-13T07:15:00.000Z');
  assert.equal(payload.start.timeZone, 'Europe/Warsaw');
  assert.equal(payload.end.timeZone, 'Europe/Warsaw');
  assert.equal(payload.transparency, 'transparent');
  assert.deepEqual(payload.reminders, { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] });
  assert.equal(Object.hasOwn(payload, 'attendees'), false);
  assert.equal(payload.summary, 'Umów szczepienie — Reksio');
});

test('Empty configuration never loads Google and configured SDK is lazy', async () => {
  let attempted = false;
  const disabled = api.createClient({ googleClientId: '', loadIdentity: async () => { attempted = true; } });
  assert.equal(disabled.configured, false);
  await assert.rejects(disabled.ready(), code('not_configured'));
  assert.equal(attempted, false);
  const fx = fixture();
  assert.equal(fx.loads, 0);
  await fx.client.ready();
  await fx.client.ready();
  assert.equal(fx.loads, 1);
});

test('Denied authorization cannot write an event', async () => {
  const fx = fixture();
  await fx.client.ready();
  const pending = fx.client.authorize();
  assert.equal(fx.auth[0].requested, true);
  assert.equal(fx.auth[0].config.scope, api.SCOPE);
  assert.equal(fx.auth[0].config.include_granted_scopes, false);
  fx.auth[0].config.callback({ error: 'access_denied' });
  await assert.rejects(pending, code('auth_denied'));
  await assert.rejects(fx.client.save(reminder), code('auth_required'));
  assert.equal(fx.calls.length, 0);
});

test('Closing during consent ignores the late token and never writes', async () => {
  const fx = fixture();
  await fx.client.ready();
  const controller = new AbortController();
  const pending = fx.client.authorize({ signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, code('aborted'));
  fx.auth[0].config.callback({ access_token: 'late-token', expires_in: 3600, scope: api.SCOPE });
  await assert.rejects(fx.client.save(reminder), code('auth_required'));
  assert.equal(fx.calls.length, 0);
});

test('An uncertain save retries with the same ID and 409 is verified by GET', async () => {
  let original;
  const fx = fixture(async (url, options, number) => {
    if (number === 1) { original = JSON.parse(options.body); throw new TypeError('mock connection lost'); }
    if (number === 2) return response(409, { error: { code: 409 } });
    return response(200, eventFor(original));
  });
  await login(fx);
  await assert.rejects(fx.client.save(reminder), code('network'));
  const saved = await fx.client.save({ ...reminder });
  assert.equal(saved.id, ID);
  assert.equal(JSON.parse(fx.calls[0].options.body).id, JSON.parse(fx.calls[1].options.body).id);
  assert.equal(fx.calls[2].options.method, 'GET');
  assert.ok(fx.calls[2].url.endsWith('/' + ID));
  assert.equal(fx.ids, 1);
});

test('Double save shares one request instead of making a duplicate', async () => {
  let release, payload;
  const fx = fixture((url, options) => {
    payload = JSON.parse(options.body);
    return new Promise(resolve => { release = resolve; });
  });
  await login(fx);
  const first = fx.client.save(reminder);
  const second = fx.client.save({ ...reminder });
  assert.equal(first, second);
  assert.equal(fx.calls.length, 1);
  release(response(200, eventFor(payload)));
  assert.equal((await first).id, ID);
});

test('A conflict with different event data is never reported as success', async () => {
  const payload = api.eventPayload(reminder, ID);
  const fx = fixture(async (url, options, number) => number === 1
    ? response(409, {}) : response(200, { ...eventFor(payload), summary: 'Different event' }));
  await login(fx);
  await assert.rejects(fx.client.save(reminder), code('api_unconfirmed'));
});

test('401 clears the expired token and does not retry authentication automatically', async () => {
  const fx = fixture(async () => response(401, {}));
  await login(fx);
  await assert.rejects(fx.client.save(reminder), code('auth_required'));
  await assert.rejects(fx.client.save(reminder), code('auth_required'));
  assert.equal(fx.calls.length, 1);
  assert.equal(fx.auth.length, 1);
});

test('Closing during an outstanding request cannot produce a late success', async () => {
  let release, payload;
  const fx = fixture((url, options) => {
    payload = JSON.parse(options.body);
    return new Promise(resolve => { release = resolve; });
  });
  await login(fx);
  const controller = new AbortController();
  const pending = fx.client.save(reminder, { signal: controller.signal });
  controller.abort();
  release(response(200, eventFor(payload)));
  await assert.rejects(pending, code('aborted'));
});

test('Result links allow only HTTPS Google Calendar destinations', () => {
  assert.equal(api.safeEventLink('javascript:alert(1)'), '');
  assert.equal(api.safeEventLink('https://calendar.google.com.example.org/x'), '');
  assert.equal(api.safeEventLink('https://www.google.com/search?q=calendar'), '');
  assert.equal(api.safeEventLink('https://www.google.com/calendar/event?eid=x'), 'https://www.google.com/calendar/event?eid=x');
});

(async () => {
  for (const { name, run } of tests) { await run(); process.stdout.write('PASS ' + name + '\n'); }
  process.stdout.write(tests.length + ' checks passed; all network and OAuth calls were mocked.\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
