const { test } = require('node:test');
const assert = require('node:assert');
const os = require('../../src/collectors/os');

const OS_RELEASE_FIXTURE = `PRETTY_NAME="Ubuntu 24.04.3 LTS"
NAME="Ubuntu"
VERSION_ID="24.04"
VERSION="24.04.3 LTS (Noble Numbat)"
VERSION_CODENAME=noble
ID=ubuntu
ID_LIKE=debian
HOME_URL="https://www.ubuntu.com/"
`;

test('parseOsRelease extracts key fields including quoted and unquoted values', () => {
  const info = os.parseOsRelease(OS_RELEASE_FIXTURE);
  assert.strictEqual(info.name, 'Ubuntu');
  assert.strictEqual(info.prettyName, 'Ubuntu 24.04.3 LTS');
  assert.strictEqual(info.id, 'ubuntu');
  assert.strictEqual(info.versionId, '24.04');
  assert.strictEqual(info.codename, 'noble');
  assert.ok(info.version.includes('Noble Numbat'));
});

test('parseOsRelease handles empty input', () => {
  const info = os.parseOsRelease('');
  assert.strictEqual(info.name, null);
  assert.strictEqual(info.prettyName, null);
});

test('formatUptime formats days, hours, minutes', () => {
  assert.strictEqual(os.formatUptime(0), '0m');
  assert.strictEqual(os.formatUptime(60), '1m');
  assert.strictEqual(os.formatUptime(3600), '1h 0m');
  assert.strictEqual(os.formatUptime(90000), '1d 1h 0m');
  assert.strictEqual(os.formatUptime(922864), '10d 16h 21m');
});

test('table renders OS info fields', () => {
  const data = {
    hostname: 'myhost',
    os: { prettyName: 'Ubuntu 24.04', name: 'Ubuntu', id: 'ubuntu', versionId: '24.04', codename: 'noble' },
    kernel: '6.8.0-134',
    arch: 'x64',
    uptime: 3600,
    kernelRelease: '6.8.0-134',
    kernelMachine: 'x64',
    cpus: 4,
    totalMem: 8011722752,
    vendor: 'Lenovo',
    model: 'ThinkPad T450s',
    firmware: '1.35',
  };
  const lean = os.table(data, { verbose: false });
  assert.deepStrictEqual(lean.head, ['FIELD', 'VALUE']);
  assert.ok(lean.rows.length >= 5);
  const hostnameRow = lean.rows.find((r) => r[0] === 'Hostname');
  assert.strictEqual(hostnameRow[1], 'myhost');

  const verbose = os.table(data, { verbose: true });
  assert.ok(verbose.rows.length > lean.rows.length);
  assert.ok(verbose.rows.find((r) => r[0] === 'Vendor'));
});