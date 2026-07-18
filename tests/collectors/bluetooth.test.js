const { test } = require('node:test');
const assert = require('node:assert');
const bluetooth = require('../../src/collectors/bluetooth');

const DEV_FIXTURE = `Devices:
\thci0\t34:02:86:B1:2F:55
`;

const CON_FIXTURE = `Connections:
\t> ACL E8:D5:2B:4F:4E:E1 handle 256 state 1 lm PERIPHERAL AUTH ENCRYPT 
`;

test('parseAdapters extracts adapter name and address', () => {
  const adapters = bluetooth.parseAdapters(DEV_FIXTURE);
  assert.strictEqual(adapters.length, 1);
  assert.strictEqual(adapters[0].name, 'hci0');
  assert.strictEqual(adapters[0].address, '34:02:86:B1:2F:55');
});

test('parseAdapters handles empty output', () => {
  assert.deepStrictEqual(bluetooth.parseAdapters('Devices:\n'), []);
  assert.deepStrictEqual(bluetooth.parseAdapters(''), []);
});

test('parseConnections extracts connected device details', () => {
  const cons = bluetooth.parseConnections(CON_FIXTURE);
  assert.strictEqual(cons.length, 1);
  assert.strictEqual(cons[0].link, 'ACL');
  assert.strictEqual(cons[0].address, 'E8:D5:2B:4F:4E:E1');
  assert.strictEqual(cons[0].handle, 256);
  assert.strictEqual(cons[0].state, 1);
  assert.ok(cons[0].mode.includes('PERIPHERAL'));
});

test('parseConnections handles no connections', () => {
  assert.deepStrictEqual(bluetooth.parseConnections('Connections:\n'), []);
});

test('table shows adapters and connections', () => {
  const data = {
    adapters: bluetooth.parseAdapters(DEV_FIXTURE),
    connections: bluetooth.parseConnections(CON_FIXTURE),
    blocked: false,
  };
  const lean = bluetooth.table(data, { verbose: false });
  assert.strictEqual(lean.rows.length, 2);
  assert.strictEqual(lean.rows[0][0], 'Adapter');
  assert.strictEqual(lean.rows[1][0], 'Connected');

  const verbose = bluetooth.table(data, { verbose: true });
  assert.ok(verbose.rows[1][2].includes('handle=256'));
});