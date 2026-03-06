import type { CommentAdapter, FetchedComment, ReplyResult } from "./types";

const API = "https://graph.facebook.com/v21.0";

interface IgComment {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
}

export const instagramCommentAdapter: CommentAdapter = {
  async fetchCommentsOnPost(accessToken, mediaId) {
    const url = `${API}/${mediaId}/comments?fields=id,text,timestamp,username&access_token=${accessToken}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = (await res.json()) as { data?: IgComment[] };
    const comments = data.data ?? [];

    return comments.map(
      (c): FetchedComment => ({
        externalId: c.id,
        parentPostId: mediaId,
        senderName: c.username ?? "",
        senderHandle: c.username ?? "",
        body: c.text ?? "",
        messageType: "comment",
        receivedAt: c.timestamp ? new Date(c.timestamp) : new Date(),
      }),
    );
  },

  async replyToComment(accessToken, _userId, commentId, text) {
    const res = await fetch(`${API}/${commentId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        message: text,
        access_token: accessToken,
      }),
    });
    const data = (await res.json()) as {
      id?: string;
      error?: { message: string };
    };
    if (data.error) {
      throw new Error(`Instagram reply error: ${data.error.message}`);
    }

    return { replyId: data.id ?? "" };
  },

  async postCommentOnPost(accessToken, _userId, mediaId, text) {
    const res = await fetch(`${API}/${mediaId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        message: text,
        access_token: accessToken,
      }),
    });
    const data = (await res.json()) as {
      id?: string;
      error?: { message: string };
    };
    if (data.error) {
      throw new Error(`Instagram comment error: ${data.error.message}`);
    }
    return { replyId: data.id ?? "" };
  },
};
