import type { PublishAdapter, PublishRequest, PublishResult } from "../types";

const API = "https://graph.threads.net/v1.0";

async function createContainer(
  accessToken: string,
  userId: string,
  opts: { text: string; mediaType?: string; imageUrl?: string },
): Promise<string> {
  const body: Record<string, string> = {
    media_type: opts.mediaType ?? "TEXT",
    text: opts.text,
    access_token: accessToken,
  };
  if (opts.imageUrl) body.image_url = opts.imageUrl;

  const res = await fetch(`${API}/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const data = (await res.json()) as { id: string; error?: { message: string } };
  if (data.error) throw new Error(`Threads container error: ${data.error.message}`);
  return data.id;
}

async function publishContainer(
  accessToken: string,
  userId: string,
  containerId: string,
): Promise<PublishResult> {
  const res = await fetch(`${API}/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: containerId,
      access_token: accessToken,
    }),
  });
  const data = (await res.json()) as { id: string; error?: { message: string } };
  if (data.error) throw new Error(`Threads publish error: ${data.error.message}`);
  return {
    platformPostId: data.id,
    platformPostUrl: `https://www.threads.net/post/${data.id}`,
  };
}

export const threadsPublishAdapter: PublishAdapter = {
  platform: "threads",

  async publishText(accessToken, userId, request) {
    const text =
      request.text +
      (request.hashtags?.length ? "\n\n" + request.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ") : "");
    const containerId = await createContainer(accessToken, userId, { text });
    return publishContainer(accessToken, userId, containerId);
  },

  async publishWithMedia(accessToken, userId, request) {
    const text =
      request.text +
      (request.hashtags?.length ? "\n\n" + request.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ") : "");

    if (!request.mediaUrls?.length) {
      return this.publishText(accessToken, userId, request);
    }

    // Single image post
    const containerId = await createContainer(accessToken, userId, {
      text,
      mediaType: "IMAGE",
      imageUrl: request.mediaUrls[0],
    });
    return publishContainer(accessToken, userId, containerId);
  },
};
