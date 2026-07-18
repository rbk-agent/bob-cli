const os = require('node:os');
const { run, hasCommand } = require('../run');
const { parseRfkillBlocked } = require('../rfkill');

// Parse `ip -j addr show` — filter to physical interfaces only
// (exclude lo, docker*, br-*, veth*, tailscale0 — those are covered elsewhere)
const VIRTUAL_PATTERNS = [/^lo$/, /^docker\d*$/, /^br-/, /^veth/, /^tailscale0$/];

function isVirtual(ifname) {
  return VIRTUAL_PATTERNS.some((p) => p.test(ifname));
}

function parseInterfaces(ipJson) {
  const out = [];
  for (const iface of ipJson) {
    if (isVirtual(iface.ifname)) continue;
    const inet = (iface.addr_info || []).find((a) => a.family === 'inet');
    const inet6 = (iface.addr_info || []).find((a) => a.family === 'inet6' && a.scope === 'global');
    const isUp = (iface.flags || []).includes('UP');
    const isWifi = iface.ifname.startsWith('wl');
    const isEthernet = iface.ifname.startsWith('en') && !iface.ifname.startsWith('w');
    out.push({
      name: iface.ifname,
      mac: iface.address ?? null,
      state: iface.operstate ?? (isUp ? 'UP' : 'DOWN'),
      type: isWifi ? 'wifi' : isEthernet ? 'ethernet' : 'other',
      ip: inet ? inet.local : null,
      cidr: inet ? `${inet.local}/${inet.prefixlen}` : null,
      ipv6: inet6 ? inet6.local : null,
      mtu: iface.mtu ?? null,
    });
  }
  return out;
}

// Parse `nmcli -t -f active,ssid,signal,freq,channel dev wifi` for connected wifi
function parseWifi(raw) {
  for (const line of raw.split('\n')) {
    const parts = line.split(':');
    if (parts[0] === 'yes') {
      return {
        ssid: parts[1] ?? null,
        signal: parts[2] ? Number(parts[2]) : null,
        freq: parts[3] ?? null,
      };
    }
  }
  return null;
}

// Parse `tailscale status --json` for self + peers
function parseTailscale(raw) {
  const json = JSON.parse(raw);
  const self = {
    hostname: json.Self?.HostName ?? null,
    ips: json.TailscaleIPs ?? [],
    state: json.BackendState ?? null,
  };
  const peers = [];
  const peerMap = json.Peer || {};
  for (const [id, p] of Object.entries(peerMap)) {
    peers.push({
      hostname: p.HostName ?? null,
      ips: p.TailscaleIPs ?? [],
      online: p.Online ?? false,
      active: p.Active ?? false,
      relay: p.Relay ?? null,
      lastSeen: p.LastSeen ?? null,
    });
  }
  return { self, peers, running: json.BackendState === 'Running' };
}

function table(data, { verbose = false } = {}) {
  const head = verbose
    ? ['INTERFACE', 'TYPE', 'STATE', 'IP', 'MAC', 'MTU']
    : ['INTERFACE', 'TYPE', 'STATE', 'IP'];
  const rows = data.interfaces.map((i) =>
    verbose
      ? [i.name, i.type, i.state, i.ip ?? '-', i.mac ?? '-', String(i.mtu ?? '-')]
      : [i.name, i.type, i.state, i.ip ?? '-']
  );
  return { head, rows };
}

async function collect() {
  const ipRes = await run('ip', ['-j', 'addr', 'show']);
  if (!ipRes.ok) {
    return { available: false, reason: 'ip command unavailable (install iproute2)' };
  }
  let interfaces;
  try {
    interfaces = parseInterfaces(JSON.parse(ipRes.stdout));
  } catch (e) {
    return { available: false, reason: `failed to parse ip output: ${e.message}` };
  }

  // rfkill for wifi/bt block status
  const rfkillRes = await run('rfkill', ['-J']);
  const wifiBlocked = parseRfkillBlocked(rfkillRes.ok ? rfkillRes.stdout : '', 'wlan');

  // nmcli for wifi details
  const hasNmcli = await hasCommand('nmcli');
  let wifi = null;
  if (hasNmcli) {
    const wifiRes = await run('nmcli', ['-t', '-f', 'active,ssid,signal,freq', 'dev', 'wifi']);
    if (wifiRes.ok) wifi = parseWifi(wifiRes.stdout);
  }

  // tailscale
  const hasTailscale = await hasCommand('tailscale');
  let tailscale = null;
  if (hasTailscale) {
    const tsRes = await run('tailscale', ['status', '--json']);
    if (tsRes.ok) {
      try { tailscale = parseTailscale(tsRes.stdout); } catch {}
    }
  }

  // host / fallback info via node os
  const hostname = os.hostname();

  return {
    available: true,
    data: {
      hostname,
      interfaces,
      wifiBlocked,
      wifi,
      tailscale,
    },
  };
}

module.exports = {
  name: 'network',
  title: 'Network',
  parseInterfaces,
  parseWifi,
  parseTailscale,
  isVirtual,
  table,
  collect,
};