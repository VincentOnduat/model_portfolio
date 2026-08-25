// REPL driver for the Model Portfolio web app (React + Vite frontend,
// proxied to the Express backend). Run headless on Linux - no xvfb needed,
// this uses Playwright's headless Chromium directly (no window to render).
//
// Assumes postgres + the backend (:4000) + the frontend dev server (:5173)
// are ALREADY running - this driver only drives the browser. See
// SKILL.md's "Run (agent path)" for how to bring those up first.
//
// Designed for agents: wrap in tmux, send-keys commands, capture-pane output.
import { chromium } from 'playwright';
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';

const BASE_URL = process.env.APP_URL || 'http://localhost:5173';
const SHOT_DIR = process.env.SCREENSHOT_DIR || '/tmp/shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

let browser = null;
let page = null;
let consoleErrors = [];

const COMMANDS = {
  async launch() {
    if (browser) return console.log('already launched');
    browser = await chromium.launch({ args: ['--no-sandbox'] });
    page = await (await browser.newContext()).newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    console.log('launched. url:', page.url());
  },

  async ss(name) {
    if (!page) return console.log('ERROR: launch first');
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    await page.screenshot({ path: f, fullPage: true });
    console.log('screenshot:', f);
  },

  async nav(urlPath) {
    if (!page) return console.log('ERROR: launch first');
    await page.goto(new URL(urlPath || '/', BASE_URL).toString(), { waitUntil: 'networkidle' });
    console.log('nav ->', page.url());
  },

  // App-specific helper: the login form (email, password, submit button
  // with no distinguishing attributes beyond type). See SKILL.md for the
  // seeded demo accounts (all share the password Password123!).
  async login(args) {
    if (!page) return console.log('ERROR: launch first');
    const [email, password] = (args || '').split(' ');
    if (!email || !password) return console.log('usage: login <email> <password>');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    // Don't just waitForLoadState('networkidle') here: the POST /api/auth/login
    // XHR settling and React Router's client-side redirect to the dashboard
    // are two separate async steps, so page.url() read right after networkidle
    // can still report the stale /login URL. Wait for a marker that only
    // exists once actually authenticated instead.
    await page
      .waitForSelector('text=Sign out', { timeout: 10_000 })
      .catch(() => console.log('WARNING: "Sign out" never appeared - login likely failed, check ss/console'));
    console.log('login ->', page.url());
  },

  async click(sel) {
    if (!page) return console.log('ERROR: launch first');
    try { await page.click(sel, { timeout: 5000 }); console.log('click', sel, '-> OK'); }
    catch (e) { console.log('click', sel, '-> ERROR:', e.message.split('\n')[0]); }
  },

  // Click a button/link/tab by visible text - handy since this app's
  // interactive elements are mostly plain text links, not test ids.
  async 'click-text'(text) {
    if (!page) return console.log('ERROR: launch first');
    try { await page.click(`text=${text}`, { timeout: 5000 }); console.log('click-text', JSON.stringify(text), '-> OK'); }
    catch (e) { console.log('click-text', JSON.stringify(text), '-> ERROR:', e.message.split('\n')[0]); }
  },

  async fill(args) {
    if (!page) return console.log('ERROR: launch first');
    const sp = args.indexOf(' ');
    const sel = args.slice(0, sp);
    const value = args.slice(sp + 1);
    await page.fill(sel, value);
    console.log('fill', sel, '<-', JSON.stringify(value));
  },

  async type(text) { if (page) await page.keyboard.type(text, { delay: 20 }); },
  async press(key) { if (page) await page.keyboard.press(key); },

  async wait(sel) {
    if (!page) return console.log('ERROR: launch first');
    try { await page.waitForSelector(sel, { timeout: 10_000 }); console.log('found:', sel); }
    catch { console.log('TIMEOUT:', sel); }
  },

  // Wait for a transient state (e.g. "Loading model...") to disappear -
  // TanStack Query re-renders lag slightly behind network-idle, so a
  // screenshot taken right after networkidle can still show the loading
  // state. See Gotchas in SKILL.md.
  async 'wait-gone'(text) {
    if (!page) return console.log('ERROR: launch first');
    try {
      await page.waitForSelector(`text=${text}`, { state: 'detached', timeout: 10_000 });
      console.log('gone:', text);
    } catch { console.log('TIMEOUT (still present):', text); }
  },

  async eval(expr) {
    if (!page) return console.log('ERROR: launch first');
    try { console.log(JSON.stringify(await page.evaluate(expr))); }
    catch (e) { console.log('ERROR:', e.message); }
  },

  async text(sel) {
    if (!page) return console.log('ERROR: launch first');
    console.log(await page.evaluate(
      (s) => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)',
      sel || null,
    ));
  },

  url() { console.log(page ? page.url() : '(not launched)'); },

  console() {
    console.log(consoleErrors.length ? consoleErrors.join('\n') : '(no console errors captured)');
  },

  async quit() { if (browser) await browser.close().catch(() => {}); browser = null; page = null; },
  help() { console.log('commands:', Object.keys(COMMANDS).join(', ')); },
};

const stdin = fs.createReadStream(null, { fd: fs.openSync('/dev/stdin', 'r') });
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: 'driver> ' });

rl.on('line', async (line) => {
  const sp = line.trim().indexOf(' ');
  const cmd = sp === -1 ? line.trim() : line.trim().slice(0, sp);
  const rest = sp === -1 ? '' : line.trim().slice(sp + 1);
  if (!cmd) return rl.prompt();
  const fn = COMMANDS[cmd];
  if (!fn) { console.log('unknown:', cmd, '- try: help'); return rl.prompt(); }
  try { await fn(rest); } catch (e) { console.log('ERROR:', e.message); }
  if (cmd === 'quit') { rl.close(); process.exit(0); }
  rl.prompt();
});
rl.on('close', async () => { await COMMANDS.quit(); process.exit(0); });

console.log('model-portfolio driver - "help" for commands, "launch" to start');
rl.prompt();
