/* Loads the DOM-free sources into a vm context (like classic <script> tags sharing `window`)
   and runs every tests/*.test.js against the resulting window.ADG. Usage: node tests/run.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const harness = require('./assert');

const ROOT = path.join(__dirname, '..');
// Sources in the same order as the <script> tags of index.html, minus app/ui (they need a DOM).
// Every other file must stay DOM-free at load time.
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const SOURCES = Array.from(html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g))
  .map((m) => m[1])
  .filter((f) => /^js\//.test(f) && !/^js\/(app\.js|ui\/)/.test(f));
if (!SOURCES.length) throw new Error('no sources found in index.html');
SOURCES.forEach((f) => { if (!fs.existsSync(path.join(ROOT, f))) throw new Error('missing source ' + f); });

const warnings = [];
const sandboxConsole = { log: console.log, error: console.error, warn: (...a) => warnings.push(a) };
const ctx = vm.createContext({ window: {}, console: sandboxConsole, setTimeout, clearTimeout });
SOURCES.forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const ADG = ctx.window.ADG;

fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort().forEach((f) => {
  harness.setGroup(f);
  require(path.join(__dirname, f))({ ADG, test: harness.test, assert: harness.assert, warnings, sandbox: ctx });
});

process.exitCode = harness.run() ? 1 : 0;
