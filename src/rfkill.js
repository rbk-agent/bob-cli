// Shared rfkill JSON parser used by the wifi and bluetooth collectors.
function parseRfkillBlocked(rfkillRaw, type) {
  try {
    const rf = JSON.parse(rfkillRaw || '{}');
    const list = rf.rfkilldevices || rf[''] || [];
    const dev = list.find((d) => d.type === type);
    if (!dev) return null;
    return dev.soft !== 'unblocked' || dev.hard !== 'unblocked';
  } catch {
    return null;
  }
}

module.exports = { parseRfkillBlocked };
