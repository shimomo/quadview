import {
  assignSlots,
  channelCandidates,
  defaultSelection,
  embedUrl,
  isLive,
  isSafeMode,
  isStale,
  MAX_TILES,
  parsePreset,
  removeKeys,
  slotForPasted,
  toggleSlot,
  videoCandidates,
  videoIdFromUrl,
  withVideoStatus,
} from "./logic.js";
import {
  loadCache,
  loadKey,
  loadPresetUrls,
  saveCache,
  saveKey,
  savePresetUrls,
} from "./storage.js";
import { fetchStreams, fetchVideos, SearchError } from "./youtube.js";

const PASTED = "url:";
const STATUS_TEXT = {
  loading: "読み込み中",
  error: "読み込めません",
  nokey: "API キーが必要",
  key: "API キーを確かめてください",
  quota: "今日の検索の上限に達しました",
  network: "通信エラー",
  http: "検索に失敗しました",
  safe: "読み込んでいません（?safe）",
};

const tiles = [...document.querySelectorAll(".tile")];
const groupsNav = document.getElementById("groups");
// What each tile shows now ("key|video id"), so that unchanged tiles are left alone.
const shown = Array(MAX_TILES).fill(null);
let slots = Array(MAX_TILES).fill(null);
// Preset URL -> { url, status, error, name, timezone, candidates, group }. Kept in the
// order the presets were added.
const entries = new Map();
// Candidate key -> candidate, kept while its preset is loaded so that a tile showing it
// stays put even if a later search no longer lists it.
const known = new Map();

