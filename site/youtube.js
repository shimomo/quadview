// Finds live and upcoming streams of channels with the YouTube Data API, using the key of
// the person using the page. Only playlistItems and videos are called (1 unit each);
// YouTube pages are never read. The key goes to www.googleapis.com and nowhere else.

const API = "https://www.googleapis.com/youtube/v3";
const PAGE = 50;
const QUOTA_REASONS = new Set(["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"]);

export class SearchError extends Error {
  // kind: "key" (missing, invalid or restricted), "quota", "network" or "http".
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

async function get(fetchImpl, kind, params, key) {
  const url = `${API}/${kind}?${new URLSearchParams({ ...params, key })}`;
  let response;
  try {
    response = await fetchImpl(url);
  } catch {
    // The browser's message may carry the URL, and so the key: do not pass it on.
    throw new SearchError("network", `${kind}: network error`);
  }
  if (response.ok) return response.json();
  if (response.status === 404) return null;
  let reason = "";
  try {
    reason = (await response.json())?.error?.errors?.[0]?.reason ?? "";
  } catch {}
  if (QUOTA_REASONS.has(reason)) throw new SearchError("quota", `${kind}: ${reason}`);
  if (response.status === 400 || response.status === 403) {
    throw new SearchError("key", `${kind}: HTTP ${response.status} ${reason}`.trim());
  }
  throw new SearchError("http", `${kind}: HTTP ${response.status}`);
}

function toStream(item) {
  const details = item.liveStreamingDetails;
  if (!details) return null;
  const started = details.actualStartTime;
  const start = started ?? details.scheduledStartTime;
  if (!start) return null;
  return {
    videoId: item.id,
    channelId: item.snippet?.channelId ?? "",
    title: item.snippet?.title ?? "",
    start,
    live: Boolean(started),
    ended: Boolean(details.actualEndTime),
    embeddable: item.status?.embeddable !== false,
  };
}

// Live, upcoming and recently ended streams among each channel's latest uploads: 50 per
// page, `pages` pages for a channel that books its streams far ahead (uploads are ordered
// by creation). A channel is an id or { id, pages }. A channel that is not found is
// skipped; any other error stops the search.
export async function fetchStreams(key, channels, fetchImpl = fetch) {
  const videoIds = [];
  for (const channel of channels) {
    const { id, pages = 1 } = typeof channel === "string" ? { id: channel } : channel;
    let pageToken;
    for (let page = 0; page < pages; page++) {
      const params = { part: "contentDetails", maxResults: String(PAGE), playlistId: `UU${id.slice(2)}` };
      if (pageToken) params.pageToken = pageToken;
      const body = await get(fetchImpl, "playlistItems", params, key);
      for (const item of body?.items ?? []) videoIds.push(item.contentDetails.videoId);
      pageToken = body?.nextPageToken;
      if (!pageToken) break;
    }
  }
  return fetchVideos(key, videoIds, fetchImpl);
}

// The live / upcoming state of known videos (plain videos are left out). One unit per 50.
export async function fetchVideos(key, videoIds, fetchImpl = fetch) {
  const streams = [];
  for (let i = 0; i < videoIds.length; i += PAGE) {
    const body = await get(
      fetchImpl,
      "videos",
      { part: "snippet,liveStreamingDetails,status", id: videoIds.slice(i, i + PAGE).join(",") },
      key,
    );
    for (const item of body?.items ?? []) {
      const stream = toStream(item);
      if (stream) streams.push(stream);
    }
  }
  return streams;
}
