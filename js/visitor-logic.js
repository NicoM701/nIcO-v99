export const TOTAL_KEY = 'nv99:total_visitors';
export const SEEN_KEY = 'nv99:seen_visitors';
export const LIVE_SET_KEY = 'nv99:live_visitors';
export const LIVE_TTL = 30;
export const SEEN_TTL_SECONDS = 60 * 60 * 48;

export function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function seenKeyForDay(day = utcDay(), prefix = SEEN_KEY) {
  return `${prefix}:${day}`;
}

export function previousUtcDay(date = new Date()) {
  return utcDay(new Date(date.getTime() - 24 * 60 * 60 * 1000));
}

export function isRedisFlagSet(value) {
  return value === 1 || value === true;
}

export function shouldIncrementTotal(added, wasLegacy) {
  return isRedisFlagSet(added) && !isRedisFlagSet(wasLegacy);
}

export function parseScanResult(result) {
  if (Array.isArray(result)) {
    return { cursor: String(result[0] ?? '0'), keys: Array.isArray(result[1]) ? result[1] : [] };
  }
  return {
    cursor: String(result?.cursor ?? '0'),
    keys: Array.isArray(result?.keys) ? result.keys : [],
  };
}

export function seenKeyMatchPattern(prefix = SEEN_KEY) {
  return `${prefix}*`;
}
