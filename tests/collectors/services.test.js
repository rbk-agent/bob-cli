const { test } = require('node:test');
const assert = require('node:assert');
const services = require('../../src/collectors/services');

const FIXTURE = `  UNIT                           LOAD   ACTIVE SUB     DESCRIPTION
  avahi-daemon.service           loaded active running Avahi mDNS/DNS-SD Stack
  docker.service                 loaded active running Docker Application Container Engine
  NetworkManager.service         loaded active running Network Manager
● getty@tty1.service             loaded active running Getty on tty1
`;

test('parseServices extracts unit, state, and description', () => {
  const svcs = services.parseServices(FIXTURE);
  assert.strictEqual(svcs.length, 4);
  assert.strictEqual(svcs[0].unit, 'avahi-daemon.service');
  assert.strictEqual(svcs[0].load, 'loaded');
  assert.strictEqual(svcs[0].active, 'active');
  assert.strictEqual(svcs[0].sub, 'running');
  assert.strictEqual(svcs[0].description, 'Avahi mDNS/DNS-SD Stack');
});

test('parseServices handles the ● prefix on failed/modified units', () => {
  const svcs = services.parseServices(FIXTURE);
  const getty = svcs.find((s) => s.unit === 'getty@tty1.service');
  assert.ok(getty);
  assert.strictEqual(getty.sub, 'running');
});

test('parseServices skips non-service lines', () => {
  const svcs = services.parseServices('some-unit.target loaded active active Some target\nfoo.service loaded active running Foo');
  assert.strictEqual(svcs.length, 1);
  assert.strictEqual(svcs[0].unit, 'foo.service');
});

test('parseServices handles empty input', () => {
  assert.deepStrictEqual(services.parseServices(''), []);
});

test('table renders service rows', () => {
  const data = { services: services.parseServices(FIXTURE), count: 4 };
  const lean = services.table(data, { verbose: false });
  assert.deepStrictEqual(lean.head, ['UNIT', 'SUB', 'DESCRIPTION']);
  assert.strictEqual(lean.rows.length, 4);

  const verbose = services.table(data, { verbose: true });
  assert.deepStrictEqual(verbose.head, ['UNIT', 'LOAD', 'ACTIVE', 'SUB', 'DESCRIPTION']);
});