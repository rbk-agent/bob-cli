function formatBytes(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-';
  let bytes = Number(n);
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  const val = i === 0 ? String(bytes) : bytes.toFixed(1);
  return `${val} ${units[i]}`;
}

function renderTable({ head, rows }) {
  const widths = head.map((h, i) =>
    Math.max(String(h).length, ...rows.map((r) => String(r[i] ?? '').length))
  );
  const line = (cells) =>
    '│ ' + cells.map((c, i) => String(c ?? '').padEnd(widths[i])).join(' │ ') + ' │';
  const sep = (l, m, r) => l + widths.map((w) => '─'.repeat(w + 2)).join(m) + r;
  const out = [sep('┌', '┬', '┐'), line(head), sep('├', '┼', '┤')];
  for (const r of rows) out.push(line(r));
  out.push(sep('└', '┴', '┘'));
  return out.join('\n');
}

function printJSON(data) {
  console.log(JSON.stringify(data, null, 2));
}

function jsonError(message, extra = {}) {
  return { error: message, ...extra };
}

module.exports = { formatBytes, renderTable, printJSON, jsonError };
