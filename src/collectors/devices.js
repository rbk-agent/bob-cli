const fs = require('node:fs');
const path = require('node:path');
const { run, hasCommand } = require('../run');

// Read negotiated USB link speeds and device USB versions from sysfs. Returns a
// Map keyed by `${busnum}:${devnum}` (which match lsusb's Bus/Device numbers)
// to { speed, version } where speed is in Mbit/s and version is e.g. '3.20'.
function readUsbSpeeds() {
  const dir = '/sys/bus/usb/devices';
  const map = new Map();
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return map; }
  for (const name of entries) {
    const devPath = path.join(dir, name);
    let busnum, devnum;
    try {
      busnum = fs.readFileSync(path.join(devPath, 'busnum'), 'utf8').trim();
      devnum = fs.readFileSync(path.join(devPath, 'devnum'), 'utf8').trim();
    } catch { continue; }
    let speed;
    let version;
    try { speed = Number(fs.readFileSync(path.join(devPath, 'speed'), 'utf8').trim()); } catch {}
    try { version = fs.readFileSync(path.join(devPath, 'version'), 'utf8').trim() || null; } catch {}
    if (busnum && devnum) map.set(`${busnum}:${devnum}`, { speed, version });
  }
  return map;
}

// Human-readable link speed. Mbit/s input (from sysfs `speed`).
//   5000 -> '5 Gb/s', 10000 -> '10 Gb/s', 480 -> '480 Mb/s', 12 -> '12 Mb/s'
function formatSpeed(mbps) {
  if (mbps == null || Number.isNaN(mbps)) return '-';
  if (mbps >= 1000) {
    const gbps = mbps / 1000;
    return `${gbps % 1 === 0 ? gbps.toFixed(0) : gbps.toFixed(1)} Gb/s`;
  }
  return `${mbps} Mb/s`;
}

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
    ? ['BUS/DEV', 'VENDOR:PRODUCT', 'DESCRIPTION', 'SPEED', 'TYPE']
    : ['DEVICE', 'DESCRIPTION', 'SPEED'];
  const rows = [];
  for (const d of usb) {
    const id = `USB ${d.bus}:${d.device}`;
    const speed = formatSpeed(d.speed);
    rows.push(verbose
      ? [id, `${d.vendorId}:${d.productId}`, d.description ?? '-', speed, 'USB']
      : [id, d.description ?? '-', speed]);
  }
  for (const d of pci) {
    const id = `PCI ${d.slot}`;
    rows.push(verbose
      ? [id, `${d.vendor ?? '-'}`, d.device ?? d.className ?? '-', '-', 'PCI']
      : [id, d.device ?? d.className ?? '-', '-']);
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
  const usb = usbRes.ok ? parseUsb(usbRes.stdout) : [];
  // Enrich USB devices with negotiated link speed / USB version from sysfs.
  if (usb.length) {
    const speeds = readUsbSpeeds();
    for (const d of usb) {
      const s = speeds.get(`${d.bus}:${d.device}`);
      if (s) {
        d.speed = s.speed; // Mbit/s, or undefined if unavailable
        d.usbVersion = s.version;
      }
    }
  }
  const data = {
    usb,
    pci: pciRes.ok ? parsePci(pciRes.stdout) : [],
  };
  if (data.usb.length === 0 && data.pci.length === 0) {
    return { available: false, reason: 'no devices found' };
  }
  return { available: true, data };
}

module.exports = { name: 'devices', title: 'Devices', parseUsb, parsePci, readUsbSpeeds, formatSpeed, table, collect };