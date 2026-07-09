const { test } = require('node:test');
const assert = require('node:assert');
const cpu = require('../../src/collectors/cpu');

const FIXTURE = JSON.stringify({
  lscpu: [
    { field: 'Architecture:', data: 'x86_64' },
    { field: 'CPU(s):', data: '4' },
    { field: 'Vendor ID:', data: 'GenuineIntel' },
    { field: 'Model name:', data: 'Intel Core i7-5600U' },
    { field: 'Thread(s) per core:', data: '2' },
    { field: 'Core(s) per socket:', data: '2' },
    { field: 'Socket(s):', data: '1' },
    { field: 'CPU max MHz:', data: '3200.0000' },
    { field: 'CPU min MHz:', data: '500.0000' },
  ],
});

test('parse pulls the key CPU fields with numeric coercion', () => {
  const data = cpu.parse(FIXTURE);
  assert.strictEqual(data.model, 'Intel Core i7-5600U');
  assert.strictEqual(data.architecture, 'x86_64');
  assert.strictEqual(data.cpus, 4);
  assert.strictEqual(data.sockets, 1);
  assert.strictEqual(data.maxMHz, 3200);
});

test('lean table shows fewer rows than verbose', () => {
  const data = cpu.parse(FIXTURE);
  assert.ok(cpu.table(data, { verbose: false }).rows.length < cpu.table(data, { verbose: true }).rows.length);
});
