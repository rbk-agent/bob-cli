const { run, hasCommand } = require('../run');

// Parse `dpkg -l` — lines after header:
//   ii  acl     2.3.2-1build1.1   amd64   access control list - utilities
function parseDpkg(raw) {
  const out = [];
  const lines = raw.split('\n');
  for (const line of lines) {
    // Skip header lines containing "Desired=" or "||/"
    if (line.startsWith('Desired=') || line.startsWith('|/')) continue;
    if (!line.trim()) continue;
    // Format: status  name  version  arch  description
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    // dpkg -l uses 3-char status field followed by space then package data
    // Actually the format is: "ii  name version arch description..."
    // The first field is 2-3 chars, but may have leading spaces
    const match = line.match(/^([a-z]{2,3})\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/);
    if (!match) continue;
    const [, status, name, version, arch, description] = match;
    // Only show "ii" (installed) packages
    if (status !== 'ii') continue;
    out.push({ name, version, arch, description: description.trim() || null, status });
  }
  return out;
}

// By default show a summary (count + manager). With --list show the full table.
function table(data, { verbose = false, list = false } = {}) {
  if (!list) {
    const head = ['FIELD', 'VALUE'];
    const rows = [
      ['Manager', data.manager],
      ['Packages', String(data.count)],
    ];
    return { head, rows };
  }
  const head = verbose
    ? ['NAME', 'VERSION', 'ARCH', 'DESCRIPTION']
    : ['NAME', 'VERSION'];
  const rows = data.packages.map((p) =>
    verbose
      ? [p.name, p.version, p.arch, p.description ?? '-']
      : [p.name, p.version]
  );
  return { head, rows };
}

async function collect() {
  const hasDpkg = await hasCommand('dpkg');

  // Try dpkg first (Debian/Ubuntu)
  if (hasDpkg) {
    const res = await run('dpkg', ['-l']);
    if (res.ok) {
      const packages = parseDpkg(res.stdout);
      if (packages.length > 0) {
        return { available: true, data: { packages, count: packages.length, manager: 'dpkg' } };
      }
    }
  }

  // Try rpm (Fedora/RHEL)
  const hasRpm = await hasCommand('rpm');
  if (hasRpm) {
    const res = await run('rpm', ['-qa', '--qf', '%{NAME}\t%{VERSION}-%{RELEASE}\t%{ARCH}\t%{SUMMARY}\n']);
    if (res.ok) {
      const packages = [];
      for (const line of res.stdout.split('\n')) {
        if (!line.trim()) continue;
        const [name, version, arch, description] = line.split('\t');
        packages.push({ name, version, arch, description: description || null, status: 'ii' });
      }
      if (packages.length > 0) {
        return { available: true, data: { packages, count: packages.length, manager: 'rpm' } };
      }
    }
  }

  // Try pacman (Arch)
  const hasPacman = await hasCommand('pacman');
  if (hasPacman) {
    const res = await run('pacman', ['-Q']);
    if (res.ok) {
      const packages = [];
      for (const line of res.stdout.split('\n')) {
        if (!line.trim()) continue;
        const [name, version] = line.split(/\s+/);
        packages.push({ name, version, arch: null, description: null, status: 'ii' });
      }
      if (packages.length > 0) {
        return { available: true, data: { packages, count: packages.length, manager: 'pacman' } };
      }
    }
  }

  return { available: false, reason: 'dpkg/rpm/pacman unavailable (unknown package manager)' };
}

module.exports = {
  name: 'software',
  title: 'Software',
  options: [['--list', 'show the full package list instead of a summary']],
  parseDpkg,
  table,
  collect,
};