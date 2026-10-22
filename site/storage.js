// What the page remembers in this browser. Storage may be missing or throw (private
// windows, blocked site data): then nothing is remembered and the page still works.
//
//   localStorage   quadview.presets      the preset URLs added in the settings
//                  quadview.apiKey       the person's YouTube API key
//                  quadview.hidden       preset URLs whose buttons are hidden from the bar
//   sessionStorage quadview.cache.<url>  a channel preset's search result, for 15 minutes

export const CACHE_MINUTES = 15;

const PRESETS = "quadview.presets";
const KEY = "quadview.apiKey";
const HIDDEN = "quadview.hidden";
const CACHE = "quadview.cache.";

// Reading globalThis.localStorage can itself throw (blocked site data).
function local() {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function session() {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

function read(backend, name) {
  try {
    return backend?.getItem(name) ?? null;
  } catch {
    return null;
  }
}

function write(backend, name, value) {
  try {
    if (value === null) backend?.removeItem(name);
    else backend?.setItem(name, value);
  } catch {}
}

function readJson(backend, name) {
  const text = read(backend, name);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function loadPresetUrls(backend = local()) {
  const urls = readJson(backend, PRESETS);
  return Array.isArray(urls) ? urls.filter((u) => typeof u === "string") : [];
}

export function savePresetUrls(urls, backend = local()) {
  write(backend, PRESETS, JSON.stringify(urls));
}

export function loadHidden(backend = local()) {
  const urls = readJson(backend, HIDDEN);
  return Array.isArray(urls) ? urls.filter((u) => typeof u === "string") : [];
}

export function saveHidden(urls, backend = local()) {
  write(backend, HIDDEN, JSON.stringify(urls));
}

// The key entered in this visit, so that it works even when it cannot be stored.
let keyInMemory;

export function loadKey(backend = local()) {
  if (keyInMemory !== undefined) return keyInMemory;
  return read(backend, KEY) || null;
}

export function saveKey(key, backend = local()) {
  keyInMemory = key || null;
  write(backend, KEY, keyInMemory);
}

export function loadCache(url, now, backend = session()) {
  const entry = readJson(backend, CACHE + url);
  if (!entry || typeof entry.at !== "number" || !Array.isArray(entry.streams)) return null;
  if (now.getTime() - entry.at < CACHE_MINUTES * 60 * 1000) return entry.streams;
  write(backend, CACHE + url, null); // the result is kept for 15 minutes only
  return null;
}

export function saveCache(url, streams, now, backend = session()) {
  write(backend, CACHE + url, JSON.stringify({ at: now.getTime(), streams }));
}

// When the search result of a preset was made (ms), or null.
export function cacheTime(url, backend = session()) {
  const entry = readJson(backend, CACHE + url);
  return typeof entry?.at === "number" ? entry.at : null;
}

// Forgets every search result, so that the next load asks YouTube again.
export function clearCache(backend = session()) {
  try {
    const names = [];
    for (let i = 0; i < backend.length; i++) {
      const name = backend.key(i);
      if (name?.startsWith(CACHE)) names.push(name);
    }
    for (const name of names) backend.removeItem(name);
  } catch {}
}
