const { run } = require('../run');

// Parse `ss -tnp state established '( sport = :22 )'`:
//   0      0      192.168.0.190:22   192.168.0.201:61160
function parseSsEstablished(raw) {
  const out = [];
  const lines = raw.split('\n');
  for (const line of lines) {
    // Skip header lines (contain "Recv-Q" or "Local Address")
    if (line.includes('Recv-Q') || line.includes('Local Address') || !line.trim()) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const local = parts[2] || '';
    const peer = parts[3] || '';
    const localMatch = local.match(/^(.*):(\d+)$/);
    const peerMatch = peer.match(/^(.*):(\d+)$/);
    if (!localMatch || !peerMatch) continue;
    out.push({
      localAddr: localMatch[1],
      localPort: Number(localMatch[2]),
      peerAddr: peerMatch[1],
      peerPort: Number(peerMatch[2]),
    });
  }
  return out;
}

// Parse `ss -tlnp '( sport = :22 )'` for listening
function parseSsListening(raw) {
  const lines = raw.split('\n');
  for (const line of lines) {
    if (line.includes('Recv-Q') || line.includes('Local Address') || !line.trim()) continue;
    // ss -tlnp output: State Recv-Q Send-Q Local Address:Port Peer Address:Port Process
    //   LISTEN 0 4096 0.0.0.0:22 0.0.0.0:*
    const parts = line.trim().split(/\s+/);
    // Find the local address field (ends with :22)
    const local = parts.find((p) => p.endsWith(':22'));
    if (local) return { listening: true, addr: local.replace(/:22$/, '') };
  }
  return { listening: false };
}

// Parse `who`:
//   richard  pts/0        2026-07-17 21:20 (192.168.0.201)
function parseWho(raw) {
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const m = line.match(/^(\S+)\s+(\S+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+\((.+)\)$/);
    if (m) {
      out.push({
        user: m[1],
        tty: m[2],
        time: m[3].trim(),
        from: m[4],
      });
    }
  }
  return out;
}

function table(data, { verbose = false } = {}) {
  const head = verbose
    ? ['TYPE', 'FROM', 'TO', 'DETAILS']
    : ['TYPE', 'FROM', 'TO', 'DETAILS'];
  const rows = [];
  if (data.listening?.listening) {
    rows.push(verbose
      ? ['Listening', '-', `${data.listening.addr || '0.0.0.0'}:22`, 'SSH server running']
      : ['Listening', '-', `${data.listening.addr || '0.0.0.0'}:22`, 'SSH server']);
  }
  for (const s of data.sessions || []) {
    rows.push(verbose
      ? ['Session', s.peerAddr, `${s.localAddr}:${s.localPort}`, `peer port ${s.peerPort}`]
      : ['Session', s.peerAddr, `${s.localAddr}:${s.localPort}`, `port ${s.peerPort}`]);
  }
  for (const w of data.users || []) {
    rows.push(verbose
      ? ['User', w.from, w.tty, `${w.user} @ ${w.time}`]
      : ['User', w.from, w.tty, `${w.user} @ ${w.time}`]);
  }
  return { head, rows };
}

async function collect() {
  const ssRes = await run('ss', ['-tnp', 'state', 'established', '( sport = :22 )']);
  const ssListenRes = await run('ss', ['-tlnp', '( sport = :22 )']);
  const whoRes = await run('who', []);

  if (!ssRes.ok && !whoRes.ok) {
    return { available: false, reason: 'ss/who unavailable' };
  }

  const sessions = ssRes.ok ? parseSsEstablished(ssRes.stdout) : [];
  const listening = ssListenRes.ok ? parseSsListening(ssListenRes.stdout) : { listening: false };
  const users = whoRes.ok ? parseWho(whoRes.stdout) : [];

  if (sessions.length === 0 && users.length === 0 && !listening.listening) {
    return { available: false, reason: 'no SSH sessions or users' };
  }

  return {
    available: true,
    data: { sessions, listening, users },
  };
}

module.exports = {
  name: 'ssh',
  title: 'SSH Sessions',
  parseSsEstablished,
  parseSsListening,
  parseWho,
  table,
  collect,
};