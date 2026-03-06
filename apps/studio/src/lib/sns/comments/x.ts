import type { CommentAdapter, FetchedComment, ReplyResult } from "./types";

const API = "https://api.twitter.com/2";

export const xCommentAdapter: CommentAdapter = {
  async fetchCommentsOnPost(accessToken, tweetId) {
    // Search for replies to a specific tweet
    const url = `${API}/tweets/search/recent?query=conversation_id:${tweetId}&tweet.fields=id,text,author_id,created_at&max_results=20`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      data?: Array<{
        id: string;
        text: string;
        author_id: string;
        created_at?: string;
      }>;
    };

    return (data.data ?? []).map(
      (t): FetchedComment => ({
        externalId: t.id,
        parentPostId: tweetId,
        senderName: t.author_id,
        senderHandle: t.author_id,
        body: t.text,
        messageType: "comment",
        receivedAt: t.created_at ? new Date(t.created_at) : new Date(),
      }),
    );
  },

  async replyToComment(accessToken, _userId, parentId, text) {
    return this.postCommentOnPost(accessToken, _userId, parentId, text);
  },

  async postCommentOnPost(accessToken, _userId, tweetId, text) {
    const res = await fetch(`${API}/tweets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        reply: { in_reply_to_tweet_id: tweetId },
      }),
    });
    const data = (await res.json()) as {
      data?: { id: string };
      errors?: Array<{ message: string }>;
    };
    if (data.errors?.length) {
      throw new Error(`X reply error: ${data.errors[0]?.message}`);
    }
    return { replyId: data.data?.id ?? "" };
  },
};
