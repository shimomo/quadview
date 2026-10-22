// Decisions of the page that do not touch the DOM (tested with `node --test`).
//
// A candidate is something a tile can show:
//   { key, preset, label, videoId, start, title, auto? }
// `key` is unique across presets; a pasted URL is "url:<video id>". `start` is an ISO
// time (actual or scheduled start) or null for a plain video. `auto: false` keeps it out
// of the tiles filled when the page opens (it can still be chosen with its button).

export const MAX_TILES = 4;
// A stream this long after its start may have ended.
export const STALE_HOURS = 7;

const HOUR = 3600 * 1000;
// watch / youtu.be / live / embed URLs.
const VIDEO_ID =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|embed\/)|youtu\.be\/)([\w-]{11})(?![\w-])/;

const startOf = (c) => new Date(c.start).getTime();

// On air by the clock. A video whose state was looked up says so itself (`state`).
export function isLive(c, now) {
  if (c.state === "live") return true;
  if (c.state === "ended") return false;
  return c.start != null && startOf(c) <= now.getTime();
}

// Possibly over: started long ago, or known to have ended. A video known to be on air
// (a 24/7 live) is not stale however long it has run.
export function isStale(c, now) {
  if (c.state === "live") return false;
  if (c.state === "ended") return true;
  return c.start != null && now.getTime() - startOf(c) >= STALE_HOURS * HOUR;
}

// What the tiles show when the page opens: streams on air, the latest start first (one
// that has just begun before one that is ending), then upcoming ones, the soonest first.
export function defaultSelection(candidates, now) {
  const timed = candidates.filter((c) => c.start != null && c.auto !== false);
  const live = timed
    .filter((c) => isLive(c, now) && !isStale(c, now))
    .sort((a, b) => startOf(b) - startOf(a));
  const upcoming = timed.filter((c) => !isLive(c, now)).sort((a, b) => startOf(a) - startOf(b));
  return [...live, ...upcoming].slice(0, MAX_TILES).map((c) => c.key);
}

// Tiles for `selected`: kept keys stay in their tile, new ones fill the free tiles.
export function assignSlots(previous, selected) {
  const slots = Array.from({ length: MAX_TILES }, (_, i) =>
    selected.includes(previous[i]) ? previous[i] : null,
  );
  for (const key of selected) {
    const free = slots.indexOf(null);
    if (!slots.includes(key) && free >= 0) slots[free] = key;
  }
  return slots;
}

export function toggleSlot(slots, key) {
  const at = slots.indexOf(key);
  if (at >= 0) return slots.map((k, i) => (i === at ? null : k));
  const free = slots.indexOf(null);
  if (free < 0) return slots;
  return slots.map((k, i) => (i === free ? key : k));
}

export function removeKeys(slots, predicate) {
  return slots.map((k) => (k != null && predicate(k) ? null : k));
}

export function slotForPasted(slots) {
  const free = slots.indexOf(null);
  return free >= 0 ? free : null;
}

export function videoIdFromUrl(url) {
  const match = VIDEO_ID.exec(url.trim());
  return match ? match[1] : null;
}

// "?safe" opens the page without loading the saved presets, so that a preset that makes
// the page hang (a regular expression that backtracks badly, say) can still be removed.
export function isSafeMode(search) {
  return new URLSearchParams(search).has("safe");
}

