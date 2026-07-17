import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve('dist/lukasz-portfolio/browser');
const sitePort = 41739;
const debugPort = 9339;
const shotsDir = path.join(os.tmpdir(), `guziczak-mobile-qa-${Date.now()}`);
fs.mkdirSync(shotsDir, { recursive: true });

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.ico', 'image/x-icon'],
  ['.pdf', 'application/pdf'],
  ['.m4a', 'audio/mp4'],
]);

const server = http.createServer((req, res) => {
  const raw = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const relative = raw === '/' ? 'index.html' : raw.replace(/^\/+/, '');
  let file = path.resolve(root, relative);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(root, 'index.html');
  }
  res.writeHead(200, {
    'content-type': mime.get(path.extname(file).toLowerCase()) ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(sitePort, '127.0.0.1', resolve));

const chromeCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const chromePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));
if (!chromePath) throw new Error('Chrome/Edge not found');

const profile = path.join(os.tmpdir(), `codex-chrome-${process.pid}`);
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let version;
for (let i = 0; i < 80; i++) {
  try {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
    if (response.ok) {
      version = await response.json();
      break;
    }
  } catch {}
  await wait(100);
}
if (!version) throw new Error('Chrome DevTools endpoint did not start');

const pages = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((r) => r.json());
const socketUrl = pages[0]?.webSocketDebuggerUrl;
if (!socketUrl) throw new Error('No browser page available');

class CDP {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.ws = new WebSocket(url);
  }
  async open() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id) {
        const job = this.pending.get(msg.id);
        if (!job) return;
        this.pending.delete(msg.id);
        if (msg.error) job.reject(new Error(msg.error.message));
        else job.resolve(msg.result ?? {});
        return;
      }
      for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params ?? {});
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, fn) {
    const list = this.listeners.get(method) ?? [];
    list.push(fn);
    this.listeners.set(method, list);
  }
  once(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const list = this.listeners.get(method) ?? [];
      const timer = setTimeout(() => reject(new Error(`Timeout: ${method}`)), timeout);
      const fn = (params) => {
        clearTimeout(timer);
        const current = this.listeners.get(method) ?? [];
        this.listeners.set(method, current.filter((item) => item !== fn));
        resolve(params);
      };
      list.push(fn);
      this.listeners.set(method, list);
    });
  }
  close() {
    this.ws.close();
  }
}

const cdp = new CDP(socketUrl);
await cdp.open();
await Promise.all([
  cdp.send('Page.enable'),
  cdp.send('Runtime.enable'),
  cdp.send('Network.enable'),
  cdp.send('Log.enable'),
]);

const runtimeErrors = [];
const localFailures = [];
cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
  runtimeErrors.push(exceptionDetails?.exception?.description ?? exceptionDetails?.text ?? 'Unknown exception');
});
cdp.on('Log.entryAdded', ({ entry }) => {
  if (entry?.level === 'error') runtimeErrors.push(entry.text);
});
cdp.on('Network.responseReceived', ({ response }) => {
  if (response?.url?.startsWith(`http://127.0.0.1:${sitePort}`) && response.status >= 400) {
    localFailures.push(`${response.status} ${response.url}`);
  }
});
cdp.on('Network.loadingFailed', ({ errorText, canceled }) => {
  if (!canceled && !String(errorText).includes('ERR_ABORTED')) localFailures.push(errorText);
});

const evaluate = async (expression) => {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result?.value;
};

const click = async (x, y) => {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};

const screenshot = async (name) => {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const file = path.join(shotsDir, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  return file;
};

const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '375x667', width: 375, height: 667 },
  { name: '393x852', width: 393, height: 852 },
  { name: '430x932', width: 430, height: 932 },
  { name: '852x393', width: 852, height: 393 },
];

