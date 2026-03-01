import path from "node:path";

/**
 * Root directory for all topic output artefacts.
 * Follows the project convention: agents/topic-intelligence/outputs/
 */
function getOutputsRoot(): string {
  return path.join(
    process.cwd(),
    "agents",
    "topic-intelligence",
    "outputs",
  );
}

export function getTopicOutputsDir(topicId: string): string {
  return path.join(getOutputsRoot(), topicId);
}

export function getPublishBundlePath(topicId: string): string {
  return path.join(getTopicOutputsDir(topicId), "publish-bundle.json");
}
