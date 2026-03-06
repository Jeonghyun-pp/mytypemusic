import type { PublishAdapter, PublishRequest, PublishResult } from "../types";

const API = "https://api.linkedin.com/v2";

export const linkedinPublishAdapter: PublishAdapter = {
  platform: "linkedin",

  async publishText(accessToken, userId, request) {
    const text =
      request.text +
      (request.hashtags?.length
        ? "\n\n" + request.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
        : "");

    const body = {
      author: `urn:li:person:${userId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };

    const res = await fetch(`${API}/ugcPosts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LinkedIn post error (${res.status}): ${err}`);
    }

    const postId = res.headers.get("x-restli-id") ?? "";
    return {
      platformPostId: postId,
      platformPostUrl: `https://www.linkedin.com/feed/update/${postId}`,
    };
  },

  async publishWithMedia(accessToken, userId, request) {
    if (!request.mediaUrls?.length) {
      return this.publishText(accessToken, userId, request);
    }

    // Step 1: Register upload
    const registerRes = await fetch(`${API}/assets?action=registerUpload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: `urn:li:person:${userId}`,
          serviceRelationships: [
            { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
          ],
        },
      }),
    });
    const registerData = (await registerRes.json()) as {
      value: {
        uploadMechanism: {
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
            uploadUrl: string;
          };
        };
        asset: string;
      };
    };

    const uploadUrl =
      registerData.value.uploadMechanism[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ].uploadUrl;
    const assetUrn = registerData.value.asset;

    // Step 2: Upload image binary
    const imageRes = await fetch(request.mediaUrls[0]!);
    const imageBlob = await imageRes.blob();

    await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": imageBlob.type || "image/png",
      },
      body: imageBlob,
    });

    // Step 3: Create post with media
    const text =
      request.text +
      (request.hashtags?.length
        ? "\n\n" + request.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
        : "");

    const body = {
      author: `urn:li:person:${userId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "IMAGE",
          media: [
            {
              status: "READY",
              media: assetUrn,
            },
          ],
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };

    const res = await fetch(`${API}/ugcPosts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LinkedIn media post error (${res.status}): ${err}`);
    }

    const postId = res.headers.get("x-restli-id") ?? "";
    return {
      platformPostId: postId,
      platformPostUrl: `https://www.linkedin.com/feed/update/${postId}`,
    };
  },
};
