import { runContent, type ContentRunResult } from "./content.js";
import { runBridge, type BridgeRunResult } from "./bridge.js";
import type { RewriteConfig } from "../rewrite/contracts.js";

export type E2ERunResult = {
  topicId: string;
  content: ContentRunResult;
  bridge: BridgeRunResult;
};

/**
 * Run the full pipeline: content (+ rewrite) → bridge.
 * If content fails, bridge is not executed.
 */
export async function runE2E(params: {
  topicId: string;
  rewrite?: Partial<RewriteConfig>;
}): Promise<E2ERunResult> {
  const { topicId, rewrite } = params;

  const content = await runContent({ topicId, rewrite });
  const bridge = await runBridge({ topicId });

  return { topicId, content, bridge };
}