const formatters = new Map();
function timeIn(timeZone, iso) {
  const tz = timeZone ?? "";
  if (!formatters.has(tz)) {
    formatters.set(
      tz,
      new Intl.DateTimeFormat("ja-JP", {
        timeZone: timeZone ?? undefined,
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }
  return formatters.get(tz).format(new Date(iso));
}

// --- tiles -------------------------------------------------------------------------------

function contentOf(key) {
  if (!key) return null;
  if (key.startsWith(PASTED)) return { videoId: key.slice(PASTED.length), label: "URL" };
  const c = known.get(key);
  return c ? { videoId: c.videoId, label: c.label } : null;
}

// Only tiles whose content changed are touched: the others keep playing.
function renderTiles() {
  slots.forEach((key, i) => {
    const content = contentOf(key);
    const id = content && `${key}|${content.videoId}`;
    if (shown[i] === id) return;
    shown[i] = id;
    const tile = tiles[i];
    tile.replaceChildren();
    if (!content) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "上のボタンを押すと入る";
      tile.append(empty);
      return;
    }
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = content.label;
    if (key.startsWith(PASTED)) {
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "✕";
      close.title = "この枠を空ける";
      close.addEventListener("click", () => update(slots.map((k, j) => (j === i ? null : k))));
      label.append(close);
    }
    const frame = document.createElement("iframe");
    frame.src = embedUrl(content.videoId);
    frame.title = content.label;
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    tile.append(label, frame);
  });
}

// --- the bar -----------------------------------------------------------------------------

function makeGroup(entry) {
  const group = document.createElement("span");
  group.className = "group";
  const heading = document.createElement("span");
  heading.className = "heading";
  group.append(heading);
  groupsNav.append(group);
  entry.group = group;
}

// The buttons of a preset are made when it loads, in its order; later only their state
// changes (renderButtons).
function fillGroup(entry) {
  const group = entry.group;
  const heading = group.firstElementChild;
  heading.textContent = entry.name ?? entry.url;
  if (entry.status !== "ok") {
    const mark = document.createElement("span");
    mark.className = "mark";
    mark.textContent = STATUS_TEXT[entry.status] ?? entry.status;
    if (entry.error) mark.title = entry.error;
    heading.append(mark);
  }
  group.replaceChildren(heading);
  for (const c of entry.candidates) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.key = c.key;
    button.title = c.title || c.label;
    const name = document.createElement("span");
    name.textContent = c.label;
    button.append(name, document.createElement("span"));
    button.addEventListener("click", () => update(toggleSlot(slots, c.key)));
    group.append(button);
  }
  renderButtons();
}

function renderButtons() {
  const now = new Date();
  const full = !slots.includes(null);
  groupsNav.classList.toggle("full", full);
  for (const entry of entries.values()) {
    for (const button of entry.group.querySelectorAll("button")) {
      const c = known.get(button.dataset.key);
      if (!c) continue;
      const on = slots.includes(c.key);
      button.setAttribute("aria-pressed", String(on));
      button.setAttribute("aria-disabled", String(!on && full));
      button.classList.toggle("stale", isStale(c, now));
      const when = button.lastElementChild;
      if (c.state === "ended") {
        when.className = "when";
        when.textContent = "終了";
      } else if (c.start == null) {
        when.className = "";
        when.textContent = "";
      } else if (isLive(c, now)) {
        when.className = "live";
        when.textContent = "LIVE";
      } else {
        when.className = "when";
        when.textContent = `${timeIn(entry.timezone, c.start)}〜`;
      }
    }
  }
}

function renderNotice() {
  const notice = document.getElementById("notice");
  notice.textContent = entries.size
    ? ""
    : "設定からプリセットを足すと候補が出ます。URL を貼って見ることもできます";
}

function update(next) {
  slots = next;
  renderTiles();
  renderButtons();
}

// --- presets -----------------------------------------------------------------------------

async function search(entry, preset, key) {
  const now = new Date();
  let streams = loadCache(entry.url, now);
  if (!streams) {
    if (!key) {
      entry.status = "nokey";
      return [];
    }
    try {
      streams = await fetchStreams(key, preset.search.channels);
    } catch (e) {
      if (!(e instanceof SearchError)) throw e;
      entry.status = e.kind;
      entry.error = e.message;
      return [];
    }
    saveCache(entry.url, streams, now);
  }
  return channelCandidates(streams, preset, entry.url, now);
}

// Any failure stays inside this preset: its heading says so and the others go on.
// With a key, the state of a video preset's videos (live, upcoming, ended); without one,
// or if the lookup fails, the buttons simply carry no state.
async function videoStatus(entry, candidates, key) {
  const now = new Date();
  let streams = loadCache(entry.url, now);
  if (!streams) {
    if (!key) return candidates;
    try {
      streams = await fetchVideos(key, candidates.map((c) => c.videoId));
    } catch (e) {
      if (!(e instanceof SearchError)) throw e;
      return candidates;
    }
    saveCache(entry.url, streams, now);
  }
  return withVideoStatus(candidates, streams);
}

async function load(entry) {
  entry.status = "loading";
  entry.error = null;
  try {
    const response = await fetch(entry.url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parsePreset(await response.json());
    if (!parsed.ok) throw new Error(parsed.error);
    const preset = parsed.preset;
    entry.name = preset.name;
    entry.kind = preset.kind;
    entry.timezone = preset.timezone;
    entry.status = "ok";
    entry.candidates =
      preset.kind === "videos"
        ? await videoStatus(entry, videoCandidates(preset, entry.url), loadKey())
        : await search(entry, preset, loadKey());
  } catch (e) {
    console.warn("preset failed:", entry.url, e);
    entry.status = "error";
    entry.error = String(e?.message ?? e);
    entry.candidates = [];
  }
  for (const c of entry.candidates) known.set(c.key, c);
  fillGroup(entry);
  renderSettings();
}

function addEntry(url) {
  const entry = { url, status: "loading", error: null, name: null, timezone: null, candidates: [] };
  entries.set(url, entry);
  makeGroup(entry);
  fillGroup(entry);
  renderNotice();
  return entry;
}

function removeEntry(url) {
  const entry = entries.get(url);
  if (!entry) return;
  entry.group.remove();
  entries.delete(url);
  const prefix = `${url}#`;
  for (const key of [...known.keys()]) if (key.startsWith(prefix)) known.delete(key);
  savePresetUrls([...entries.keys()]);
  update(removeKeys(slots, (key) => key.startsWith(prefix)));
  renderNotice();
  renderSettings();
}

// --- settings ----------------------------------------------------------------------------

function renderSettings() {
  const list = document.getElementById("preset-list");
  list.replaceChildren();
  for (const entry of entries.values()) {
    const li = document.createElement("li");
    const name = document.createElement("b");
    name.textContent = entry.name ?? "（名前なし）";
    const url = document.createElement("span");
    url.className = "url";
    url.textContent = entry.url;
    url.title = entry.url;
    const status = document.createElement("span");
    status.textContent = entry.status === "ok" ? "" : (STATUS_TEXT[entry.status] ?? entry.status);
    status.className = "help";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "外す";
    remove.addEventListener("click", () => removeEntry(entry.url));
    li.append(name, url, status, remove);
    list.append(li);
  }
  document.getElementById("key-status").textContent = loadKey()
    ? "API キーを保存しています。"
    : "API キーは保存されていません。";
}

function setUpSettings() {
  const dialog = document.getElementById("settings");
  const urlInput = document.getElementById("preset-url");
  const error = document.getElementById("preset-error");
  document.getElementById("settings-open").addEventListener("click", () => {
    renderSettings();
    error.hidden = true;
    dialog.showModal();
  });
  document.getElementById("settings-close").addEventListener("click", () => dialog.close());
  document.getElementById("preset-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const url = urlInput.value.trim();
    let valid = false;
    try {
      valid = ["http:", "https:"].includes(new URL(url).protocol);
    } catch {}
    error.hidden = valid && !entries.has(url);
    if (!valid) error.textContent = "http(s) の URL を入れてください。";
    else if (entries.has(url)) error.textContent = "そのプリセットはもう読み込んでいます。";
    if (!error.hidden) return;
    urlInput.value = "";
    const entry = addEntry(url);
    savePresetUrls([...entries.keys()]);
    renderSettings();
    load(entry); // tiles are not filled automatically after the page has opened
  });
  const keyInput = document.getElementById("key-input");
  // A new key searches the channel presets again (tiles are not filled automatically).
  const researchChannels = () => {
    for (const entry of entries.values()) {
      const failed = ["nokey", "key", "quota", "network", "http"].includes(entry.status);
      if (failed || entry.kind === "videos") load(entry);
    }
  };
  document.getElementById("key-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!keyInput.value.trim()) return;
    saveKey(keyInput.value.trim());
    keyInput.value = "";
    renderSettings();
    researchChannels();
  });
  document.getElementById("key-clear").addEventListener("click", () => {
    saveKey(null);
    renderSettings();
  });
}

