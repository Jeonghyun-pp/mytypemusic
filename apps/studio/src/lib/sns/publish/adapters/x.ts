import type { PublishAdapter } from "../types";

const API_V2 = "https://api.twitter.com/2";
const UPLOAD_API = "https://upload.twitter.com/1.1/media/upload.json";

/** Upload a single image to X via v1.1 chunked upload and return its media_id_string. */
async function uploadMedia(accessToken: string, mediaUrl: string): Promise<string> {
  // Fetch the image binary
  const imgRes = await fetch(mediaUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch media: ${mediaUrl}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
  const totalBytes = buf.byteLength;

  const headers = { Authorization: `Bearer ${accessToken}` };

  // INIT
  const initBody = new URLSearchParams({
    command: "INIT",
    total_bytes: String(totalBytes),
    media_type: contentType,
  });
  const initRes = await fetch(UPLOAD_API, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
    body: initBody.toString(),
  });
  if (!initRes.ok) throw new Error(`X media INIT failed: ${initRes.status}`);
  const initData = (await initRes.json()) as { media_id_string: string };
  const mediaId = initData.media_id_string;

  // APPEND — upload in 5MB chunks
  const chunkSize = 5 * 1024 * 1024;
  for (let seg = 0, offset = 0; offset < totalBytes; seg++, offset += chunkSize) {
    const chunk = buf.subarray(offset, Math.min(offset + chunkSize, totalBytes));
    const form = new FormData();
    form.append("command", "APPEND");
    form.append("media_id", mediaId);
    form.append("segment_index", String(seg));
    form.append("media_data", chunk.toString("base64"));

    const appendRes = await fetch(UPLOAD_API, {
      method: "POST",
      headers,
      body: form,
    });
    if (!appendRes.ok) throw new Error(`X media APPEND seg ${seg} failed: ${appendRes.status}`);
  }

  // FINALIZE
  const finBody = new URLSearchParams({ command: "FINALIZE", media_id: mediaId });
  const finRes = await fetch(UPLOAD_API, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
    body: finBody.toString(),
  });
  if (!finRes.ok) throw new Error(`X media FINALIZE failed: ${finRes.status}`);

  const finData = (await finRes.json()) as {
    media_id_string: string;
    processing_info?: { state: string; check_after_secs?: number };
  };

  // Poll STATUS if async processing (max 30 attempts ≈ ~60s)
  const MAX_STATUS_POLLS = 30;
  let proc = finData.processing_info;
  let pollCount = 0;
  while (proc && proc.state !== "succeeded") {
    if (proc.state === "failed") throw new Error("X media processing failed");
    if (++pollCount > MAX_STATUS_POLLS) {
      throw new Error(`X media processing timed out after ${MAX_STATUS_POLLS} status checks`);
    }
    const wait = (proc.check_after_secs ?? 2) * 1000;
    await new Promise((r) => setTimeout(r, wait));

    const statusParams = new URLSearchParams({ command: "STATUS", media_id: mediaId });
    const statusRes = await fetch(`${UPLOAD_API}?${statusParams.toString()}`, { headers });
    if (!statusRes.ok) throw new Error(`X media STATUS failed: ${statusRes.status}`);
    const statusData = (await statusRes.json()) as {
      processing_info?: { state: string; check_after_secs?: number };
    };
    proc = statusData.processing_info;
  }

  return mediaId;
}

function buildTweetText(request: { text: string; hashtags?: string[] }): string {
  return (
    request.text +
    (request.hashtags?.length
      ? "\n\n" + request.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
      : "")
  ).slice(0, 280);
}

export const xPublishAdapter: PublishAdapter = {
  platform: "x",

  async publishText(accessToken, _userId, request) {
    const res = await fetch(`${API_V2}/tweets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: buildTweetText(request) }),
    });

    const data = (await res.json()) as {
      data?: { id: string; text: string };
      errors?: Array<{ message: string }>;
    };
    if (data.errors?.length) {
      throw new Error(`X post error: ${data.errors[0]?.message}`);
    }

    const tweetId = data.data?.id ?? "";
    return {
      platformPostId: tweetId,
      platformPostUrl: `https://x.com/i/status/${tweetId}`,
    };
  },

  async publishWithMedia(accessToken, _userId, request) {
    const mediaUrls = request.mediaUrls ?? [];
    if (!mediaUrls.length) {
      return this.publishText(accessToken, _userId, request);
    }

    // Upload up to 4 images (X limit)
    const mediaIds: string[] = [];
    for (const url of mediaUrls.slice(0, 4)) {
      const id = await uploadMedia(accessToken, url);
      mediaIds.push(id);
    }

    // Post tweet with media
    const res = await fetch(`${API_V2}/tweets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: buildTweetText(request),
        media: { media_ids: mediaIds },
      }),
    });

    const data = (await res.json()) as {
      data?: { id: string; text: string };
      errors?: Array<{ message: string }>;
    };
    if (data.errors?.length) {
      throw new Error(`X post error: ${data.errors[0]?.message}`);
    }

    const tweetId = data.data?.id ?? "";
    return {
      platformPostId: tweetId,
      platformPostUrl: `https://x.com/i/status/${tweetId}`,
    };
  },
};
