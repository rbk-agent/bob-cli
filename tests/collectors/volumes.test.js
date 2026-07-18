const { test } = require('node:test');
const assert = require('node:assert');
const volumes = require('../../src/collectors/volumes');

const FIXTURE = JSON.stringify({
  blockdevices: [
    {
      name: 'sda', size: '256060514304', type: 'disk',
      fstype: null, mountpoint: null, model: 'Samsung SSD ',
      rm: false, tran: 'sata', fsavail: null, 'fsuse%': null,
      children: [
        { name: 'sda1', size: '254900000000', type: 'part', fstype: 'ext4', mountpoint: '/', model: null, rm: false, tran: null, fsavail: '160134803456', 'fsuse%': '31%' },
      ],
    },
    {
      name: 'sdb', size: '1800000000000', type: 'disk',
      fstype: null, mountpoint: null, model: 'Extreme 55DD',
      rm: false, tran: 'usb', fsavail: null, 'fsuse%': null,
      children: [
        { name: 'sdb1', size: '1800000000000', type: 'part', fstype: 'exfat', mountpoint: '/mnt/usb', model: null, rm: false, tran: null, fsavail: '1242864549888', 'fsuse%': '38%' },
      ],
    },
  ],
});

test('parse flattens the block-device tree with nesting level, tran, rm, and fs usage', () => {
  const data = volumes.parse(FIXTURE);
  assert.strictEqual(data.length, 4);
  assert.deepStrictEqual(data[0], {
    name: 'sda', size: 256060514304, used: null, fsAvail: null, fsUsePct: null,
    type: 'disk', fstype: null, mountpoint: null, model: 'Samsung SSD',
    tran: 'sata', rm: false, level: 0,
  });
  // sda1 has filesystem usage
  assert.strictEqual(data[1].name, 'sda1');
  assert.strictEqual(data[1].fsAvail, 160134803456);
  assert.strictEqual(data[1].fsUsePct, 31);
  assert.strictEqual(data[1].used, 254900000000 - 160134803456);
  assert.strictEqual(data[2].name, 'sdb');
  assert.strictEqual(data[2].tran, 'usb');
});

test('isExternal flags USB disks and their children, but not SATA', () => {
  const data = volumes.parse(FIXTURE);
  assert.strictEqual(volumes.isExternal(data[0], data), false); // sda — sata
  assert.strictEqual(volumes.isExternal(data[1], data), false); // sda1 — child of sata
  assert.strictEqual(volumes.isExternal(data[2], data), true);  // sdb — usb
  assert.strictEqual(volumes.isExternal(data[3], data), true);  // sdb1 — child of usb
});

test('table is lean by default with used/avail/use% and wide with verbose', () => {
  const data = volumes.parse(FIXTURE);
  const lean = volumes.table(data, { verbose: false });
  assert.deepStrictEqual(lean.head, ['NAME', 'SIZE', 'USED', 'AVAIL', 'USE%', 'TYPE', 'MOUNTPOINT']);
  assert.strictEqual(lean.rows[1][0], '  sda1');
  // sda1 has 31% usage
  assert.strictEqual(lean.rows[1][4], '31%');

  const verbose = volumes.table(data, { verbose: true });
  assert.deepStrictEqual(verbose.head, ['NAME', 'SIZE', 'USED', 'AVAIL', 'USE%', 'TYPE', 'FSTYPE', 'MOUNTPOINT', 'MODEL', 'TRANSPORT', 'EXTERNAL']);
  // sdb row should show usb + yes
  const sdbRow = verbose.rows.find((r) => r[0] === 'sdb');
  assert.strictEqual(sdbRow[9], 'usb');
  assert.strictEqual(sdbRow[10], 'yes');
  // sdb1 should also be external (inherited)
  const sdb1Row = verbose.rows.find((r) => r[0] === '  sdb1');
  assert.strictEqual(sdb1Row[10], 'yes');
});