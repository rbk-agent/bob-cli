const { run } = require('../run');

const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

function parse(raw) {
  const json = JSON.parse(raw);
  const map = {};
  const walk = (entries) => {
    for (const e of entries) {
      if (e.field) map[e.field.replace(/:$/, '')] = e.data;
      if (Array.isArray(e.children)) walk(e.children);
    }
  };
  walk(json.lscpu || []);
  return {
    model: map['Model name'] ?? null,
    architecture: map['Architecture'] ?? null,
    cpus: num(map['CPU(s)']),
    threadsPerCore: num(map['Thread(s) per core']),
    coresPerSocket: num(map['Core(s) per socket']),
    sockets: num(map['Socket(s)']),
    vendor: map['Vendor ID'] ?? null,
    maxMHz: num(map['CPU max MHz']),
    minMHz: num(map['CPU min MHz']),
  };
}

function table(data, { verbose = false } = {}) {
  const fields = verbose
    ? [
        ['Model', data.model], ['Architecture', data.architecture], ['CPU(s)', data.cpus],
        ['Threads/core', data.threadsPerCore], ['Cores/socket', data.coresPerSocket],
        ['Sockets', data.sockets], ['Vendor', data.vendor],
        ['Max MHz', data.maxMHz], ['Min MHz', data.minMHz],
      ]
    : [
        ['Model', data.model], ['Architecture', data.architecture],
        ['CPU(s)', data.cpus], ['Sockets', data.sockets],
      ];
  return { head: ['FIELD', 'VALUE'], rows: fields.map(([k, v]) => [k, v ?? '-']) };
}

async function collect() {
  const res = await run('lscpu', ['-J']);
  if (!res.ok) return { available: false, reason: 'lscpu unavailable (install util-linux)' };
  try {
    return { available: true, data: parse(res.stdout) };
  } catch (e) {
    return { available: false, reason: `failed to parse lscpu output: ${e.message}` };
  }
}

module.exports = { name: 'cpu', title: 'CPU', parse, table, collect };
