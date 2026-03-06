import type { PublishAdapter, PublishRequest, PublishResult } from "../types";

const API = "https://open.tiktokapis.com/v2";

export const tiktokPublishAdapter: PublishAdapter = {
  platform: "tiktok",

  async publishText(_accessToken, _userId, _request) {
    throw new Error("TikTok requires video content. Use publishWithMedia instead.");
  },

  async publishWithMedia(accessToken, _userId, request) {
    if (!request.mediaUrls?.length) {
      throw new Error("TikTok requires at least one video URL");
    }

    const title =
      request.text.slice(0, 150) +
      (request.hashtags?.length
        ? " " + request.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
        : "");

    // Step 1: Init direct post
    const initRes = await fetch(`${API}/post/publish/video/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title,
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: request.mediaUrls[0],
        },
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`TikTok publish init error (${initRes.status}): ${err}`);
    }

    const initData = (await initRes.json()) as {
      data: { publish_id: string };
      error?: { code: string; message: string };
    };

    if (initData.error) {
      throw new Error(`TikTok error: ${initData.error.message}`);
    }

    const publishId = initData.data.publish_id;

    // TikTok processes the video asynchronously.
    // The publish_id can be used to check status later.
    return {
      platformPostId: publishId,
      platformPostUrl: `https://www.tiktok.com`, // exact URL available after processing
    };
  },
};