// Browsers autoplay only muted videos; the sound is turned on in the player.
export function embedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1`;
}

// --- presets ----------------------------------------------------------------------------
// A preset is JSON someone wrote: a list of videos, or channels plus rules that sort their
// streams into items. It never holds data fetched from the YouTube API.

// Upload pages (50 each) a channel may ask to be read: 10 pages are 20 units a search.
export const MAX_PAGES = 10;
const VIDEO_ID_FORMAT = /^[\w-]{11}$/;
const CHANNEL_ID_FORMAT = /^UC[\w-]{22}$/;

// Why a preset was refused: `message` is a key of i18n.js ("preset.*") and `params` fill
// its placeholders, so the page can say it in the reader's language.
class PresetError extends Error {
  constructor(key, params = {}) {
    super(key);
    this.params = params;
  }
}

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isStringArray = (v) => Array.isArray(v) && v.every((s) => typeof s === "string");

function regex(source, where) {
  if (typeof source !== "string") throw new PresetError("preset.regexNotString", { where });
  try {
    return new RegExp(source, "iu");
  } catch {
    throw new PresetError("preset.regexInvalid", { where, source });
  }
}

function parseSearch(search, labels) {
  if (!isObject(search)) throw new PresetError("preset.badSearch");
  if (!Array.isArray(search.channels) || search.channels.length === 0) {
    throw new PresetError("preset.noChannels");
  }
  const channels = search.channels.map((ch) => {
    if (!isObject(ch) || !CHANNEL_ID_FORMAT.test(ch.id ?? "")) {
      throw new PresetError("preset.badChannelId", { id: ch?.id });
    }
    if (ch.default != null && !labels.has(ch.default)) {
      throw new PresetError("preset.badDefault", { default: ch.default });
    }
    if (ch.priority != null && !Number.isFinite(ch.priority)) {
      throw new PresetError("preset.badPriority", { id: ch.id });
    }
    const pages = ch.pages ?? 1;
    if (!Number.isInteger(pages) || pages < 1 || pages > MAX_PAGES) {
      throw new PresetError("preset.badPages", { max: MAX_PAGES, id: ch.id });
    }
    return { id: ch.id, default: ch.default ?? null, priority: ch.priority ?? 0, pages };
  });
  const exclude = search.exclude ?? [];
  if (!isStringArray(exclude)) throw new PresetError("preset.badExclude");
  const strip = search.strip ?? [];
  if (!Array.isArray(strip)) throw new PresetError("preset.badStrip");
  const duplicates = search.duplicates ?? "first";
  if (duplicates !== "first" && duplicates !== "all") {
    throw new PresetError("preset.badDuplicates", { duplicates });
  }
  return {
    channels,
    exclude,
    strip: strip.map((s, i) => regex(s, `search.strip[${i}]`)),
    after: search.after == null ? null : regex(search.after, "search.after"),
    duplicates,
  };
}

export function parsePreset(json) {
  try {
    if (!isObject(json)) throw new PresetError("preset.notObject");
    if (typeof json.name !== "string" || !json.name) throw new PresetError("preset.noName");
    if (!Array.isArray(json.items)) throw new PresetError("preset.noItems");
    const kind = json.search == null ? "videos" : "channels";
    const items = json.items.map((item) => {
      if (!isObject(item) || typeof item.label !== "string" || !item.label) {
        throw new PresetError("preset.noLabel");
      }
      if (kind === "videos") {
        if (!VIDEO_ID_FORMAT.test(item.video_id ?? "")) {
          throw new PresetError("preset.badVideoId", { label: item.label });
        }
        return { label: item.label, videoId: item.video_id, title: item.title ?? "" };
      }
      const aliases = item.aliases ?? [item.label];
      if (!isStringArray(aliases)) throw new PresetError("preset.badAliases", { label: item.label });
      if (item.auto != null && typeof item.auto !== "boolean") {
        throw new PresetError("preset.badAuto", { label: item.label });
      }
      return { label: item.label, aliases, auto: item.auto ?? true };
    });
    if (json.timezone != null) {
      try {
        new Intl.DateTimeFormat("en-CA", { timeZone: json.timezone });
      } catch {
        throw new PresetError("preset.badTimezone", { timezone: json.timezone });
      }
    }
    const preset = {
      name: json.name,
      kind,
      timezone: typeof json.timezone === "string" ? json.timezone : null,
      items,
    };
    if (kind === "channels") {
      preset.search = parseSearch(json.search, new Set(items.map((i) => i.label)));
    }
    return { ok: true, preset };
  } catch (e) {
    if (e instanceof PresetError) return { ok: false, error: e.message, params: e.params };
    throw e;
  }
}

export function videoCandidates(preset, presetUrl) {
  return preset.items.map((item) => ({
    key: `${presetUrl}#${item.label}`,
    preset: presetUrl,
    label: item.label,
    videoId: item.videoId,
    start: null,
    title: item.title,
    auto: false, // chosen by hand; a lookup below may tell its state, not fill a tile
  }));
}

