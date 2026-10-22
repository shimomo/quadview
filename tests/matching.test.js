import assert from "node:assert/strict";
import { test } from "node:test";

import { channelCandidates, dayIn, matchItem, parsePreset } from "../site/logic.js";

const CH = (n) => `UC${String(n).padStart(22, "x")}`;
const WEST = CH(1);
const SOUTH = CH(2);
const SHARED = CH(3); // carries several venues, no default
const URL = "https://example.com/venues.json";

const { preset } = parsePreset({
  name: "会場",
  timezone: "Asia/Tokyo",
  search: {
    channels: [{ id: WEST, default: "西" }, { id: SOUTH, default: "南" }, { id: SHARED }],
    exclude: ["予告"],
    strip: ["[^\\s【】]{1,6}?主催", "東京湾"],
    after: "(?<![A-Za-z])in(?![A-Za-z])",
  },
  items: [
    { label: "西", aliases: ["西会場", "西"] },
    { label: "南", aliases: ["南"] },
    { label: "東", aliases: ["東"] },
  ],
});

test("matchItem", () => {
  // The organizer is stripped: the stream belongs to the venue it is held at.
  assert.equal(matchItem("【東主催】南 1日目", WEST, preset), "南");
  // "X in Y" is held at Y; "SPIN" does not split.
  assert.equal(matchItem("北 in 南 2日目", WEST, preset), "南");
  assert.equal(matchItem("SPIN 中継 南", SHARED, preset), "南");
  // Excluded words drop the stream.
  assert.equal(matchItem("【予告】南 3日目", SOUTH, preset), null);
  // No venue named: the channel's own venue.
  assert.equal(matchItem("ライブ中継 1日目", WEST, preset), "西");
  // The channel's own venue wins over other names in the title.
  assert.equal(matchItem("西会場 解説 東太郎", WEST, preset), "西");
  // Otherwise the earliest name in the title.
  assert.equal(matchItem("東 と 南 の対抗戦", SHARED, preset), "東");
  // Stripped words are not names ("東京湾" is not 東).
  assert.equal(matchItem("東京湾 花火 南", SHARED, preset), "南");
  // A channel without a default and no name in the title.
  assert.equal(matchItem("ライブ中継", SHARED, preset), null);
  // A channel the preset does not know.
  assert.equal(matchItem("南", CH(9), preset), null);
});

test("dayIn uses the preset's time zone", () => {
  assert.equal(dayIn("Asia/Tokyo", new Date("2026-10-21T15:30:00Z")), "2026-10-22");
  assert.equal(dayIn("Asia/Tokyo", new Date("2026-10-21T14:59:00Z")), "2026-10-21");
});

const NOW = new Date("2026-10-22T21:30:00+09:00");

function s(videoId, channelId, title, start, extra = {}) {
  return { videoId, channelId, title, start, live: false, ended: false, embeddable: true, ...extra };
}

test("channelCandidates keeps today's streams", () => {
  const streams = [
    s("vid00000001", WEST, "1日目", "2026-10-19T20:00:00+09:00", { live: true }), // stuck for days
    s("vid00000002", SOUTH, "2日目", "2026-10-21T23:50:00+09:00", { live: true }), // since last night
    s("vid00000003", WEST, "3日目", "2026-10-23T20:00:00+09:00"), // tomorrow
    s("vid00000004", SHARED, "東 中継", "2026-10-22T20:00:00+09:00", { embeddable: false }),
    s("vid00000005", SHARED, "東 中継", "2026-10-22T10:00:00+09:00", { ended: true }),
    s("vid00000006", WEST, "2日目", "2026-10-22T20:00:00+09:00"),
  ];
  const got = channelCandidates(streams, preset, URL, NOW);
  assert.deepEqual(
    got.map((c) => [c.label, c.videoId]),
    [
      ["西", "vid00000006"],
      ["南", "vid00000002"],
    ],
  );
  assert.deepEqual(got[0], {
    key: `${URL}#西#vid00000006`,
    preset: URL,
    label: "西",
    videoId: "vid00000006",
    start: "2026-10-22T20:00:00+09:00",
    title: "2日目",
    auto: true,
  });
});

test("channelCandidates first: the venue's own channel wins", () => {
  const streams = [
    s("vid00000011", SOUTH, "【南主催】西 1日目", "2026-10-22T19:00:00+09:00"),
    s("vid00000012", WEST, "西 1日目", "2026-10-22T20:00:00+09:00"),
  ];
  const got = channelCandidates(streams, preset, URL, NOW);
  assert.deepEqual(got.map((c) => c.videoId), ["vid00000012"]);
});

test("channelCandidates all: every stream, numbered", () => {
  const all = { ...preset, search: { ...preset.search, duplicates: "all" } };
  const streams = [
    s("vid00000021", SHARED, "南 実況", "2026-10-22T20:05:00+09:00"),
    s("vid00000022", SHARED, "南 解説", "2026-10-22T20:00:00+09:00", { live: true }),
  ];
  const got = channelCandidates(streams, all, URL, NOW);
  assert.deepEqual(
    got.map((c) => [c.label, c.videoId]),
    [
      ["南", "vid00000022"],
      ["南 ②", "vid00000021"],
    ],
  );
});

test("channelCandidates with no streams", () => {
  assert.deepEqual(channelCandidates([], preset, URL, NOW), []);
});

test("channel priority ranks a channel's streams first, and later duplicates are not auto-filled", () => {
  const ranked = parsePreset({
    name: "会場",
    timezone: "Asia/Tokyo",
    search: {
      channels: [{ id: SHARED, priority: 1 }, { id: WEST, default: "西" }],
      duplicates: "all",
    },
    items: [{ label: "西", aliases: ["西"] }, { label: "番組", aliases: ["番組"], auto: false }],
  }).preset;
  const streams = [
    s("vid00000031", WEST, "西 裏実況", "2026-10-22T20:00:00+09:00", { live: true }),
    s("vid00000032", SHARED, "西 中継", "2026-10-22T20:05:00+09:00", { live: true }),
    s("vid00000033", SHARED, "番組 生配信", "2026-10-22T19:00:00+09:00", { live: true }),
  ];
  const got = channelCandidates(streams, ranked, URL, NOW);
  assert.deepEqual(
    got.map((c) => [c.label, c.videoId, c.auto]),
    [
      ["西", "vid00000032", true],
      ["西 ②", "vid00000031", false],
      ["番組", "vid00000033", false],
    ],
  );
});

test("parsePreset rejects a priority that is not a number", () => {
  const r = parsePreset({
    name: "x",
    search: { channels: [{ id: WEST, priority: "high" }] },
    items: [{ label: "西" }],
  });
  assert.equal(r.ok, false);
});
