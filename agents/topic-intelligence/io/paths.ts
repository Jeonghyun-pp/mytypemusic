import path from "node:path";

const AGENT_ROOT = path.join(process.cwd(), "agents", "topic-intelligence");

/**
 * Root directory for all topic output artefacts.
 */
export function getOutputsRoot(): string {
  return path.join(AGENT_ROOT, "outputs");
}

/**
 * Directory for a specific topic's output files.
 */
export function getTopicDir(topicId: string): string {
  return path.join(getOutputsRoot(), topicId);
}

/**
 * Path to topic-request.json for a given topicId.
 */
export function getTopicRequestPath(topicId: string): string {
  return path.join(getTopicDir(topicId), "topic-request.json");
}

/**
 * Path to topic-intel.json for a given topicId.
 */
export function getTopicIntelPath(topicId: string): string {
  return path.join(getTopicDir(topicId), "topic-intel.json");
}

/**
 * Path to sources-raw.json for a given topicId.
 */
export function getSourcesRawPath(topicId: string): string {
  return path.join(getTopicDir(topicId), "sources-raw.json");
}

/**
 * Path to topic.agent2.json for a given topicId.
 */
export function getAgent2TopicPath(topicId: string): string {
  return path.join(getTopicDir(topicId), "topic.agent2.json");
}

/**
 * Directory for article body caches.
 */
export function getArticlesDir(topicId: string): string {
  return path.join(getTopicDir(topicId), "articles");
}

/**
 * Path to a single article cache file.
 */
export function getArticleCachePath(topicId: string, idx: number): string {
  return path.join(getArticlesDir(topicId), `article.${String(idx)}.json`);
}

/**
 * Path to the articles index summary.
 */
export function getArticlesIndexPath(topicId: string): string {
  return path.join(getArticlesDir(topicId), "index.json");
}

/**
 * Path to spotify-data.json for a given topicId.
 */
export function getSpotifyDataPath(topicId: string): string {
  return path.join(getTopicDir(topicId), "spotify-data.json");
}

/**
 * Path to angle-history.json (shared across all topics).
 */
export function getAngleHistoryPath(): string {
  return path.join(getOutputsRoot(), ".history", "angle-history.json");
}

/**
 * Root directory for seeds snapshots.
 */
export function getSeedsRoot(): string {
  return path.join(getOutputsRoot(), "seeds");
}

/**
 * Directory for a specific date's seeds snapshot.
 */
export function getSeedsSnapshotDir(dateYyyymmdd: string): string {
  return path.join(getSeedsRoot(), dateYyyymmdd);
}

/**
 * Path to a seeds snapshot file.
 */
export function getSeedsSnapshotPath(
  dateYyyymmdd: string,
  geo: "KR",
): string {
  return path.join(getSeedsSnapshotDir(dateYyyymmdd), `seeds.${geo}.json`);
}

/**
 * Path to a picked seeds file.
 */
export function getPickedSeedsPath(
  dateYyyymmdd: string,
  geo: "KR",
): string {
  return path.join(getSeedsSnapshotDir(dateYyyymmdd), `picked.${geo}.json`);
}

/**
 * Path to a batch run report file.
 */
export function getBatchRunReportPath(
  dateYyyymmdd: string,
  geo: "KR",
): string {
  return path.join(
    getSeedsSnapshotDir(dateYyyymmdd),
    `batch-run.${geo}.json`,
  );
}

/**
 * Path to a coverage gate report file.
 */
export function getCoverageGateReportPath(
  dateYyyymmdd: string,
  geo: "KR",
): string {
  return path.join(
    getSeedsSnapshotDir(dateYyyymmdd),
    `coverage-gate.${geo}.json`,
  );
}

/**
 * Path to a run list file.
 */
export function getRunListPath(
  dateYyyymmdd: string,
  geo: "KR",
): string {
  return path.join(
    getSeedsSnapshotDir(dateYyyymmdd),
    `runlist.${geo}.json`,
  );
}
