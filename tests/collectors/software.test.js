const { test } = require('node:test');
const assert = require('node:assert');
const software = require('../../src/collectors/software');

const DPKG_FIXTURE = `Desired=Unknown/Install/Remove/Purge/Hold
| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend
|/ Err?=(none)/Reinst-required (Status,Err: uppercase=bad)
||/ Name                                  Version                                 Architecture Description
+++-=====================================-=======================================-============-================================================================================
ii  acl                                   2.3.2-1build1.1                         amd64        access control list - utilities
ii  adduser                               3.137ubuntu1                            all          add and remove users and groups
rc  old-package                           1.0                                     amd64        removed but config remains
`;

test('parseDpkg extracts installed (ii) packages only', () => {
  const pkgs = software.parseDpkg(DPKG_FIXTURE);
  assert.strictEqual(pkgs.length, 2); // skips header lines and the "rc" package
  assert.strictEqual(pkgs[0].name, 'acl');
  assert.strictEqual(pkgs[0].version, '2.3.2-1build1.1');
  assert.strictEqual(pkgs[0].arch, 'amd64');
  assert.strictEqual(pkgs[0].description, 'access control list - utilities');
  assert.strictEqual(pkgs[1].name, 'adduser');
});

test('parseDpkg skips header lines and non-ii status', () => {
  const pkgs = software.parseDpkg(DPKG_FIXTURE);
  assert.ok(!pkgs.find((p) => p.name === 'old-package'));
  assert.ok(!pkgs.find((p) => p.name === 'Name'));
});

test('parseDpkg handles empty input', () => {
  assert.deepStrictEqual(software.parseDpkg(''), []);
});

test('table defaults to a summary (count + manager)', () => {
  const data = { packages: software.parseDpkg(DPKG_FIXTURE), count: 2, manager: 'dpkg' };
  const summary = software.table(data, { verbose: false });
  assert.deepStrictEqual(summary.head, ['FIELD', 'VALUE']);
  assert.strictEqual(summary.rows.length, 2);
  assert.strictEqual(summary.rows[0][0], 'Manager');
  assert.strictEqual(summary.rows[0][1], 'dpkg');
  assert.strictEqual(summary.rows[1][0], 'Packages');
  assert.strictEqual(summary.rows[1][1], '2');
});

test('table with --list shows the full package list', () => {
  const data = { packages: software.parseDpkg(DPKG_FIXTURE), count: 2, manager: 'dpkg' };
  const lean = software.table(data, { verbose: false, list: true });
  assert.deepStrictEqual(lean.head, ['NAME', 'VERSION']);
  assert.strictEqual(lean.rows.length, 2);

  const verbose = software.table(data, { verbose: true, list: true });
  assert.deepStrictEqual(verbose.head, ['NAME', 'VERSION', 'ARCH', 'DESCRIPTION']);
  assert.ok(verbose.rows[0].includes('amd64'));
});