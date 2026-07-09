const { test } = require('node:test');
const assert = require('node:assert');
const { run, hasCommand } = require('../src/run');

test('run captures stdout of a successful command', async () => {
  const res = await run('printf', ['hello']);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.stdout, 'hello');
  assert.strictEqual(res.code, 0);
});

test('run resolves ok:false for a missing binary instead of throwing', async () => {
  const res = await run('definitely-not-a-real-binary-xyz');
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.stdout, '');
});

test('run resolves ok:false for malformed args instead of rejecting', async () => {
  const res = await run(null);
  assert.strictEqual(res.ok, false);
});

test('hasCommand is true for sh and false for a bogus name', async () => {
  assert.strictEqual(await hasCommand('sh'), true);
  assert.strictEqual(await hasCommand('definitely-not-a-real-binary-xyz'), false);
});
