const { test } = require('node:test');
const assert = require('node:assert');
const { execFile } = require('node:child_process');
const path = require('node:path');

const BIN = path.join(__dirname, '..', 'index.js');

function bob(args) {
  return new Promise((resolve) => {
    execFile('node', [BIN, ...args], { timeout: 15000 }, (err, stdout, stderr) => {
      resolve({ code: err && typeof err.code === 'number' ? err.code : 0, stdout, stderr });
    });
  });
}

test('bob --version prints the version', async () => {
  const { stdout } = await bob(['--version']);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('bob cpu --json emits a JSON object with a model field', async () => {
  const { stdout } = await bob(['cpu', '--json']);
  const obj = JSON.parse(stdout);
  assert.ok('model' in obj);
});

test('bob volumes prints a bordered table', async () => {
  const { stdout } = await bob(['volumes']);
  assert.ok(stdout.includes('┌') && stdout.includes('NAME'));
});
