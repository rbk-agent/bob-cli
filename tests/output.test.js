const { test } = require('node:test');
const assert = require('node:assert');
const { formatBytes, renderTable, jsonError } = require('../src/output');

test('formatBytes scales units and handles missing values', () => {
  assert.strictEqual(formatBytes(0), '0 B');
  assert.strictEqual(formatBytes(1536), '1.5 KB');
  assert.strictEqual(formatBytes(null), '-');
});

test('renderTable draws headers and rows with borders', () => {
  const out = renderTable({ head: ['A', 'B'], rows: [['1', 'yy']] });
  const lines = out.split('\n');
  assert.strictEqual(lines.length, 5); // top, head, sep, one row, bottom
  assert.ok(lines[1].includes('A') && lines[1].includes('B'));
  assert.ok(lines[3].includes('1') && lines[3].includes('yy'));
  assert.ok(out.startsWith('┌'));
});

test('renderTable handles an empty row set', () => {
  const out = renderTable({ head: ['A'], rows: [] });
  assert.strictEqual(out.split('\n').length, 4); // top, head, sep, bottom
});

test('jsonError wraps a message', () => {
  assert.deepStrictEqual(jsonError('nope', { code: 1 }), { error: 'nope', code: 1 });
});
