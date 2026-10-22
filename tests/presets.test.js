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
  });
  assert.equal(a[1].title, "");
  assert.notEqual(a[0].key, b[0].key);
});

test("parsePreset rejects an unknown timezone", () => {
  assert.equal(parsePreset({ ...CHANNEL_PRESET, timezone: "Mars/Olympus" }).ok, false);
});
