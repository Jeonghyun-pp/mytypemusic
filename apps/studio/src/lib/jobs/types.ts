export type JobType =
  | "publish"
  | "performance_collect"
  | "autopilot_scan"
  | "comment_monitor"
  | "comment_fetch"
  | "reply_send"
  | "keyword_scan"
  | "keyword_comment_post"
  | "daily_reset"
  | "analytics_collect"
  | "persona_learn"
  | "onboard_analyze"
  | "reference_feed_sync";

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface JobHandler {
  type: JobType;
  handle(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
}
