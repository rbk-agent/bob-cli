const { test } = require('node:test');
const assert = require('node:assert');
const pkg = require('../package.json');

test('package declares the bob binary and CommonJS', () => {
  assert.strictEqual(pkg.bin.bob, './index.js');
  assert.ok(!pkg.type || pkg.type === 'commonjs');
  assert.strictEqual(pkg.scripts.test, 'node --test');
});
