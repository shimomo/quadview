import assert from "node:assert/strict";
import { test } from "node:test";

import {
  loadCache,
  loadKey,
  loadPresetUrls,
  saveCache,
  saveKey,
  savePresetUrls,
} from "../site/storage.js";

function memory() {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

const throwing = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

const NOW = new Date("2026-10-22T21:00:00+09:00");
const later = (minutes) => new Date(NOW.getTime() + minutes * 60 * 1000);
const STREAMS = [{ videoId: "aaaaaaaaaaa", channelId: "UC", title: "t", start: "s", live: true }];

test("preset urls round trip", () => {
  const m = memory();
  assert.deepEqual(loadPresetUrls(m), []);
  savePresetUrls(["https://a.example/1.json", "https://b.example/2.json"], m);
  assert.deepEqual(loadPresetUrls(m), ["https://a.example/1.json", "https://b.example/2.json"]);
  assert.ok(m.data.has("quadview.presets"));
});

test("key round trip and removal", () => {
  const m = memory();
  assert.equal(loadKey(m), null);
  saveKey("abc", m);
  assert.equal(loadKey(m), "abc");
  assert.ok(m.data.has("quadview.apiKey"));
  saveKey(null, m);
  assert.equal(loadKey(m), null);
});

test("cache lasts 15 minutes", () => {
  const m = memory();
  saveCache("https://a.example/1.json", STREAMS, NOW, m);
  assert.ok(m.data.has("quadview.cache.https://a.example/1.json"));
  assert.deepEqual(loadCache("https://a.example/1.json", later(14), m), STREAMS);
  assert.equal(loadCache("https://a.example/1.json", later(15), m), null);
  assert.equal(loadCache("https://b.example/2.json", NOW, m), null);
});

test("storage tolerates throwing backends", () => {
  assert.deepEqual(loadPresetUrls(throwing), []);
  assert.equal(loadKey(throwing), null);
  assert.equal(loadCache("https://a.example/1.json", NOW, throwing), null);
  savePresetUrls(["x"], throwing);
  saveKey("abc", throwing);
  saveKey(null, throwing);
  saveCache("https://a.example/1.json", STREAMS, NOW, throwing);
});

test("broken JSON is treated as empty", () => {
  const m = memory();
  m.setItem("quadview.presets", "{not json");
  m.setItem("quadview.cache.u", "[1,");
  assert.deepEqual(loadPresetUrls(m), []);
  assert.equal(loadCache("u", NOW, m), null);
  m.setItem("quadview.presets", '{"a":1}');
  assert.deepEqual(loadPresetUrls(m), []);
});

test("a missing backend (no window) is tolerated", () => {
  assert.deepEqual(loadPresetUrls(undefined), []);
});

test("a saved key is usable in this visit even when storage throws", () => {
  saveKey("abc", throwing);
  assert.equal(loadKey(throwing), "abc");
  saveKey(null, throwing);
  assert.equal(loadKey(throwing), null);
});

test("an expired cache entry is removed when read", () => {
  const m = memory();
  saveCache("https://a.example/1.json", STREAMS, NOW, m);
  assert.equal(loadCache("https://a.example/1.json", later(15), m), null);
  assert.equal(m.data.has("quadview.cache.https://a.example/1.json"), false);
});

test("hidden presets round trip", async () => {
  const { loadHidden, saveHidden } = await import("../site/storage.js");
  const m = memory();
  assert.deepEqual(loadHidden(m), []);
  saveHidden(["https://a.example/1.json"], m);
  assert.deepEqual(loadHidden(m), ["https://a.example/1.json"]);
  assert.ok(m.data.has("quadview.hidden"));
  assert.deepEqual(loadHidden(throwing), []);
  saveHidden(["x"], throwing);
});

// A storage that can list its keys, like sessionStorage.
function listing() {
  const m = memory();
  Object.defineProperty(m, "length", { get: () => m.data.size });
  m.key = (i) => [...m.data.keys()][i] ?? null;
  return m;
}

test("clearCache removes every search result and nothing else", async () => {
  const { clearCache } = await import("../site/storage.js");
  const m = listing();
  saveCache("https://a.example/1.json", STREAMS, NOW, m);
  saveCache("https://b.example/2.json", STREAMS, NOW, m);
  m.setItem("other", "keep");
  clearCache(m);
  assert.deepEqual([...m.data.keys()], ["other"]);
  clearCache(throwing);
  clearCache(undefined);
});

test("cacheTime tells when a search result was made", async () => {
  const { cacheTime } = await import("../site/storage.js");
  const m = memory();
  assert.equal(cacheTime("https://a.example/1.json", m), null);
  saveCache("https://a.example/1.json", STREAMS, NOW, m);
  assert.equal(cacheTime("https://a.example/1.json", m), NOW.getTime());
  assert.equal(cacheTime("https://a.example/1.json", throwing), null);
});
