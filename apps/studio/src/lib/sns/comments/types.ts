export interface FetchedComment {
  externalId: string;
  parentPostId: string;
  senderName: string;
  senderHandle: string;
  body: string;
  messageType: "comment" | "dm" | "mention";
  receivedAt: Date;
}

export interface ReplyResult {
  replyId: string;
}

export interface CommentAdapter {
  /** Fetch comments/replies on a specific post */
  fetchCommentsOnPost(
    accessToken: string,
    postId: string,
  ): Promise<FetchedComment[]>;

  /** Reply to a comment or post */
  replyToComment(
    accessToken: string,
    userId: string,
    parentId: string,
    text: string,
  ): Promise<ReplyResult>;

  /** Post a top-level comment on a post */
  postCommentOnPost(
    accessToken: string,
    userId: string,
    postId: string,
    text: string,
  ): Promise<ReplyResult>;
}
