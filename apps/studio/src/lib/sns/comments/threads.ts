import type { CommentAdapter, FetchedComment, ReplyResult } from "./types";

const API = "https://graph.threads.net/v1.0";

interface ThreadsReply {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
}

export const threadsCommentAdapter: CommentAdapter = {
  async fetchCommentsOnPost(accessToken, postId) {
    const url = `${API}/${postId}/replies?fields=id,text,username,timestamp&reverse=true&access_token=${accessToken}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = (await res.json()) as { data?: ThreadsReply[] };
    const replies = data.data ?? [];

    return replies.map(
      (r): FetchedComment => ({
        externalId: r.id,
        parentPostId: postId,
        senderName: r.username ?? "",
        senderHandle: r.username ?? "",
        body: r.text ?? "",
        messageType: "comment",
        receivedAt: r.timestamp ? new Date(r.timestamp) : new Date(),
      }),
    );
  },

  async replyToComment(accessToken, userId, parentId, text) {
    // Step 1: Create reply container
    const createRes = await fetch(`${API}/${userId}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        media_type: "TEXT",
        text,
        reply_to_id: parentId,
        access_token: accessToken,
      }),
    });
    const createData = (await createRes.json()) as {
      id?: string;
      error?: { message: string };
    };
    if (createData.error) {
      throw new Error(`Threads reply container error: ${createData.error.message}`);
    }
    const containerId = createData.id ?? "";

    // Step 2: Publish reply
    const publishRes = await fetch(`${API}/${userId}/threads_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: accessToken,
      }),
    });
    const publishData = (await publishRes.json()) as {
      id?: string;
      error?: { message: string };
    };
    if (publishData.error) {
      throw new Error(`Threads reply publish error: ${publishData.error.message}`);
    }

    return { replyId: publishData.id ?? containerId };
  },

  async postCommentOnPost(accessToken, userId, postId, text) {
    // Threads uses the same reply_to_id mechanism for top-level comments
    return this.replyToComment(accessToken, userId, postId, text);
  },
};
