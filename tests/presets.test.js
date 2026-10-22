import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePreset, videoCandidates } from "../site/logic.js";

const CH = (n) => `UC${String(n).padStart(22, "x")}`;

const VIDEO_PRESET = {
  name: "動画",
  items: [
    { label: "一", video_id: "aaaaaaaaaaa", title: "一の動画" },
    { label: "二", video_id: "bbbbbbbbbbb" },
  ],
};

const CHANNEL_PRESET = {
  name: "会場",
  timezone: "Asia/Tokyo",
  search: {
    channels: [{ id: CH(1), default: "西" }, { id: CH(2) }],
    exclude: ["予告"],
    strip: ["[^\\s【】]{1,6}?主催"],
    after: "(?<![A-Za-z])in(?![A-Za-z])",
  },
  items: [
    { label: "西", aliases: ["西会場", "西"] },
    { label: "南", aliases: ["南"] },
  ],
};

test("parsePreset accepts a video preset", () => {
  const r = parsePreset(VIDEO_PRESET);
  assert.equal(r.ok, true);
  assert.equal(r.preset.kind, "videos");
  assert.equal(r.preset.name, "動画");
  assert.equal(r.preset.items.length, 2);
});

test("parsePreset accepts a channel preset", () => {
  const r = parsePreset(CHANNEL_PRESET);
  assert.equal(r.ok, true);
  assert.equal(r.preset.kind, "channels");
  assert.equal(r.preset.timezone, "Asia/Tokyo");
  assert.ok(r.preset.search.strip[0] instanceof RegExp);
  assert.equal(r.preset.search.strip[0].flags, "iu");
  assert.ok(r.preset.search.after instanceof RegExp);
  assert.equal(r.preset.search.duplicates, "first");
  assert.deepEqual(r.preset.search.exclude, ["予告"]);
  assert.deepEqual(r.preset.search.channels[1], { id: CH(2), default: null, priority: 0 });
});

function rejects(name, json) {
  test(`parsePreset rejects ${name}`, () => {
    const r = parsePreset(json);
    assert.equal(r.ok, false);
    assert.equal(typeof r.error, "string");
  });
}

rejects("a non-object", null);
rejects("a missing name", { items: [] });
rejects("items that are not an array", { name: "x", items: {} });
rejects("an item without a label", { name: "x", items: [{ video_id: "aaaaaaaaaaa" }] });
rejects("a bad video id", { name: "x", items: [{ label: "a", video_id: "aaaaaaaaaaaa" }] });
rejects("a bad channel id", {
  ...CHANNEL_PRESET,
  search: { ...CHANNEL_PRESET.search, channels: [{ id: "UCshort" }] },
});
rejects("a regex that does not compile", {
  ...CHANNEL_PRESET,
  search: { ...CHANNEL_PRESET.search, strip: ["("] },
});
rejects("a default that is not a label", {
  ...CHANNEL_PRESET,
  search: { ...CHANNEL_PRESET.search, channels: [{ id: CH(1), default: "東" }] },
});
rejects("an unknown duplicates", {
  ...CHANNEL_PRESET,
  search: { ...CHANNEL_PRESET.search, duplicates: "some" },
});
rejects("aliases that are not strings", {
  ...CHANNEL_PRESET,
  items: [{ label: "西", aliases: [1] }],
});

test("videoCandidates keys are unique per preset", () => {
  const { preset } = parsePreset(VIDEO_PRESET);
  const a = videoCandidates(preset, "https://a.example/p.json");
  const b = videoCandidates(preset, "https://b.example/p.json");
  assert.deepEqual(a[0], {
    key: "https://a.example/p.json#一",
    preset: "https://a.example/p.json",
    label: "一",
    videoId: "aaaaaaaaaaa",
    start: null,
    title: "一の動画",
    auto: false,
  });
  assert.equal(a[1].title, "");
  assert.notEqual(a[0].key, b[0].key);
});

test("parsePreset rejects an unknown timezone", () => {
  assert.equal(parsePreset({ ...CHANNEL_PRESET, timezone: "Mars/Olympus" }).ok, false);
});

test("video candidates are never auto-filled", () => {
  const { preset } = parsePreset(VIDEO_PRESET);
  assert.ok(videoCandidates(preset, "u").every((c) => c.auto === false));
});

test("withVideoStatus marks live, upcoming and ended videos", async () => {
  const { withVideoStatus, isLive, isStale } = await import("../site/logic.js");
  const { preset } = parsePreset({
    name: "動画",
    items: [
      { label: "一", video_id: "aaaaaaaaaaa" },
      { label: "二", video_id: "bbbbbbbbbbb" },
      { label: "三", video_id: "ccccccccccc" },
      { label: "四", video_id: "ddddddddddd" },
    ],
  });
  const stream = (videoId, start, live, ended) => ({
    videoId, channelId: "UC", title: "t", start, live, ended, embeddable: true,
  });
  const got = withVideoStatus(videoCandidates(preset, "u"), [
    stream("aaaaaaaaaaa", "2026-08-19T00:00:00Z", true, false), // 24/7 live for months
    stream("bbbbbbbbbbb", "2026-10-23T11:00:00Z", false, false),
    stream("ccccccccccc", "2026-08-01T00:00:00Z", true, true),
  ]);
  assert.deepEqual(
    got.map((c) => [c.label, c.state, c.start]),
    [
      ["一", "live", "2026-08-19T00:00:00Z"],
      ["二", "upcoming", "2026-10-23T11:00:00Z"],
      ["三", "ended", "2026-08-01T00:00:00Z"],
      ["四", null, null],
    ],
  );
  const now = new Date("2026-10-22T21:00:00+09:00");
  assert.equal(isLive(got[0], now), true);
  assert.equal(isStale(got[0], now), false); // known to be on air, however long
  assert.equal(isLive(got[2], now), false);
  assert.equal(isStale(got[2], now), true);
});
