import type { PublishAdapter, PublishRequest, PublishResult } from "../types";

export const wordpressPublishAdapter: PublishAdapter = {
  platform: "wordpress",

  async publishText(accessToken, _userId, request) {
    // Use WordPress.com REST API
    // The blogId is stored in account metadata; we pass it via request.metadata
    const blogId = (request.metadata?.blogId as string) || "me";
    const title = (request.metadata?.title as string) || request.text.slice(0, 60);

    const res = await fetch(
      `https://public-api.wordpress.com/rest/v1.1/sites/${blogId}/posts/new`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content: request.text,
          status: "publish",
          tags: request.hashtags?.join(",") ?? "",
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`WordPress post error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      ID: number;
      URL: string;
    };

    return {
      platformPostId: String(data.ID),
      platformPostUrl: data.URL,
    };
  },

  async publishWithMedia(accessToken, userId, request) {
    if (!request.mediaUrls?.length) {
      return this.publishText(accessToken, userId, request);
    }

    const blogId = (request.metadata?.blogId as string) || "me";

    // Step 1: Upload media
    const imageRes = await fetch(request.mediaUrls[0]!);
    const imageBlob = await imageRes.blob();
    const formData = new FormData();
    formData.append("media[]", imageBlob, "image.png");

    const uploadRes = await fetch(
      `https://public-api.wordpress.com/rest/v1.1/sites/${blogId}/media/new`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      },
    );
    const uploadData = (await uploadRes.json()) as {
      media?: Array<{ ID: number; URL: string }>;
    };
    const mediaId = uploadData.media?.[0]?.ID;

    // Step 2: Create post with featured image
    const title = (request.metadata?.title as string) || request.text.slice(0, 60);
    const res = await fetch(
      `https://public-api.wordpress.com/rest/v1.1/sites/${blogId}/posts/new`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content: request.text,
          status: "publish",
          tags: request.hashtags?.join(",") ?? "",
          featured_image: mediaId,
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`WordPress media post error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { ID: number; URL: string };
    return {
      platformPostId: String(data.ID),
      platformPostUrl: data.URL,
    };
  },
};
