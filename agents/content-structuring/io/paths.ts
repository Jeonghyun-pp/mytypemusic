import path from "node:path";

/**
 * Root directory for all topic output artefacts.
 * Shared with Agent5 (topic-intelligence).
 */
export function getOutputsRoot(): string {
  return path.join(
    process.cwd(),
    "agents",
    "topic-intelligence",
    "outputs",
  );
}

function getTopicDir(topicId: string): string {
  return path.join(getOutputsRoot(), topicId);
}

export function getTopicIntelPath(topicId: string): string {
  return path.join(getTopicDir(topicId), "topic-intel.json");
}

export function getTopicRequestPath(topicId: string): string {
  return path.join(getTopicDir(topicId), "topic-request.json");
}

export function getContentPlanPath(topicId: string): string {
  return path.join(getTopicDir(topicId), "content-plan.json");
}

export function getCaptionDraftPath(topicId: string): string {
  return path.join(getTopicDir(topicId), "caption.draft.txt");
}

export function getAgent2TopicPath(topicId: string): string {
  return path.join(getTopicDir(topicId), "topic.agent2.json");
}

export function getRewriteReportPath(topicId: string): string {
  return path.join(getTopicDir(topicId), "rewrite.report.json");
}
