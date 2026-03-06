import type { PublishAdapter, PublishRequest, PublishResult } from "../types";

const UPLOAD_API = "https://www.googleapis.com/upload/youtube/v3/videos";

export const youtubePublishAdapter: PublishAdapter = {
  platform: "youtube",

  async publishText(_accessToken, _userId, _request) {
    throw new Error("YouTube requires video content. Use publishWithMedia instead.");
  },

  async publishWithMedia(accessToken, _userId, request) {
    if (!request.mediaUrls?.length) {
      throw new Error("YouTube requires at least one video URL");
    }

    const title = (request.metadata?.title as string) || request.text.slice(0, 100);
    const description =
      request.text +
      (request.hashtags?.length
        ? "\n\n" + request.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
        : "");
    const tags = request.hashtags?.map((h) => h.replace(/^#/, "")) ?? [];
    const privacy = (request.metadata?.privacy as string) || "public";

    // Download the video file
    const videoRes = await fetch(request.mediaUrls[0]!);
    if (!videoRes.ok) throw new Error("Failed to download video for YouTube upload");
    const videoBlob = await videoRes.blob();

    // YouTube resumable upload: init
    const initRes = await fetch(
      `${UPLOAD_API}?uploadType=resumable&part=snippet,status`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": String(videoBlob.size),
          "X-Upload-Content-Type": videoBlob.type || "video/mp4",
        },
        body: JSON.stringify({
          snippet: { title, description, tags },
          status: { privacyStatus: privacy },
        }),
      },
    );

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`YouTube upload init error (${initRes.status}): ${err}`);
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) throw new Error("YouTube did not return upload URL");

    // Upload video binary
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": videoBlob.type || "video/mp4",
        "Content-Length": String(videoBlob.size),
      },
      body: videoBlob,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`YouTube upload error (${uploadRes.status}): ${err}`);
    }

    const data = (await uploadRes.json()) as {
      id: string;
      snippet: { title: string };
    };

    return {
      platformPostId: data.id,
      platformPostUrl: `https://www.youtube.com/watch?v=${data.id}`,
    };
  },
};
