const { test } = require('node:test');
const assert = require('node:assert');
const volumes = require('../../src/collectors/volumes');

const FIXTURE = JSON.stringify({
  blockdevices: [
    {
      name: 'sda', size: '256060514304', type: 'disk',
      fstype: null, mountpoint: null, model: 'Samsung SSD ',
      children: [
        { name: 'sda1', size: '254900000000', type: 'part', fstype: 'ext4', mountpoint: '/', model: null },
      ],
    },
  ],
});

test('parse flattens the block-device tree with nesting level', () => {
  const data = volumes.parse(FIXTURE);
  assert.strictEqual(data.length, 2);
  assert.deepStrictEqual(data[0], {
    name: 'sda', size: 256060514304, type: 'disk',
    fstype: null, mountpoint: null, model: 'Samsung SSD', level: 0,
  });
  assert.deepStrictEqual(data[1], {
    name: 'sda1', size: 254900000000, type: 'part',
    fstype: 'ext4', mountpoint: '/', model: null, level: 1,
  });
});

test('table is lean by default and wide with verbose', () => {
  const data = volumes.parse(FIXTURE);
  const lean = volumes.table(data, { verbose: false });
  assert.deepStrictEqual(lean.head, ['NAME', 'SIZE', 'TYPE', 'MOUNTPOINT']);
  assert.strictEqual(lean.rows[1][0], '  sda1'); // indented by level
  const verbose = volumes.table(data, { verbose: true });
  assert.deepStrictEqual(verbose.head, ['NAME', 'SIZE', 'TYPE', 'FSTYPE', 'MOUNTPOINT', 'MODEL']);
  assert.deepStrictEqual(verbose.rows[1], ['  sda1', '237.4 GB', 'part', 'ext4', '/', '-']);
});
