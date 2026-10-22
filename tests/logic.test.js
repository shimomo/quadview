import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assignSlots,
  defaultSelection,
  embedUrl,
  isLive,
  isStale,
  removeKeys,
  slotForPasted,
  toggleSlot,
  videoIdFromUrl,
} from "../site/logic.js";

const NOW = new Date("2026-10-21T21:30:00+09:00");

function c(key, start) {
  return { key, preset: "p", label: key, videoId: "vid00000000", start, title: "" };
}

test("defaultSelection: newest live first, stale and startless left out", () => {
  const candidates = [
    c("a", "2026-10-21T15:00:00+09:00"), // 6.5 hours ago
    c("b", "2026-10-21T21:00:00+09:00"),
    c("c", "2026-10-21T21:10:00+09:00"),
    c("d", "2026-10-21T21:20:00+09:00"),
    c("e", "2026-10-21T09:30:00+09:00"), // 12 hours ago: may have ended
    c("f", null),
  ];
  assert.deepEqual(defaultSelection(candidates, NOW), ["d", "c", "b", "a"]);
});

test("defaultSelection: fills with upcoming, soonest first", () => {
  const candidates = [
    c("a", "2026-10-21T22:00:00+09:00"),
    c("b", "2026-10-21T21:45:00+09:00"),
    c("c", "2026-10-21T21:20:00+09:00"),
  ];
  assert.deepEqual(defaultSelection(candidates, NOW), ["c", "b", "a"]);
});

test("defaultSelection: nothing to pick", () => {
  assert.deepEqual(defaultSelection([], NOW), []);
  assert.deepEqual(defaultSelection([c("a", null)], NOW), []);
});

test("isLive and isStale", () => {
  assert.equal(isLive(c("a", "2026-10-21T21:30:00+09:00"), NOW), true);
  assert.equal(isLive(c("a", "2026-10-21T21:31:00+09:00"), NOW), false);
  assert.equal(isLive(c("a", null), NOW), false);
  assert.equal(isStale(c("a", "2026-10-21T14:30:00+09:00"), NOW), true); // exactly 7 hours
  assert.equal(isStale(c("a", "2026-10-21T14:31:00+09:00"), NOW), false);
  assert.equal(isStale(c("a", null), NOW), false);
});

test("assignSlots keeps kept keys in place", () => {
  assert.deepEqual(assignSlots(["a", "b", "c", null], ["c", "a", "d"]), ["a", "d", "c", null]);
});

test("toggleSlot: add, remove, fifth is ignored", () => {
  assert.deepEqual(toggleSlot(["a", null, null, null], "b"), ["a", "b", null, null]);
  assert.deepEqual(toggleSlot(["a", "b", null, null], "a"), [null, "b", null, null]);
  const full = ["a", "b", "c", "d"];
  assert.deepEqual(toggleSlot(full, "e"), full);
});

test("removeKeys empties only the matching tiles", () => {
  assert.deepEqual(
    removeKeys(["p1#x", "p2#y", null, "url:z"], (k) => k.startsWith("p1#")),
    [null, "p2#y", null, "url:z"],
  );
});

test("videoIdFromUrl", () => {
  assert.equal(videoIdFromUrl("https://www.youtube.com/watch?v=abcdefghijk&t=1"), "abcdefghijk");
  assert.equal(videoIdFromUrl("https://youtu.be/abcdefghijk"), "abcdefghijk");
  assert.equal(videoIdFromUrl("https://www.youtube.com/live/abcdefghijk?si=x"), "abcdefghijk");
  assert.equal(videoIdFromUrl(" https://m.youtube.com/embed/abcdefghijk "), "abcdefghijk");
  assert.equal(videoIdFromUrl("https://example.com/watch?v=abcdefghijk"), null);
  assert.equal(videoIdFromUrl("https://youtu.be/abcdefghijkl"), null);
  assert.equal(videoIdFromUrl("abc"), null);
});

test("slotForPasted", () => {
  assert.equal(slotForPasted(["a", null, "c", null]), 1);
  assert.equal(slotForPasted(["a", "b", "c", "d"]), null);
});

test("embedUrl starts muted", () => {
  assert.equal(
    embedUrl("abcdefghijk"),
    "https://www.youtube.com/embed/abcdefghijk?autoplay=1&mute=1&playsinline=1",
  );
});

test("safe mode skips the saved presets", async () => {
  const { isSafeMode } = await import("../site/logic.js");
  assert.equal(isSafeMode("?safe"), true);
  assert.equal(isSafeMode("?a=1&safe=1"), true);
  assert.equal(isSafeMode(""), false);
  assert.equal(isSafeMode("?unsafe"), false);
});

test("defaultSelection leaves out candidates marked auto: false", () => {
  const candidates = [
    { ...c("a", "2026-10-21T21:20:00+09:00"), auto: false },
    c("b", "2026-10-21T21:00:00+09:00"),
  ];
  assert.deepEqual(defaultSelection(candidates, NOW), ["b"]);
});
