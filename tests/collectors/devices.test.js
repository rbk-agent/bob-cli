const { test } = require('node:test');
const assert = require('node:assert');
const devices = require('../../src/collectors/devices');

const USB_FIXTURE = `Bus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub
Bus 002 Device 004: ID 138a:0017 Validity Sensors, Inc. VFS 5011 fingerprint sensor
Bus 002 Device 008: ID 1397:0509 BEHRINGER International GmbH UMC404HD 192k
`;

const PCI_FIXTURE = `"VGA compatible controller" "Intel Corporation" "HD Graphics 5500" "Lenovo" "HD Graphics 5500"
"Ethernet controller" "Intel Corporation" "Ethernet Connection I218-LM" "Lenovo" "ThinkPad T450s"
`;

test('parseUsb extracts bus, device, vendor/product IDs, and description', () => {
  const usb = devices.parseUsb(USB_FIXTURE);
  assert.strictEqual(usb.length, 3);
  assert.deepStrictEqual(usb[0], {
    bus: 1, device: 1, vendorId: '1D6B', productId: '0002',
    description: 'Linux Foundation 2.0 root hub',
  });
  assert.strictEqual(usb[1].vendorId, '138A');
  assert.strictEqual(usb[1].productId, '0017');
  assert.ok(usb[2].description.includes('UMC404HD'));
});

test('parsePci extracts slot, class, vendor, and device from -mm output', () => {
  const pci = devices.parsePci(PCI_FIXTURE);
  assert.strictEqual(pci.length, 2);
  // First line has no slot prefix in this fixture — slot will be null
  assert.strictEqual(pci[0].className, 'VGA compatible controller');
  assert.strictEqual(pci[0].vendor, 'Intel Corporation');
  assert.strictEqual(pci[0].device, 'HD Graphics 5500');
});

test('table combines USB and PCI devices', () => {
  const data = {
    usb: devices.parseUsb(USB_FIXTURE),
    pci: devices.parsePci(PCI_FIXTURE),
  };
  const lean = devices.table(data, { verbose: false });
  assert.strictEqual(lean.rows.length, 5);
  assert.ok(lean.head.includes('DEVICE'));
  assert.ok(lean.rows[0][0].startsWith('USB'));

  const verbose = devices.table(data, { verbose: true });
  assert.strictEqual(verbose.rows.length, 5);
  assert.deepStrictEqual(verbose.head, ['BUS/DEV', 'VENDOR:PRODUCT', 'DESCRIPTION', 'TYPE']);
});

test('parseUsb handles empty output', () => {
  assert.deepStrictEqual(devices.parseUsb(''), []);
});

test('parsePci handles empty output', () => {
  assert.deepStrictEqual(devices.parsePci(''), []);
});