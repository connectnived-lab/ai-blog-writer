// Settings for live mode. Stored only in the browser (localStorage). Pure functions; no DOM.
export const STORAGE_KEY = 'ai-mini-settings';
export const DEFAULTS = Object.freeze({ baseUrl: '', apiKey: '', model: '', live: false });

export function normalizeConfig(p = {}) {
  return {
    baseUrl: String(p?.baseUrl ?? '').trim(),
    apiKey: String(p?.apiKey ?? '').trim(),
    model: String(p?.model ?? '').trim(),
    live: p?.live === true,
  };
}

export function loadConfig(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(storage, cfg) {
  const clean = normalizeConfig(cfg);
  storage.setItem(STORAGE_KEY, JSON.stringify(clean));
  return clean;
}

export function clearConfig(storage) {
  storage.removeItem(STORAGE_KEY);
  return { ...DEFAULTS };
}

export function validateConfig(cfg) {
  const c = normalizeConfig(cfg);
  const problems = [];
  if (c.baseUrl && !/^https?:\/\/[^\s/]+/i.test(c.baseUrl)) problems.push('The base URL must start with https:// (or http://).');
  if (!c.baseUrl) problems.push('Add the API base URL, for example https://api.example.com/v1.');
  if (!c.apiKey) problems.push('Add your API key.');
  if (!c.model) problems.push('Add the model name.');
  return problems;
}

export function isLiveReady(cfg) {
  const c = normalizeConfig(cfg);
  return c.live && validateConfig(c).length === 0;
}

export function modeOf(cfg) {
  return isLiveReady(cfg) ? 'live' : 'demo';
}
