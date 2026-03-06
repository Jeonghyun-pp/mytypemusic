import type { CommentAdapter } from "./types";
import { threadsCommentAdapter } from "./threads";
import { instagramCommentAdapter } from "./instagram";

export type { FetchedComment, ReplyResult, CommentAdapter } from "./types";

const adapters: Record<string, CommentAdapter> = {
  threads: threadsCommentAdapter,
  instagram: instagramCommentAdapter,
};

export function getCommentAdapter(platform: string): CommentAdapter {
  const adapter = adapters[platform];
  if (!adapter) throw new Error(`No comment adapter for platform: ${platform}`);
  return adapter;
}
