const os = require('node:os');
const fs = require('node:fs');
const { run } = require('../run');

// Parse /etc/os-release
function parseOsRelease(raw) {
  const map = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(?:"([^"]*)"|([^#]*))$/);
    if (m) map[m[1]] = m[2] ?? m[3]?.trim() ?? '';
  }
  return {
    name: map.NAME ?? null,
    version: map.VERSION ?? null,
    id: map.ID ?? null,
    prettyName: map.PRETTY_NAME ?? null,
    versionId: map.VERSION_ID ?? null,
    codename: map.VERSION_CODENAME ?? null,
  };
}

function formatUptime(seconds) {
  const s = Math.floor(seconds);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return parts.join(' ');
}

function parse(raw) {
  return raw; // passthrough — parse functions are per-source
}

function table(data, { verbose = false } = {}) {
  const fields = [
    ['Hostname', data.hostname],
    ['OS', data.os.prettyName ?? data.os.name],
    ['Kernel', data.kernel],
    ['Architecture', data.arch],
    ['Uptime', formatUptime(data.uptime)],
  ];
  if (verbose) {
    fields.push(
      ['OS ID', data.os.id],
      ['Version ID', data.os.versionId],
      ['Codename', data.os.codename],
      ['Kernel release', data.kernelRelease],
      ['Kernel machine', data.kernelMachine],
      ['CPUs', String(data.cpus)],
      ['Total memory', `${Math.round(data.totalMem / (1024 ** 3))} GB`],
    );
    if (data.vendor) fields.push(['Vendor', data.vendor]);
    if (data.model) fields.push(['Model', data.model]);
    if (data.firmware) fields.push(['Firmware', data.firmware]);
  }
  return { head: ['FIELD', 'VALUE'], rows: fields.map(([k, v]) => [k, v ?? '-']) };
}

async function collect() {
  // /etc/os-release
  let osInfo = {};
  try {
    const raw = fs.readFileSync('/etc/os-release', 'utf8');
    osInfo = parseOsRelease(raw);
  } catch {
    // Fallback to lsb_release
    const lsbRes = await run('lsb_release', ['-a']);
    if (lsbRes.ok) {
      const lines = lsbRes.stdout.split('\n');
      const get = (key) => {
        const m = lines.find((l) => l.startsWith(`${key}:`));
        return m ? m.replace(`${key}:`, '').trim() : null;
      };
      osInfo = {
        name: get('Distributor ID'),
        version: get('Description'),
        id: get('Distributor ID')?.toLowerCase() ?? null,
        prettyName: get('Description'),
        versionId: get('Release'),
        codename: get('Codename'),
      };
    }
  }

  // hostnamectl for hardware info
  let vendor = null, model = null, firmware = null;
  const hcRes = await run('hostnamectl', []);
  if (hcRes.ok) {
    for (const line of hcRes.stdout.split('\n')) {
      const m = line.match(/^\s*(.+?):\s+(.+)$/);
      if (!m) continue;
      const [, key, val] = m;
      if (key === 'Hardware Vendor') vendor = val.trim();
      if (key === 'Hardware Model') model = val.trim();
      if (key === 'Firmware Version') firmware = val.trim();
    }
  }

  const cpus = os.cpus();
  const totalMem = os.totalmem();

  return {
    available: true,
    data: {
      hostname: os.hostname(),
      os: osInfo,
      kernel: os.release(),
      kernelRelease: os.release(),
      kernelMachine: os.arch(),
      arch: os.arch(),
      uptime: os.uptime(),
      cpus: cpus.length,
      totalMem,
      vendor,
      model,
      firmware,
    },
  };
}

module.exports = {
  name: 'os',
  title: 'Operating System',
  parseOsRelease,
  formatUptime,
  table,
  collect,
};