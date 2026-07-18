const { run, hasCommand } = require('../run');

// Parse `lsusb` text output:
//   Bus 002 Device 006: ID 5986:0366 Bison Electronics Inc. Integrated Camera
function parseUsb(raw) {
  const out = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^Bus (\d+)\s+Device (\d+):\s+ID ([0-9a-f]{4}):([0-9a-f]{4})\s+(.*)$/i);
    if (!m) continue;
    out.push({
      bus: Number(m[1]),
      device: Number(m[2]),
      vendorId: m[3].toUpperCase(),
      productId: m[4].toUpperCase(),
      description: m[5].trim() || null,
    });
  }
  return out;
}

// Parse `lspci -mm` output:
//   00:02.0 "VGA compatible controller" "Intel Corporation" "4th Gen Core Processor Integrated Graphics Controller" "Lenovo" "4th Gen Core Processor Integrated Graphics Controller"
function parsePci(raw) {
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    // -mm uses double-quoted fields separated by spaces
    const fields = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let j = i + 1;
        let buf = '';
        while (j < line.length) {
          if (line[j] === '"' && line[j + 1] === '"') { buf += '"'; j += 2; continue; }
          if (line[j] === '"') break;
          buf += line[j]; j++;
        }
        fields.push(buf);
        i = j + 1;
      } else { i++; }
    }
    // slot is before the first quote
    const slotMatch = line.match(/^(\S+)/);
    out.push({
      slot: slotMatch ? slotMatch[1] : null,
      className: fields[0] ?? null,
      vendor: fields[1] ?? null,
      device: fields[2] ?? null,
      subsystemVendor: fields[3] ?? null,
      subsystemDevice: fields[4] ?? null,
    });
  }
  return out;
}

function table(data, { verbose = false } = {}) {
  const usb = data.usb || [];
  const pci = data.pci || [];
  const head = verbose
    ? ['BUS/DEV', 'VENDOR:PRODUCT', 'DESCRIPTION', 'TYPE']
    : ['DEVICE', 'DESCRIPTION'];
  const rows = [];
  for (const d of usb) {
    const id = `USB ${d.bus}:${d.device}`;
    rows.push(verbose
      ? [id, `${d.vendorId}:${d.productId}`, d.description ?? '-', 'USB']
      : [id, d.description ?? '-']);
  }
  for (const d of pci) {
    const id = `PCI ${d.slot}`;
    rows.push(verbose
      ? [id, `${d.vendor ?? '-'}`, d.device ?? d.className ?? '-', 'PCI']
      : [id, d.device ?? d.className ?? '-']);
  }
  return { head, rows };
}

async function collect() {
  const usbRes = await run('lsusb', []);
  const hasPci = await hasCommand('lspci');
  const pciRes = hasPci ? await run('lspci', ['-mm']) : { ok: false };
  if (!usbRes.ok && !pciRes.ok) {
    return { available: false, reason: 'lsusb and lspci unavailable (install usbutils and pciutils)' };
  }
  const data = {
    usb: usbRes.ok ? parseUsb(usbRes.stdout) : [],
    pci: pciRes.ok ? parsePci(pciRes.stdout) : [],
  };
  if (data.usb.length === 0 && data.pci.length === 0) {
    return { available: false, reason: 'no devices found' };
  }
  return { available: true, data };
}

module.exports = { name: 'devices', title: 'Devices', parseUsb, parsePci, table, collect };