const { run } = require('../run');
const { formatBytes } = require('../output');

function parse(raw) {
  const json = JSON.parse(raw);
  const out = [];
  const walk = (devs, level) => {
    for (const d of devs) {
      const size = d.size === null || d.size === undefined ? null : Number(d.size);
      const fsAvail = d.fsavail === null || d.fsavail === undefined ? null : Number(d.fsavail);
      // fsuse% is a string like "31%" or null
      const fsUsePct = d['fsuse%'] === null || d['fsuse%'] === undefined ? null : Number(d['fsuse%'].replace('%', ''));
      // Compute used = size - avail (only meaningful for mounted filesystems)
      const used = (size !== null && fsAvail !== null) ? size - fsAvail : null;

      out.push({
        name: d.name,
        size,
        used,
        fsAvail,
        fsUsePct,
        type: d.type ?? null,
        fstype: d.fstype ?? null,
        mountpoint: d.mountpoint ?? null,
        model: (d.model ?? '').trim() || null,
        tran: d.tran ?? null,
        rm: d.rm ?? false,
        level,
      });
      if (Array.isArray(d.children)) walk(d.children, level + 1);
    }
  };
  walk(json.blockdevices || [], 0);
  return out;
}

// External = removable flag OR transport is usb/thunderbolt/firewire/pcmcia/sd
// Walk up parent chain (tracks tran/rm inheritance via level)
function isExternal(d, allDevices) {
  const ext = ['usb', 'thunderbolt', 'firewire', 'pcmcia', 'sd'];
  if (d.rm === true) return true;
  if (d.tran && ext.includes(d.tran)) return true;
  // Partitions/lvm don't carry tran — check if any ancestor disk is external
  if (allDevices && d.level > 0) {
    // Find ancestors by walking up levels (same name prefix)
    for (let i = allDevices.indexOf(d) - 1; i >= 0; i--) {
      const a = allDevices[i];
      if (a.level >= d.level) continue;
      if (a.rm === true) return true;
      if (a.tran && ext.includes(a.tran)) return true;
      if (a.level === 0) break;
    }
  }
  return false;
}

function fmtUse(d) {
  if (d.fsUsePct !== null) return `${d.fsUsePct}%`;
  if (d.used !== null) return formatBytes(d.used);
  return '-';
}

function table(data, { verbose = false } = {}) {
  const head = verbose
    ? ['NAME', 'SIZE', 'USED', 'AVAIL', 'USE%', 'TYPE', 'FSTYPE', 'MOUNTPOINT', 'MODEL', 'TRANSPORT', 'EXTERNAL']
    : ['NAME', 'SIZE', 'USED', 'AVAIL', 'USE%', 'TYPE', 'MOUNTPOINT'];
  const rows = data.map((d) => {
    const name = '  '.repeat(d.level) + d.name;
    if (verbose) {
      return [name, formatBytes(d.size), formatBytes(d.used), formatBytes(d.fsAvail), fmtUse(d), d.type ?? '-', d.fstype ?? '-', d.mountpoint ?? '-', d.model ?? '-', d.tran ?? '-', isExternal(d, data) ? 'yes' : 'no'];
    }
    return [name, formatBytes(d.size), formatBytes(d.used), formatBytes(d.fsAvail), fmtUse(d), d.type ?? '-', d.mountpoint ?? '-'];
  });
  return { head, rows };
}

async function collect() {
  const res = await run('lsblk', ['-J', '-b', '-o', 'NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,MODEL,RM,TRAN,FSAVAIL,FSUSE%']);
  if (!res.ok) return { available: false, reason: 'lsblk unavailable (install util-linux)' };
  try {
    return { available: true, data: parse(res.stdout) };
  } catch (e) {
    return { available: false, reason: `failed to parse lsblk output: ${e.message}` };
  }
}

module.exports = { name: 'volumes', title: 'Volumes', parse, table, collect, isExternal };