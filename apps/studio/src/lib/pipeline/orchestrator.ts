import { gatherResearch } from "./research-agent";
import { generateOutline } from "./outline-agent";
import { generateDraft, numberSources } from "./writer-agent";
import { evaluateAndEdit } from "./editor-agent";
import type {
  PipelineResult,
  PipelineStatus,
  PersonaContext,
  ContentType,
  Citation,
} from "./types";

const MAX_REWRITES = 2;

/**
 * Minimum research requirements to proceed with article generation.
 * If research falls below these thresholds, the pipeline fails early
 * to prevent hallucination-heavy content.
 */
const MIN_RESEARCH = {
  /** At least 1 web source OR 1 KG artist required */
  minSources: 1,
  /** SNS posts are shorter and can tolerate less research */
  snsExempt: true,
};

interface PipelineInput {
  topic: string;
  contentType?: ContentType;
  targetWordCount?: number;
  persona?: PersonaContext | null;
  /** Skip research sufficiency check (for testing/manual override) */
  skipResearchGate?: boolean;
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

  // ── Research sufficiency gate ──
  const contentType = input.contentType ?? "blog";
  const isSnsExempt = MIN_RESEARCH.snsExempt && (contentType === "sns" || contentType === "carousel");

  if (!input.skipResearchGate && !isSnsExempt) {
    const sourceCount = research.artists.length + research.webSources.length;
    if (sourceCount < MIN_RESEARCH.minSources) {
      notify("failed");
      return {
        status: "failed",
        outline: { title: "", angle: "", sections: [], seoTitle: "", seoDescription: "", seoKeywords: [], targetWordCount: 0 },
        draftContent: "",
        editedContent: "",
        qualityScore: { factualAccuracy: 0, voiceAlignment: 0, readability: 0, originality: 0, seo: 0, overall: 0, feedback: "" },
        rewriteCount: 0,
        researchPacket: research,
        citations: [],
        error: `리서치 데이터 부족: 웹 소스 ${research.webSources.length}개, KG 아티스트 ${research.artists.length}개. 최소 ${MIN_RESEARCH.minSources}개 소스 필요. Hallucination 방지를 위해 생성을 중단합니다.`,
      };
    }
  }

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
  let draftContent = await generateDraft(outline, { persona, contentType, research });
  notify("drafted");

  // ── Stage 3: Editor Agent (with rewrite loop) ──
  let rewriteCount = 0;
  const editorOpts = {
    personaName: persona?.name,
    styleFingerprint: persona?.styleFingerprint,
    contentRules: persona?.contentRules,
    research,
  };
  let editorResult = await evaluateAndEdit(draftContent, outline, editorOpts);
  notify("editing");

  while (!editorResult.passed && rewriteCount < MAX_REWRITES) {
    rewriteCount++;
    notify("drafting");

    // Include citation issues in feedback so the writer can fix them
    let feedback = editorResult.score.feedback;
    if (editorResult.citationIssues && editorResult.citationIssues.length > 0) {
      feedback += `\n\n[CITATION ISSUES] ${editorResult.citationIssues.join("; ")}`;
    }

    // Send back to Writer with editor feedback
    draftContent = await generateDraft(outline, {
      persona,
      contentType,
      research,
      editorFeedback: feedback,
    });
    notify("drafted");

    // Re-evaluate
    editorResult = await evaluateAndEdit(draftContent, outline, editorOpts);
    notify("editing");
  }

  const finalStatus: PipelineStatus = editorResult.passed ? "approved" : "reviewed";
  notify(finalStatus);

  // Build citations array from research sources
  const citations: Citation[] = research
    ? numberSources(research).map((s) => ({
        refNumber: s.refNumber,
        title: s.title,
        url: s.url,
        snippet: s.snippet,
        sourceType: s.sourceType,
        accessedAt: new Date().toISOString(),
      }))
    : [];

  return {
    status: finalStatus,
    outline,
    draftContent,
    editedContent: editorResult.editedContent,
    qualityScore: editorResult.score,
    rewriteCount,
    researchPacket: research,
    citations,
  };
}
