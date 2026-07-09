const { run } = require('../run');
const { formatBytes } = require('../output');

function parse(raw) {
  const json = JSON.parse(raw);
  const out = [];
  const walk = (devs, level) => {
    for (const d of devs) {
      out.push({
        name: d.name,
        size: d.size === null || d.size === undefined ? null : Number(d.size),
        type: d.type ?? null,
        fstype: d.fstype ?? null,
        mountpoint: d.mountpoint ?? null,
        model: (d.model ?? '').trim() || null,
        level,
      });
      if (Array.isArray(d.children)) walk(d.children, level + 1);
    }
  };
  walk(json.blockdevices || [], 0);
  return out;
}

function table(data, { verbose = false } = {}) {
  const head = verbose
    ? ['NAME', 'SIZE', 'TYPE', 'FSTYPE', 'MOUNTPOINT', 'MODEL']
    : ['NAME', 'SIZE', 'TYPE', 'MOUNTPOINT'];
  const rows = data.map((d) => {
    const name = '  '.repeat(d.level) + d.name;
    return verbose
      ? [name, formatBytes(d.size), d.type ?? '-', d.fstype ?? '-', d.mountpoint ?? '-', d.model ?? '-']
      : [name, formatBytes(d.size), d.type ?? '-', d.mountpoint ?? '-'];
  });
  return { head, rows };
}

async function collect() {
  const res = await run('lsblk', ['-J', '-b', '-o', 'NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,MODEL']);
  if (!res.ok) return { available: false, reason: 'lsblk unavailable (install util-linux)' };
  try {
    return { available: true, data: parse(res.stdout) };
  } catch (e) {
    return { available: false, reason: `failed to parse lsblk output: ${e.message}` };
  }
}

module.exports = { name: 'volumes', title: 'Volumes', parse, table, collect };
