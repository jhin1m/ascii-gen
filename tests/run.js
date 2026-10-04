/* Loads the DOM-free sources into a vm context (like classic <script> tags sharing `window`)
   and runs every tests/*.test.js against the resulting window.ADG. Usage: node tests/run.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const harness = require('./assert');

const ROOT = path.join(__dirname, '..');
// same order as the <script> tags in index.html
const SOURCES = [
  'js/core/text-utils.js',
  'js/core/theme.js',
  'js/core/markup.js',
  'js/core/grid.js',
  'js/output/html-renderer.js'
];

const warnings = [];
const sandboxConsole = { log: console.log, error: console.error, warn: (...a) => warnings.push(a) };
const ctx = vm.createContext({ window: {}, console: sandboxConsole });
SOURCES.forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const ADG = ctx.window.ADG;

fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort().forEach((f) => {
  harness.setGroup(f);
  require(path.join(__dirname, f))({ ADG, test: harness.test, assert: harness.assert, warnings });
});

process.exitCode = harness.run() ? 1 : 0;