function setUpPaste() {
  const dialog = document.getElementById("paste");
  const input = document.getElementById("paste-url");
  const error = document.getElementById("paste-error");
  const choose = document.getElementById("paste-choose");
  let pending = null;

  const put = (i) => {
    update(slots.map((k, j) => (j === i ? PASTED + pending : k)));
    dialog.close();
  };
  document.getElementById("paste-open").addEventListener("click", () => {
    input.value = "";
    error.hidden = true;
    choose.hidden = true;
    dialog.showModal();
  });
  document.getElementById("paste-cancel").addEventListener("click", () => dialog.close());
  // "入れる" is the form's submit button, so Enter in the field also puts the video in.
  document.getElementById("paste-form").addEventListener("submit", (event) => {
    event.preventDefault();
    pending = videoIdFromUrl(input.value);
    error.hidden = pending !== null;
    choose.hidden = true;
    if (pending === null) return;
    const free = slotForPasted(slots);
    if (free === null) choose.hidden = false;
    else put(free);
  });
  input.addEventListener("input", () => {
    choose.hidden = true;
  });
  for (const button of choose.querySelectorAll("button")) {
    button.addEventListener("click", () => put(Number(button.dataset.slot)));
  }
}

async function main() {
  setUpPaste();
  setUpSettings();
  renderNotice();
  renderTiles();
  const urls = loadPresetUrls();
  if (isSafeMode(location.search)) {
    // Listed in the settings so that they can be removed, but not loaded.
    for (const url of urls) {
      const entry = addEntry(url);
      entry.status = "safe";
      fillGroup(entry);
    }
    return;
  }
  await Promise.allSettled(urls.map((url) => load(addEntry(url))));
  const all = [...entries.values()].flatMap((entry) => entry.candidates);
  // Fill only the free tiles: something pasted while the presets loaded stays.
  const kept = slots.filter((key) => key !== null);
  update(assignSlots(slots, [...kept, ...defaultSelection(all, new Date())]));
  setInterval(renderButtons, 60 * 1000); // LIVE and stale marks follow the clock
}

main();
