import { loadContentPlan, loadJson } from "../io/load.js";
import { getAgent2TopicPath, getTopicIntelPath } from "../io/paths.js";
import { saveJson } from "../io/save.js";
import { toAgent2TopicPackage } from "../bridge/to-agent2-topic.js";
import type { TopicIntelInput } from "../contracts.js";
import { parseTopicIntelInput } from "../schema.js";

export type BridgeRunResult = {
  topicId: string;
  agent2TopicPath: string;
  keyFactsSource: "topic-intel" | "slide-headlines";
};

/**
 * Try to load TopicIntelPack and extract keyFacts.
 * Returns undefined on failure (graceful fallback).
 */
async function tryLoadKeyFacts(topicId: string): Promise<string[] | undefined> {
  try {
    const intelPath = getTopicIntelPath(topicId);
    const raw = await loadJson<unknown>(intelPath);
    const intel: TopicIntelInput = parseTopicIntelInput(raw);
    return intel.keyFacts.map((f) => f.text);
  } catch {
    return undefined;
  }
}

/**
 * Run the bridge conversion for a given topicId.
 * Reads content-plan.json + topic-intel.json and produces topic.agent2.json
 * in Agent2 TopicPackage format.
 */
export async function runBridge(params: {
  topicId: string;
}): Promise<BridgeRunResult> {
  const { topicId } = params;

  const contentPlan = await loadContentPlan(topicId);
  const keyFacts = await tryLoadKeyFacts(topicId);

  const agent2Package = toAgent2TopicPackage({ contentPlan, keyFacts });

  const agent2TopicPath = getAgent2TopicPath(topicId);
  await saveJson(agent2TopicPath, agent2Package);

  return {
    topicId,
    agent2TopicPath,
    keyFactsSource: keyFacts ? "topic-intel" : "slide-headlines",
  };
}
