/* Tiny dependency-free test harness: register with test(), check with assert.*, run() prints a summary. */
const tests = [];
let group = '';

function setGroup(name) { group = name; }
function test(name, fn) { tests.push({ group, name, fn }); }
function fail(msg, extra) { throw new Error((msg ? msg + ': ' : '') + extra); }

const assert = {
  ok(v, msg) { if (!v) fail(msg, 'expected truthy, got ' + JSON.stringify(v)); },
  eq(a, b, msg) { if (a !== b) fail(msg, 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); },
  // JSON comparison also works for objects created inside the vm context (different realm prototypes)
  deq(a, b, msg) {
    const x = JSON.stringify(a), y = JSON.stringify(b);
    if (x !== y) fail(msg, 'expected ' + y + ', got ' + x);
  }
};

function run() {
  let passed = 0, failed = 0, last = null;
  for (const t of tests) {
    if (t.group !== last) { console.log('\n' + t.group); last = t.group; }
    try { t.fn(); passed++; console.log('  ✓ ' + t.name); }
    catch (e) { failed++; console.log('  ✗ ' + t.name + '\n      ' + e.message); }
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  return failed;
}

module.exports = { test, assert, run, setGroup };
