const { run, hasCommand } = require('../run');

// Parse `systemctl list-units --type=service --state=running --no-pager --no-legend --plain`
// Output format:
//   docker.service        loaded active running Docker Application Container Engine
//   ● getty@tty1.service             loaded active running Getty on tty1
function parseServices(raw) {
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    // Strip leading bullet character (●) that systemctl prepends to some units
    const cleaned = line.replace(/^●\s*/, '').trim();
    const parts = cleaned.split(/\s+/);
    if (parts.length < 4) continue;
    const unit = parts[0];
    if (!unit.endsWith('.service')) continue;
    const load = parts[1];
    const active = parts[2];
    const sub = parts[3];
    // Description = everything after the 4th field
    const description = parts.slice(4).join(' ') || null;
    out.push({
      unit,
      load,
      active,
      sub,
      description,
    });
  }
  return out;
}

function table(data, { verbose = false } = {}) {
  const head = verbose
    ? ['UNIT', 'LOAD', 'ACTIVE', 'SUB', 'DESCRIPTION']
    : ['UNIT', 'SUB', 'DESCRIPTION'];
  const rows = data.services.map((s) =>
    verbose
      ? [s.unit, s.load, s.active, s.sub, s.description ?? '-']
      : [s.unit, s.sub, s.description ?? '-']
  );
  return { head, rows };
}

async function collect() {
  const hasSystemctl = await hasCommand('systemctl');
  if (!hasSystemctl) {
    return { available: false, reason: 'systemctl unavailable (systemd not installed)' };
  }

  const res = await run('systemctl', [
    'list-units', '--type=service', '--state=running',
    '--no-pager', '--no-legend', '--plain',
  ]);
  if (!res.ok) {
    return { available: false, reason: 'systemctl list-units failed' };
  }

  const services = parseServices(res.stdout);
  if (services.length === 0) {
    return { available: false, reason: 'no running services found' };
  }

  return { available: true, data: { services, count: services.length } };
}

module.exports = {
  name: 'services',
  title: 'Services',
  parseServices,
  table,
  collect,
};