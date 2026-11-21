/* On-demand Google Calendar access. Tokens and retry IDs live only in memory. */
(function (page) {
  'use strict';

  const SCOPE = 'https://www.googleapis.com/auth/calendar.events.owned';
  const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  const TIME_ZONE = 'Europe/Warsaw';
  let identityPromise = null;

  class CalendarError extends Error {
    constructor(code, status) {
      super(code);
      this.name = 'CalendarError';
      this.code = code;
      this.status = status || 0;
    }
  }

  function eventPayload(reminder, id) {
    const start = new Date(reminder.start);
    const end = new Date(reminder.end);
    if (!Number.isFinite(start.getTime()) || end <= start ||
      !Number.isFinite(end.getTime()) || !String(reminder.title || '').trim() ||
      !/^[a-v0-9]{5,1024}$/.test(id)) throw new CalendarError('invalid_reminder');
    return {
      id,
      summary: String(reminder.title),
      description: String(reminder.description || ''),
      location: String(reminder.location || ''),
      start: { dateTime: start.toISOString(), timeZone: TIME_ZONE },
      end: { dateTime: end.toISOString(), timeZone: TIME_ZONE },
      transparency: 'transparent',
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] }
    };
  }

  function randomEventId(source) {
    if (source && typeof source.randomUUID === 'function') return source.randomUUID().replace(/-/g, '').toLowerCase();
    if (!source || typeof source.getRandomValues !== 'function') throw new CalendarError('unavailable');
    return Array.from(source.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
  }

  function safeEventLink(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && (url.hostname === 'calendar.google.com' ||
        (url.hostname === 'www.google.com' && url.pathname.startsWith('/calendar/'))) ? url.href : '';
    } catch (_) { return ''; }
  }

  function loadIdentity() {
    const ready = page && page.google && page.google.accounts && page.google.accounts.oauth2;
    if (ready && typeof ready.initTokenClient === 'function') return Promise.resolve(ready);
    if (!page || !page.document) return Promise.reject(new CalendarError('unavailable'));
    if (identityPromise) return identityPromise;
    identityPromise = new Promise((resolve, reject) => {
      const script = page.document.createElement('script');
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        page.clearTimeout(timer);
        script.onload = script.onerror = null;
        const identity = page.google && page.google.accounts && page.google.accounts.oauth2;
        if (error || !identity || typeof identity.initTokenClient !== 'function') {
          script.remove();
          reject(new CalendarError('sdk_unavailable'));
        } else resolve(identity);
      };
      const timer = page.setTimeout(() => finish(true), 20000);
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => finish(false);
      script.onerror = () => finish(true);
      page.document.head.appendChild(script);
    }).catch(error => {
      identityPromise = null;
      throw error;
    });
    return identityPromise;
  }

  function createClient(options = {}) {
    const clientId = String(options.googleClientId || '').trim();
    const fetchRequest = options.fetch || (page && page.fetch && page.fetch.bind(page));
    const getIdentity = options.loadIdentity || loadIdentity;
    const clock = options.now || Date.now;
    const cryptoSource = options.crypto || (page && page.crypto);
    const createId = options.createId || (() => randomEventId(cryptoSource));
    const records = new Map();
    let identity = null;
    let loading = null;
    let token = null;
    let authorization = null;

    function ready() {
      if (!clientId) return Promise.reject(new CalendarError('not_configured'));
      if (identity) return Promise.resolve();
      if (!loading) {
        loading = Promise.resolve().then(getIdentity).then(value => {
          if (!value || typeof value.initTokenClient !== 'function') throw new CalendarError('sdk_unavailable');
          identity = value;
        }).catch(error => {
          loading = null;
          throw error;
        });
      }
      return loading;
    }

    function validToken() {
      return token && token.expiresAt > clock();
    }

    // Call directly from the user's click, after ready() has loaded the SDK.
    // No await or network operation precedes requestAccessToken().
    function authorize({ signal } = {}) {
      if (signal && signal.aborted) return Promise.reject(new CalendarError('aborted'));
      if (validToken()) return Promise.resolve();
      if (!identity) return Promise.reject(new CalendarError('not_ready'));
      if (authorization) return Promise.reject(new CalendarError('auth_busy'));
      return new Promise((resolve, reject) => {
        const request = {};
        authorization = request;
        let settled = false;
        const finish = error => {
          if (settled) return;
          settled = true;
          if (authorization === request) authorization = null;
          if (signal) signal.removeEventListener('abort', abort);
          if (error) reject(error);
          else resolve();
        };
        const abort = () => finish(new CalendarError('aborted'));
        if (signal) signal.addEventListener('abort', abort, { once: true });
        try {
          const client = identity.initTokenClient({
            client_id: clientId,
            scope: SCOPE,
            include_granted_scopes: false,
            callback: response => {
              if (settled || (signal && signal.aborted)) return;
              if (!response || response.error) {
                finish(new CalendarError(response && response.error === 'access_denied' ? 'auth_denied' : 'auth_error'));
                return;
              }
              const granted = typeof identity.hasGrantedAllScopes === 'function'
                ? identity.hasGrantedAllScopes(response, SCOPE)
                : String(response.scope || '').split(/\s+/).includes(SCOPE);
              if (!response.access_token || !granted) {
                finish(new CalendarError('auth_denied'));
                return;
              }
              const lifetime = Number(response.expires_in);
              token = { value: response.access_token,
                expiresAt: clock() + Math.max(0, (Number.isFinite(lifetime) ? lifetime : 3600) - 30) * 1000 };
              finish();
            },
            error_callback: error => {
              if (settled) return;
              finish(new CalendarError(error && error.type === 'popup_closed' ? 'auth_closed' : 'auth_popup'));
            }
          });
          if (signal && signal.aborted) { abort(); return; }
          client.requestAccessToken({ prompt: 'select_account' });
        } catch (_) { finish(new CalendarError('auth_popup')); }
      });
    }

    async function request(url, method, payload, accessToken, signal) {
      if (signal && signal.aborted) throw new CalendarError('aborted');
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (signal) signal.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(abort, 20000);
      try {
        const response = await fetchRequest(url, {
          method,
          headers: { Authorization: `Bearer ${accessToken}`, ...(payload ? { 'Content-Type': 'application/json' } : {}) },
          ...(payload ? { body: JSON.stringify(payload) } : {}),
          signal: controller.signal,
          credentials: 'omit',
          cache: 'no-store'
        });
        let data = null;
        try { data = await response.json(); } catch (_) { /* A non-JSON reply is not a confirmed event. */ }
        if (signal && signal.aborted) throw new CalendarError('aborted');
        if (response.status === 401) {
          if (token && token.value === accessToken) token = null;
          throw new CalendarError('auth_required', 401);
        }
        return { ok: response.ok, status: response.status, data };
      } catch (error) {
        if (error instanceof CalendarError) throw error;
        throw new CalendarError(signal && signal.aborted ? 'aborted' : 'network');
      } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', abort);
      }
    }

    function confirmedEvent(data, payload) {
      return data && data.id === payload.id && data.status !== 'cancelled' &&
        data.summary === payload.summary && data.start && data.end &&
        Date.parse(data.start.dateTime) === Date.parse(payload.start.dateTime) &&
        Date.parse(data.end.dateTime) === Date.parse(payload.end.dateTime);
    }

    function save(reminder, { signal } = {}) {
      if (signal && signal.aborted) return Promise.reject(new CalendarError('aborted'));
      if (!validToken()) return Promise.reject(new CalendarError('auth_required'));
      if (typeof fetchRequest !== 'function') return Promise.reject(new CalendarError('unavailable'));
      const fields = [String(reminder.title || ''), String(reminder.description || ''),
        String(reminder.location || ''), new Date(reminder.start).toISOString(), new Date(reminder.end).toISOString()];
      const key = JSON.stringify(fields);
      let record = records.get(key);
      if (!record) {
        record = { id: createId(), pending: null };
        records.set(key, record);
      }
      if (record.pending) return record.pending;
      const payload = eventPayload(reminder, record.id);
      const accessToken = token.value;
      record.pending = (async () => {
        let result = await request(EVENTS_URL, 'POST', payload, accessToken, signal);
        if (result.status === 409) {
          result = await request(`${EVENTS_URL}/${encodeURIComponent(record.id)}`, 'GET', null, accessToken, signal);
        }
        if (!result.ok || !confirmedEvent(result.data, payload)) {
          throw new CalendarError('api_unconfirmed', result.status);
        }
        return { id: result.data.id, htmlLink: safeEventLink(result.data.htmlLink) };
      })().finally(() => { record.pending = null; });
      return record.pending;
    }

    return { configured: Boolean(clientId), ready, isReady: () => Boolean(identity), authorize, save };
  }

  const api = { createClient, eventPayload, safeEventLink, CalendarError, SCOPE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (page) page.ClinicCalendarApi = api;
}(typeof window !== 'undefined' ? window : null));