// Video candidates with the state of their video, from youtube.js fetchVideos.
// state: "live", "upcoming", "ended", or null (a plain video, or not looked up).
export function withVideoStatus(candidates, streams) {
  const byId = new Map(streams.map((s) => [s.videoId, s]));
  return candidates.map((c) => {
    const s = byId.get(c.videoId);
    if (!s) return { ...c, state: null };
    const state = s.ended ? "ended" : s.live ? "live" : "upcoming";
    return { ...c, state, start: s.start };
  });
}

// --- channel presets: streams to candidates -----------------------------------------------
// A stream is what youtube.js returns:
//   { videoId, channelId, title, start, live, ended, embeddable }

const NUMBERS = "②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";

const withGlobal = (re) => new RegExp(re.source, `${re.flags}g`);

// The item a stream belongs to, or null (see the design: exclude, strip, after, the
// channel's own item, the earliest name, the channel's own item again).
export function matchItem(title, channelId, preset) {
  const { search, items } = preset;
  const channel = search.channels.find((ch) => ch.id === channelId);
  if (!channel) return null;
  if (search.exclude.some((word) => title.includes(word))) return null;
  let text = search.strip.reduce((t, re) => t.replace(withGlobal(re), ""), title);
  const after = search.after?.exec(text);
  if (after) text = text.slice(after.index + after[0].length);
  const own = items.find((item) => item.label === channel.default);
  if (own?.aliases.some((alias) => text.includes(alias))) return own.label;
  let best = null;
  for (const item of items) {
    for (const alias of item.aliases) {
      const at = text.indexOf(alias);
      if (at >= 0 && (best === null || at < best.at)) best = { at, label: item.label };
    }
  }
  return best ? best.label : channel.default;
}

// "YYYY-MM-DD" of `date` in `timeZone` (the browser's when null).
export function dayIn(timeZone, date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone ?? undefined }).format(date);
}

export function channelCandidates(streams, preset, presetUrl, now) {
  const tz = preset.timezone;
  const today = dayIn(tz, now);
  const yesterday = dayIn(tz, new Date(now.getTime() - 24 * HOUR));
  const byLabel = new Map(preset.items.map((item) => [item.label, []]));
  for (const s of streams) {
    if (s.ended || !s.embeddable) continue;
    const day = dayIn(tz, new Date(s.start));
    // A stream on air since last night counts; one on air for days does not.
    if (day !== today && !(s.live && day === yesterday)) continue;
    const label = matchItem(s.title, s.channelId, preset);
    if (label !== null) byLabel.get(label).push(s);
  }
  const channelOf = new Map(preset.search.channels.map((ch) => [ch.id, ch]));
  const autoOf = new Map(preset.items.map((item) => [item.label, item.auto]));
  const owns = (s, label) => channelOf.get(s.channelId).default === label;
  const candidates = [];
  for (const [label, found] of byLabel) {
    found.sort(
      (a, b) =>
        channelOf.get(b.channelId).priority - channelOf.get(a.channelId).priority ||
        owns(b, label) - owns(a, label) ||
        b.live - a.live ||
        new Date(a.start) - new Date(b.start),
    );
    const kept = preset.search.duplicates === "all" ? found : found.slice(0, 1);
    kept.forEach((s, i) => {
      candidates.push({
        key: `${presetUrl}#${label}#${s.videoId}`,
        preset: presetUrl,
        label: i === 0 ? label : `${label} ${NUMBERS[i - 1] ?? i + 1}`,
        videoId: s.videoId,
        start: s.start,
        title: s.title,
        // Only the first stream of an item fills a tile on its own.
        auto: i === 0 && autoOf.get(label),
      });
    });
  }
  return candidates;
}
