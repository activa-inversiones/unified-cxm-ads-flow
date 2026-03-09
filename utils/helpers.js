export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function includesText(value, options = []) {
  const text = String(value || '').toLowerCase();
  return options.some((option) => text.includes(String(option).toLowerCase()));
}

export function safeString(value, fallback = '') {
  return value == null ? fallback : String(value);
}

export function compactObject(obj = {}) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  );
}
