const { run, hasCommand } = require('../run');
const { parseRfkillBlocked } = require('../rfkill');

// Parse `hcitool dev`:
//   Devices:
//       hci0  34:02:86:B1:2F:55
function parseAdapters(raw) {
  const out = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*(\S+)\s+([0-9A-Fa-f:]{17})\s*$/);
    if (m) {
      out.push({ name: m[1], address: m[2].toUpperCase() });
    }
  }
  return out;
}

// Parse `hcitool con`:
//   Connections:
//       > ACL E8:D5:2B:4F:4E:E1 handle 256 state 1 lm PERIPHERAL AUTH ENCRYPT
function parseConnections(raw) {
  const out = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*>\s+(\w+)\s+([0-9A-Fa-f:]{17})\s+handle\s+(\d+)\s+state\s+(\d+)\s+lm\s+(.*)$/i);
    if (m) {
      out.push({
        link: m[1],
        address: m[2].toUpperCase(),
        handle: Number(m[3]),
        state: Number(m[4]),
        mode: m[5].trim(),
      });
    }
  }
  return out;
}

function table(data, { verbose = false } = {}) {
  const head = verbose
    ? ['TYPE', 'ADDRESS', 'DETAILS']
    : ['TYPE', 'ADDRESS', 'DETAILS'];
  const rows = [];
  for (const a of data.adapters || []) {
    rows.push(['Adapter', a.address, a.name]);
  }
  for (const c of data.connections || []) {
    rows.push(verbose
      ? ['Connected', c.address, `${c.link} handle=${c.handle} ${c.mode}`]
      : ['Connected', c.address, c.link]);
  }
  return { head, rows };
}

async function collect() {
  const hasHcitool = await hasCommand('hcitool');
  const hasRfkill = await hasCommand('rfkill');

  if (!hasHcitool && !hasRfkill) {
    return { available: false, reason: 'hcitool and rfkill unavailable (install bluez and rfkill)' };
  }

  const rfkillRes = hasRfkill ? await run('rfkill', ['-J']) : { ok: false };
  const blocked = parseRfkillBlocked(rfkillRes.ok ? rfkillRes.stdout : '', 'bluetooth');

  let adapters = [];
  let connections = [];
  if (hasHcitool) {
    const devRes = await run('hcitool', ['dev']);
    if (devRes.ok) adapters = parseAdapters(devRes.stdout);
    const conRes = await run('hcitool', ['con']);
    if (conRes.ok) connections = parseConnections(conRes.stdout);
  }

  if (adapters.length === 0 && connections.length === 0 && blocked === null) {
    return { available: false, reason: 'no bluetooth adapter found' };
  }

  return {
    available: true,
    data: {
      adapters,
      connections,
      blocked,
    },
  };
}

module.exports = {
  name: 'bluetooth',
  title: 'Bluetooth',
  parseAdapters,
  parseConnections,
  table,
  collect,
};