const report = [];
for (const viewport of viewports) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
    deviceScaleFactor: 1,
    mobile: true,
  });
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', {
    url: `http://127.0.0.1:${sitePort}/?qa=${viewport.name}`,
  });
  await loaded;
  await wait(750);
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: 8,
    y: 120,
    deltaX: 0,
    deltaY: 1,
  });
  await evaluate('window.scrollTo(0, 0)');
  await wait(150);

  const initial = await evaluate(`(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) };
    };
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
    const duplicateIds = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    const selectors = ['.manifesto__enter', '.manifesto__cv', '.manifesto__music', '.manifesto__score', '.manifesto__social a', '.score-modal__close'];
    const tooSmall = selectors.flatMap((selector) => [...document.querySelectorAll(selector)].map((el) => {
      const r = el.getBoundingClientRect();
      return { selector, width: +r.width.toFixed(1), height: +r.height.toFixed(1) };
    })).filter((item) => item.width < 44 || item.height < 44);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      h1: [...document.querySelectorAll('h1')].map((el) => el.textContent.trim()),
      duplicateIds,
      tooSmall,
      brand: rect('.bar__mark'),
      hero: rect('.manifesto'),
      staff: rect('.staff'),
      animationCount: document.getAnimations().length,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  })()`);

  if (viewport.name === '320x568' || viewport.name === '393x852' || viewport.name === '852x393') {
    initial.heroShot = await screenshot(`${viewport.name}-hero`);
  }

  await click(Math.min(30, viewport.width - 10), Math.min(260, viewport.height - 20));
  await wait(600);
  const musicInHero = await evaluate(`(() => {
    const staff = document.querySelector('.staff');
    const r = staff?.getBoundingClientRect();
    return {
      pressed: document.querySelector('.manifesto__music')?.getAttribute('aria-pressed'),
      className: staff?.className,
      opacity: staff ? getComputedStyle(staff).opacity : null,
      rect: r ? { width: +r.width.toFixed(1), height: +r.height.toFixed(1), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) } : null,
    };
  })()`);

  await evaluate(`document.querySelector('#projects')?.scrollIntoView({ block: 'start' })`);
  await wait(700);
  const projectState = await evaluate(`(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1), bottom: +r.bottom.toFixed(1) };
    };
    const staff = document.querySelector('.staff');
    const items = [...document.querySelectorAll('.range__item')];
    return {
      staffClass: staff?.className,
      staffOpacity: staff ? getComputedStyle(staff).opacity : null,
      staff: rect('.staff'),
      project: rect('#projects'),
      exhibit: rect('.exhibit'),
      ledgerDisplay: getComputedStyle(document.querySelector('.range__items')).display,
      ledgerRows: items.length,
      ledgerMinHeight: Math.min(...items.map((el) => el.getBoundingClientRect().height)),
      scrollWidth: document.documentElement.scrollWidth,
    };
  })()`);
  if (viewport.name === '393x852' || viewport.name === '852x393') {
    projectState.projectShot = await screenshot(`${viewport.name}-projects`);
  }

  const navState = await evaluate(`(() => {
    const nav = document.querySelector('.bar');
    document.querySelector('.lang__btn')?.click();
    return new Promise((resolve) => setTimeout(() => {
      const active = document.activeElement;
      resolve({
        visible: nav?.classList.contains('visible'),
        ariaHidden: nav?.getAttribute('aria-hidden'),
        inert: nav?.hasAttribute('inert'),
        menuOpen: !!document.querySelector('.lang__menu'),
        activeLang: active?.getAttribute('data-lang-option'),
        selectedCount: document.querySelectorAll('.lang__item[aria-selected="true"]').length,
        brandLines: (() => { const el = document.querySelector('.bar__mark'); return el ? Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)) : null; })(),
      });
    }, 30));
  })()`);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await wait(30);
  navState.afterEscape = await evaluate(`({ menuOpen: !!document.querySelector('.lang__menu'), focus: document.activeElement?.className })`);

  await evaluate(`window.scrollTo(0, 0); document.querySelector('.manifesto__score')?.click()`);
  await wait(50);
  const modal = await evaluate(`(() => {
    const panel = document.querySelector('.score-modal__panel');
    const close = document.querySelector('.score-modal__close');
    const p = panel?.getBoundingClientRect();
    const c = close?.getBoundingClientRect();
    return {
      open: !!panel,
      role: panel?.getAttribute('role'),
      labelledBy: panel?.getAttribute('aria-labelledby'),
      focus: document.activeElement?.className,
      bodyOverflow: document.body.style.overflow,
      panel: p ? { x: +p.x.toFixed(1), y: +p.y.toFixed(1), width: +p.width.toFixed(1), height: +p.height.toFixed(1), right: +p.right.toFixed(1), bottom: +p.bottom.toFixed(1) } : null,
      close: c ? { width: +c.width.toFixed(1), height: +c.height.toFixed(1) } : null,
    };
  })()`);
  await evaluate(`document.querySelector('.score-modal__close')?.click()`);
  await wait(40);
  modal.afterClose = await evaluate(`({ open: !!document.querySelector('.score-modal'), focus: document.activeElement?.className, bodyOverflow: document.body.style.overflow })`);

  report.push({ name: viewport.name, initial, musicInHero, projectState, navState, modal });
}

console.log(JSON.stringify({ report, runtimeErrors, localFailures, shotsDir }, null, 2));

cdp.close();
chrome.kill();
await new Promise((resolve) => server.close(resolve));
