import type { PublishAdapter, PublishRequest, PublishResult } from "../types";

const API = "https://graph.facebook.com/v21.0";

export const instagramPublishAdapter: PublishAdapter = {
  platform: "instagram",

  async publishText(accessToken, userId, request) {
    // Instagram doesn't support text-only posts — must have media.
    // Create a "text card" by using a solid color image or fallback.
    throw new Error(
      "Instagram requires media for posts. Use publishWithMedia instead.",
    );
  },

  async publishWithMedia(accessToken, userId, request) {
    const caption =
      request.text +
      (request.hashtags?.length
        ? "\n\n" + request.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
        : "");

    if (!request.mediaUrls?.length) {
      throw new Error("Instagram requires at least one media URL");
    }

    if (request.mediaUrls.length === 1) {
      // Single image post
      const containerRes = await fetch(`${API}/${userId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          image_url: request.mediaUrls?.[0] ?? "",
          caption,
          access_token: accessToken,
        }),
      });
      const container = (await containerRes.json()) as { id: string; error?: { message: string } };
      if (container.error) throw new Error(`IG container error: ${container.error.message}`);

      const publishRes = await fetch(`${API}/${userId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          creation_id: container.id,
          access_token: accessToken,
        }),
      });
      const published = (await publishRes.json()) as { id: string; error?: { message: string } };
      if (published.error) throw new Error(`IG publish error: ${published.error.message}`);

      return {
        platformPostId: published.id,
        platformPostUrl: `https://www.instagram.com/p/${published.id}`,
      };
    }

    // Carousel (multiple images) — validate each child before proceeding
    const childIds: string[] = [];
    const failedUrls: string[] = [];
    for (const mediaUrl of request.mediaUrls.slice(0, 10)) {
      try {
        const childRes = await fetch(`${API}/${userId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            image_url: mediaUrl,
            is_carousel_item: "true",
            access_token: accessToken,
          }),
        });
        const child = (await childRes.json()) as { id?: string; error?: { message: string } };
        if (child.error || !child.id) {
          failedUrls.push(mediaUrl);
          continue;
        }
        childIds.push(child.id);
      } catch {
        failedUrls.push(mediaUrl);
      }
    }

    if (childIds.length === 0) {
      throw new Error(
        `IG carousel failed: all ${request.mediaUrls.length} images failed to upload. First URL: ${request.mediaUrls[0]}`,
      );
    }
    if (childIds.length < 2) {
      // Instagram requires at least 2 items for carousel — fall back to single image
      const containerRes = await fetch(`${API}/${userId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          image_url: request.mediaUrls.find((u) => !failedUrls.includes(u)) ?? request.mediaUrls[0] ?? "",
          caption,
          access_token: accessToken,
        }),
      });
      const container = (await containerRes.json()) as { id: string; error?: { message: string } };
      if (container.error) throw new Error(`IG container error: ${container.error.message}`);

      const publishRes = await fetch(`${API}/${userId}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          creation_id: container.id,
          access_token: accessToken,
        }),
      });
      const published = (await publishRes.json()) as { id: string; error?: { message: string } };
      if (published.error) throw new Error(`IG publish error: ${published.error.message}`);

      return {
        platformPostId: published.id,
        platformPostUrl: `https://www.instagram.com/p/${published.id}`,
      };
    }

    const carouselRes = await fetch(`${API}/${userId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption,
        access_token: accessToken,
      }),
    });
    const carousel = (await carouselRes.json()) as { id: string; error?: { message: string } };
    if (carousel.error) throw new Error(`IG carousel error: ${carousel.error.message}`);

    const publishRes = await fetch(`${API}/${userId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        creation_id: carousel.id,
        access_token: accessToken,
      }),
    });
    const published = (await publishRes.json()) as { id: string; error?: { message: string } };
    if (published.error) throw new Error(`IG publish error: ${published.error.message}`);

    return {
      platformPostId: published.id,
      platformPostUrl: `https://www.instagram.com/p/${published.id}`,
    };
  },
};
