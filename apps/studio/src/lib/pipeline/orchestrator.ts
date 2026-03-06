import { gatherResearch } from "./research-agent";
import { generateOutline } from "./outline-agent";
import { generateDraft } from "./writer-agent";
import { evaluateAndEdit } from "./editor-agent";
import type {
  PipelineResult,
  PipelineStatus,
  PersonaContext,
  ContentType,
} from "./types";

const MAX_REWRITES = 2;

interface PipelineInput {
  topic: string;
  contentType?: ContentType;
  targetWordCount?: number;
  persona?: PersonaContext | null;
  /** Called when pipeline status changes */
  onStatusChange?: (status: PipelineStatus) => void;
}

/**
 * Run the full editorial pipeline: Research → Outline → Writer → Editor (with rewrite loop).
 */
export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const { topic, persona, onStatusChange } = input;
  const notify = onStatusChange ?? (() => {});

  // ── Stage 0: Research Agent ──
  const research = await gatherResearch(topic, {
    persona,
    contentType: input.contentType ?? "blog",
  });

  // ── Stage 1: Outline Agent ──
  notify("outlined");
  const outline = await generateOutline(topic, {
    persona,
    contentType: input.contentType ?? "blog",
    targetWordCount: input.targetWordCount,
    research,
  });

  // ── Stage 2: Writer Agent (initial draft) ──
  notify("drafting");
  const contentType = input.contentType ?? "blog";
  let draftContent = await generateDraft(outline, { persona, contentType, research });
  notify("drafted");

  // ── Stage 3: Editor Agent (with rewrite loop) ──
  let rewriteCount = 0;
  const editorOpts = {
    personaName: persona?.name,
    styleFingerprint: persona?.styleFingerprint,
    contentRules: persona?.contentRules,
  };
  let editorResult = await evaluateAndEdit(draftContent, outline, editorOpts);
  notify("editing");

  while (!editorResult.passed && rewriteCount < MAX_REWRITES) {
    rewriteCount++;
    notify("drafting");

    // Send back to Writer with editor feedback
    draftContent = await generateDraft(outline, {
      persona,
      contentType,
      research,
      editorFeedback: editorResult.score.feedback,
    });
    notify("drafted");

    // Re-evaluate
    editorResult = await evaluateAndEdit(draftContent, outline, editorOpts);
    notify("editing");
  }

  const finalStatus: PipelineStatus = editorResult.passed ? "approved" : "reviewed";
  notify(finalStatus);

  return {
    status: finalStatus,
    outline,
    draftContent,
    editedContent: editorResult.editedContent,
    qualityScore: editorResult.score,
    rewriteCount,
    researchPacket: research,
  };
}
