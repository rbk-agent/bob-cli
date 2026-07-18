const { run, hasCommand } = require('../run');

// Parse `wpctl status` — PipeWire/WirePlumber
// Returns { sinks, sources, defaultSink, defaultSource, serverName }
function parseWpctl(raw) {
  const lines = raw.split('\n');
  const result = { serverName: null, sinks: [], sources: [], defaultSink: null, defaultSource: null };

  // First line: PipeWire 'pipewire-0' [1.0.5, ...]
  const serverMatch = lines[0]?.match(/^PipeWire\s+'([^']+)'/);
  if (serverMatch) result.serverName = serverMatch[1];

  let section = null; // 'sinks' | 'sources'
  for (const line of lines) {
    // Strip tree-drawing characters (│ ├ └ ─ etc.) then trim whitespace
    const stripped = line.replace(/^[│├└─\s]+/, '').trim();

    if (stripped === 'Sinks:') section = 'sinks';
    else if (stripped === 'Sources:') section = 'sources';
    else if (/^(Audio|Video|Settings)$/.test(stripped)) section = null;
    else if (section && stripped.startsWith('*')) {
      // Default device:  *   54. UMC404HD 192k Analog Surround 4.0   [vol: 1.00]
      const m = stripped.match(/^\*\s+(\d+)\.\s+(.+?)\s+\[vol:\s+([\d.]+)\]/);
      if (m) {
        const dev = { id: Number(m[1]), name: m[2].trim(), volume: Number(m[3]), default: true };
        if (section === 'sinks') { result.sinks.push(dev); result.defaultSink = dev; }
        else { result.sources.push(dev); result.defaultSource = dev; }
      }
    } else if (section && /^\d+\./.test(stripped)) {
      // Non-default:  38. Built-in Audio Analog Stereo        [vol: 0.40]
      const m = stripped.match(/^(\d+)\.\s+(.+?)\s+\[vol:\s+([\d.]+)\]/);
      if (m) {
        const dev = { id: Number(m[1]), name: m[2].trim(), volume: Number(m[3]), default: false };
        if (section === 'sinks') result.sinks.push(dev);
        else result.sources.push(dev);
      }
    }
  }
  return result;
}

// Parse `amixer -c <card> sget Master` — ALSA fallback
//   Simple mixer control 'Master',0
//     Capabilities: pvolume pvolume-joined pswitch pswitch-joined
//     Playback channels: Mono
//     Limits: Playback 0 - 87
//     Mono: Playback 56 [64%] [-23.25dB] [on]
function parseAmixer(raw) {
  const lines = raw.split('\n');
  const controlMatch = lines[0]?.match(/Simple mixer control '([^']+)',(\d+)/);
  const result = { control: controlMatch ? controlMatch[1] : null, volume: null, percent: null, muted: null };

  for (const line of lines) {
    const pctMatch = line.match(/Playback\s+(\d+)\s+\[(\d+)%\]/);
    if (pctMatch) {
      result.volume = Number(pctMatch[1]);
      result.percent = Number(pctMatch[2]);
    }
    if (line.includes('[on]')) result.muted = false;
    if (line.includes('[off]')) result.muted = true;
  }
  return result;
}

// Parse `aplay -l` for sound cards
function parseCards(raw) {
  const out = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^card\s+(\d+):\s+(\S+)\s+\[([^\]]+)\],\s+device\s+(\d+):\s+(.+?)\s+\[([^\]]+)\]/);
    if (m) {
      out.push({
        card: Number(m[1]),
        cardId: m[2],
        cardName: m[3],
        device: Number(m[4]),
        deviceId: m[5].trim(),
        deviceName: m[6],
      });
    }
  }
  return out;
}

function pct(vol) {
  if (vol === null || vol === undefined) return '-';
  return `${Math.round(vol * 100)}%`;
}

function table(data, { verbose = false } = {}) {
  const head = verbose
    ? ['TYPE', 'NAME', 'VOLUME', 'ID', 'DEFAULT']
    : ['TYPE', 'NAME', 'VOLUME'];
  const rows = [];
  const all = [
    ...data.sinks.map((s) => ({ ...s, type: 'Sink (out)' })),
    ...data.sources.map((s) => ({ ...s, type: 'Source (in)' })),
  ];
  for (const d of all) {
    rows.push(verbose
      ? [d.type, d.name, pct(d.volume), String(d.id), d.default ? '*' : '-']
      : [d.type, d.name, d.default ? `* ${pct(d.volume)}` : pct(d.volume)]);
  }
  if (all.length === 0 && data.cards) {
    for (const c of data.cards) {
      rows.push(verbose
        ? ['Card', `${c.cardName} (${c.deviceName})`, '-', `card ${c.card}`, '-']
        : ['Card', `${c.cardName}`, '-']);
    }
  }
  return { head, rows };
}

async function collect() {
  const hasWpctl = await hasCommand('wpctl');
  if (hasWpctl) {
    const res = await run('wpctl', ['status']);
    if (res.ok) {
      try {
        const data = parseWpctl(res.stdout);
        if (data.sinks.length > 0 || data.sources.length > 0) {
          return { available: true, data };
        }
      } catch {}
    }
  }

  // Fallback: ALSA (amixer + aplay)
  const hasAmixer = await hasCommand('amixer');
  const hasAplay = await hasCommand('aplay');
  if (!hasAmixer && !hasAplay) {
    return { available: false, reason: 'wpctl and amixer/aplay unavailable (install pipewire or alsa-utils)' };
  }

  let cards = [];
  if (hasAplay) {
    const aplayRes = await run('aplay', ['-l']);
    if (aplayRes.ok) cards = parseCards(aplayRes.stdout);
  }

  // Try to get volume from first card's Master
  let masterVol = null;
  if (hasAmixer && cards.length > 0) {
    const amixerRes = await run('amixer', ['-c', String(cards[0].card), 'sget', 'Master']);
    if (amixerRes.ok) masterVol = parseAmixer(amixerRes.stdout);
  }

  if (cards.length === 0 && !masterVol) {
    return { available: false, reason: 'no audio devices found' };
  }

  return {
    available: true,
    data: {
      serverName: 'ALSA',
      sinks: masterVol ? [{ id: cards[0]?.card ?? 0, name: masterVol.control ?? 'Master', volume: (masterVol.percent ?? 0) / 100, default: true }] : [],
      sources: [],
      cards,
    },
  };
}

module.exports = {
  name: 'audio',
  title: 'Audio',
  parseWpctl,
  parseAmixer,
  parseCards,
  table,
  collect,
};