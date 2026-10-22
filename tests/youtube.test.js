import assert from "node:assert/strict";
import { test } from "node:test";

import { fetchStreams, SearchError } from "../site/youtube.js";

const KEY = "test-key-123";
const CH = (n) => `UC${String(n).padStart(22, "x")}`;

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

// A fake Data API: uploads maps channel id -> video ids, videos maps id -> resource.
function fakeApi(uploads, videos, overrides = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    const u = new URL(url);
    assert.equal(u.origin, "https://www.googleapis.com");
    assert.equal(u.searchParams.get("key"), KEY);
    const kind = u.pathname.split("/").pop();
    calls.push(kind);
    if (overrides[kind]) return overrides[kind](u);
    if (kind === "playlistItems") {
      const channel = `UC${u.searchParams.get("playlistId").slice(2)}`;
      if (!(channel in uploads)) return response(404, { error: { code: 404 } });
      const ids = uploads[channel].slice(0, Number(u.searchParams.get("maxResults")));
      return response(200, { items: ids.map((videoId) => ({ contentDetails: { videoId } })) });
    }
    assert.equal(kind, "videos");
    assert.equal(u.searchParams.get("part"), "snippet,liveStreamingDetails,status");
    const ids = u.searchParams.get("id").split(",");
    assert.ok(ids.length <= 50);
    return response(200, { items: ids.filter((id) => id in videos).map((id) => videos[id]) });
  };
  return { calls, fetchImpl };
}

function video(id, channelId, details, embeddable = true) {
  return {
    id,
    snippet: { channelId, title: `title ${id}` },
    liveStreamingDetails: details,
    status: { embeddable },
  };
}

const ids = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(10, "0")}`);

test("fetchStreams calls playlistItems per channel and videos per 50", async () => {
  const uploads = { [CH(1)]: ids(30, "a"), [CH(2)]: ids(30, "b") };
  const { calls, fetchImpl } = fakeApi(uploads, {});
  await fetchStreams(KEY, [CH(1), CH(2)], fetchImpl);
  assert.equal(calls.filter((k) => k === "playlistItems").length, 2);
  assert.equal(calls.filter((k) => k === "videos").length, 2);
});

test("fetchStreams skips a missing channel", async () => {
  const { fetchImpl } = fakeApi({ [CH(1)]: ["a0000000001"] }, {
    a0000000001: video("a0000000001", CH(1), { scheduledStartTime: "2026-10-22T11:00:00Z" }),
  });
  const got = await fetchStreams(KEY, [CH(9), CH(1)], fetchImpl);
  assert.deepEqual(got.map((s) => s.videoId), ["a0000000001"]);
});

test("fetchStreams maps live, upcoming, ended, embeddable", async () => {
  const videos = {
    a0000000001: video("a0000000001", CH(1), { scheduledStartTime: "2026-10-22T11:00:00Z" }),
    a0000000002: video("a0000000002", CH(1), {
      scheduledStartTime: "2026-10-22T10:00:00Z",
      actualStartTime: "2026-10-22T10:01:00Z",
    }),
    a0000000003: video(
      "a0000000003",
      CH(1),
      { actualStartTime: "2026-10-22T08:00:00Z", actualEndTime: "2026-10-22T09:00:00Z" },
      false,
    ),
    a0000000004: { id: "a0000000004", snippet: { channelId: CH(1), title: "plain video" } },
  };
  const { fetchImpl } = fakeApi({ [CH(1)]: Object.keys(videos) }, videos);
  const got = await fetchStreams(KEY, [CH(1)], fetchImpl);
  assert.deepEqual(got, [
    {
      videoId: "a0000000001",
      channelId: CH(1),
      title: "title a0000000001",
      start: "2026-10-22T11:00:00Z",
      live: false,
      ended: false,
      embeddable: true,
    },
    {
      videoId: "a0000000002",
      channelId: CH(1),
      title: "title a0000000002",
      start: "2026-10-22T10:01:00Z",
      live: true,
      ended: false,
      embeddable: true,
    },
    {
      videoId: "a0000000003",
      channelId: CH(1),
      title: "title a0000000003",
      start: "2026-10-22T08:00:00Z",
      live: true,
      ended: true,
      embeddable: false,
    },
  ]);
});

async function kindOf(fetchImpl) {
  try {
    await fetchStreams(KEY, [CH(1)], fetchImpl);
  } catch (e) {
    assert.ok(e instanceof SearchError);
    assert.ok(!e.message.includes(KEY));
    return e.kind;
  }
  return "no error";
}

test("search errors are typed", async () => {
  const quota = () =>
    response(403, { error: { code: 403, errors: [{ reason: "quotaExceeded" }] } });
  assert.equal(await kindOf(fakeApi({}, {}, { playlistItems: quota }).fetchImpl), "quota");
  const badKey = () => response(400, { error: { code: 400, errors: [{ reason: "keyInvalid" }] } });
  assert.equal(await kindOf(fakeApi({}, {}, { playlistItems: badKey }).fetchImpl), "key");
  const referer = () =>
    response(403, { error: { code: 403, errors: [{ reason: "forbidden" }] } });
  assert.equal(await kindOf(fakeApi({}, {}, { playlistItems: referer }).fetchImpl), "key");
  const down = async () => {
    throw new TypeError(`Failed to fetch https://www.googleapis.com/?key=${KEY}`);
  };
  assert.equal(await kindOf(down), "network");
  const broken = () => response(500, {});
  assert.equal(await kindOf(fakeApi({}, {}, { playlistItems: broken }).fetchImpl), "http");
});

test("fetchVideos asks videos only, 50 at a time", async () => {
  const many = Object.fromEntries(
    ids(60, "c").map((id) => [id, video(id, CH(1), { actualStartTime: "2026-08-19T00:00:00Z" })]),
  );
  const { calls, fetchImpl } = fakeApi({}, many);
  const { fetchVideos } = await import("../site/youtube.js");
  const got = await fetchVideos(KEY, Object.keys(many), fetchImpl);
  assert.deepEqual(calls, ["videos", "videos"]);
  assert.equal(got.length, 60);
  assert.equal(got[0].live, true);
});

test("fetchVideos leaves plain videos out", async () => {
  const videos = {
    c0000000001: { id: "c0000000001", snippet: { channelId: CH(1), title: "plain" } },
    c0000000002: video("c0000000002", CH(1), {
      actualStartTime: "2026-08-19T00:00:00Z",
      actualEndTime: "2026-10-20T00:00:00Z",
    }),
  };
  const { fetchImpl } = fakeApi({}, videos);
  const { fetchVideos } = await import("../site/youtube.js");
  const got = await fetchVideos(KEY, Object.keys(videos), fetchImpl);
  assert.deepEqual(got.map((s) => [s.videoId, s.ended]), [["c0000000002", true]]);
});
