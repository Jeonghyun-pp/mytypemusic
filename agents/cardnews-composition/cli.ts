import {
  compose,
  preflightAndCredits,
  templateAndMappingPreview,
  generateCoverHtml,
  generateHtmlDeck,
  renderCoverPng,
  renderDeckPng,
  finalizeOneSlide,
  finalizeDeck,
  qaDeck,
  renderSingleSlide,
} from "./compose.js";
import { isValidPresetId, STYLE_PRESETS } from "./presets.js";
import { generateSlidePlan } from "./llm/index.js";
import { analyzeReferenceImages } from "./style-analysis/index.js";
import { loadTopic } from "./io/load-topic.js";
import fs from "node:fs/promises";
import path from "node:path";

type Mode = "preflight" | "map" | "html" | "png" | "finalize" | "render" | "deck-html" | "deck-png" | "deck-finalize" | "deck-qa" | "llm-plan" | "style-analyze" | "render-slide";

const VALID_MODES: readonly Mode[] = [
  "preflight", "map", "html", "png", "finalize", "render", "deck-html", "deck-png", "deck-finalize", "deck-qa", "llm-plan", "style-analyze", "render-slide",
];

function parseArgs(argv: string[]): {
  input?: string;
  topic?: string;
  out: string;
  template?: string;
  mode: Mode;
  seed?: string;
  style?: string;
  fontMood?: string;
  postType?: string;
  humanInput?: string;
  slideCount?: number;
  images?: string[];
  imagesDir?: string;
  slideIndex?: number;
  slideContent?: string;
  slideKeywords?: string;
  webResearch?: string;
} {
  const args = argv.slice(2);
  const map = new Map<string, string>();

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg !== undefined && arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        map.set(key, next);
        i++;
      }
    }
  }

  const input = map.get("input");
  const out = map.get("out");
  const topic = map.get("topic");
  const rawMode = map.get("mode") ?? "map";

  if (!VALID_MODES.includes(rawMode as Mode)) {
    throw new Error(
      `Unknown mode "${rawMode}". Available modes: ${VALID_MODES.join(", ")}`
    );
  }

  const mode = rawMode as Mode;

  // llm-plan mode requires --topic and --out
  if (mode === "llm-plan") {
    if (!topic || !out) {
      throw new Error(
        `Missing required arguments: ${[!topic && "--topic", !out && "--out"].filter(Boolean).join(", ")}\n` +
          `Usage: agent2:render --mode llm-plan --topic <topic.json> --out <dir> [--slideCount N]`
      );
    }
  }

  // render-slide mode requires --slideIndex, --slideContent, --input, --topic, --out
  if (mode === "render-slide") {
    const rawIdx = map.get("slideIndex");
    if (!rawIdx || !map.get("slideContent") || !input || !topic || !out) {
      const missing = [
        !rawIdx && "--slideIndex",
        !map.get("slideContent") && "--slideContent",
        !input && "--input",
        !topic && "--topic",
        !out && "--out",
      ].filter(Boolean);
      throw new Error(
        `Missing required arguments: ${missing.join(", ")}\n` +
          `Usage: agent2:render --mode render-slide --slideIndex <N> --slideContent <path> --input <validated-post.json> --topic <topic.json> --out <dir>`
      );
    }
  }

  // style-analyze mode requires (--images or --images-dir) and --out
  if (mode === "style-analyze") {
    const rawImages = map.get("images");
    const imagesDir = map.get("images-dir");
    if (!rawImages && !imagesDir) {
      if (!out) {
        throw new Error(
          `Missing required arguments: --images (or --images-dir) and --out\n` +
            `Usage: agent2:render --mode style-analyze --images <img1.png,img2.png> --out <dir>\n` +
            `       agent2:render --mode style-analyze --images-dir <dir> --out <dir>`
        );
      }
    }
  }

  // png / deck-png / deck-qa / style-analyze modes only require --out
  // render-slide and llm-plan have their own validation above
  if (mode === "png" || mode === "deck-png" || mode === "deck-qa" || mode === "style-analyze" || mode === "render-slide" || mode === "llm-plan") {
    if (!out) {
      throw new Error(
        `Missing required argument: --out\n` +
          `Usage: agent2:render --mode ${mode} --out <dir>`
      );
    }
  } else if (!input || !out) {
    const missing = [!input && "--input", !out && "--out"].filter(Boolean);
    throw new Error(
      `Missing required arguments: ${missing.join(", ")}\n` +
        `Usage:\n` +
        `  agent2:render --mode preflight --input <validated-post.json> --out <dir>\n` +
        `  agent2:render --mode map       --input <validated-post.json> --topic <topic.json> --out <dir>\n` +
        `  agent2:render --mode html      --input <validated-post.json> --topic <topic.json> --out <dir>\n` +
        `  agent2:render --mode png       --out <dir>\n` +
        `  agent2:render --mode finalize  --input <validated-post.json> --topic <topic.json> --out <dir>\n` +
        `  agent2:render --mode render    --input <validated-post.json> --topic <topic.json> --out <dir>`
    );
  }

  if (
    (mode === "map" || mode === "html" || mode === "finalize" || mode === "render" || mode === "deck-html" || mode === "deck-finalize") &&
    !topic
  ) {
    throw new Error(
      `--topic is required in ${mode} mode\n` +
        `Usage: agent2:render --mode ${mode} --input <validated-post.json> --topic <topic.json> --out <dir>`
    );
  }

  const style = map.get("style");
  if (style && !isValidPresetId(style)) {
    const validIds = Object.keys(STYLE_PRESETS).join(", ");
    throw new Error(
      `Unknown style preset "${style}". Available: ${validIds}`
    );
  }

  const rawSlideCount = map.get("slideCount");
  const slideCount = rawSlideCount ? parseInt(rawSlideCount, 10) : undefined;
  if (slideCount !== undefined && (isNaN(slideCount) || slideCount < 3 || slideCount > 15)) {
    throw new Error(`slideCount must be between 3 and 15, got "${rawSlideCount}"`);
  }

  const rawImages = map.get("images");
  const images = rawImages ? rawImages.split(",").map(s => s.trim()).filter(Boolean) : undefined;

  const rawSlideIndex = map.get("slideIndex");
  const slideIndex = rawSlideIndex ? parseInt(rawSlideIndex, 10) : undefined;
  if (slideIndex !== undefined && (isNaN(slideIndex) || slideIndex < 0)) {
    throw new Error(`slideIndex must be a non-negative integer, got "${rawSlideIndex}"`);
  }

  return {
    input,
    topic,
    out,
    template: map.get("template"),
    mode,
    seed: map.get("seed"),
    style,
    fontMood: map.get("fontMood"),
    postType: map.get("postType"),
    humanInput: map.get("humanInput"),
    slideCount,
    images,
    imagesDir: map.get("images-dir"),
    slideIndex,
    slideContent: map.get("slideContent"),
    slideKeywords: map.get("slideKeywords"),
    webResearch: map.get("webResearch"),
  };
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);

  console.log("--- Agent2: Card-News Composition ---");
  console.log(`Mode     : ${parsed.mode}`);
  if (parsed.input) console.log(`Input    : ${parsed.input}`);
  console.log(`Output   : ${parsed.out}`);

  // ---- llm-plan ----
  if (parsed.mode === "llm-plan") {
    console.log(`Topic    : ${parsed.topic!}`);
    const slideCount = parsed.slideCount ?? 7;
    console.log(`Slides   : ${slideCount}`);

    const topic = await loadTopic(parsed.topic!);

    // Load per-slide keywords if provided
    let slideKeywords: string[][] | undefined;
    if (parsed.slideKeywords) {
      const raw = await fs.readFile(parsed.slideKeywords, "utf-8");
      slideKeywords = JSON.parse(raw) as string[][];
      console.log(`Keywords : ${parsed.slideKeywords} (${slideKeywords.length} slides)`);
    }

    // Load web research facts if provided
    let webResearchFacts: unknown[] | undefined;
    if (parsed.webResearch) {
      try {
        const raw = await fs.readFile(parsed.webResearch, "utf-8");
        const data = JSON.parse(raw) as { slides?: unknown[] };
        webResearchFacts = data.slides;
        console.log(`WebRes   : ${parsed.webResearch} (${webResearchFacts?.length ?? 0} slides)`);
      } catch {
        console.warn(`[llm-plan] Failed to load web research: ${parsed.webResearch}`);
      }
    }

    const plan = await generateSlidePlan({
      topicPackage: topic,
      slideCount,
      postType: parsed.postType,
      category: topic.category,
      slideKeywords,
      webResearchFacts,
    });

    await fs.mkdir(parsed.out, { recursive: true });
    const outPath = path.join(parsed.out, "llm-slide-plan.json");
    await fs.writeFile(outPath, JSON.stringify(plan, null, 2), "utf-8");

    console.log("\n--- LLM Slide Plan Generated ---");
    console.log(`Total    : ${plan.totalSlides} slides`);
    console.log(`Model    : ${plan.model}`);
    console.log(`Output   : ${outPath}`);
    for (const s of plan.slides) {
      console.log(`  Slide ${String(s.slideIndex).padStart(2, "0")} [${s.kind}]: ${s.title}`);
    }
    return;
  }

  // ---- style-analyze ----
  if (parsed.mode === "style-analyze") {
    let imagePaths = parsed.images ?? [];

    // If --images-dir is provided, scan directory for image files
    if (parsed.imagesDir) {
      const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
      try {
        const entries = await fs.readdir(parsed.imagesDir);
        imagePaths = entries
          .filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
          .slice(0, 3)
          .map((f) => path.join(parsed.imagesDir!, f));
      } catch {
        // Directory doesn't exist → no images
      }
    }

    if (imagePaths.length === 0) {
      console.log("[style-analysis] No reference images found. Skipping.");
      return;
    }

    console.log(`Images   : ${imagePaths.join(", ")}`);

    const profile = await analyzeReferenceImages({
      imagePaths,
      outDir: parsed.out,
    });

    console.log("\n--- Style Analysis Complete ---");
    console.log(`Profile  : ${profile.profileId}`);
    console.log(`Layout   : ${profile.layout.type} (text: ${profile.layout.textPosition})`);
    console.log(`Colors   : primary=${profile.colors.primary}, accent=${profile.colors.accent}`);
    console.log(`Typo     : ${profile.typography.mood} (title: ${profile.typography.titleWeight})`);
    console.log(`Spacing  : ${profile.spacing.density} (cards: ${profile.spacing.usesCards})`);
    console.log(`Confidence: ${profile.confidence}`);
    console.log(`Output   : ${path.join(parsed.out, "style-profile.json")}`);
    return;
  }

  // ---- render-slide ----
  if (parsed.mode === "render-slide") {
    console.log(`Topic    : ${parsed.topic!}`);
    console.log(`Slide    : ${parsed.slideIndex!}`);
    console.log(`Content  : ${parsed.slideContent!}`);

    const rawContent = await fs.readFile(parsed.slideContent!, "utf-8");
    const content = JSON.parse(rawContent) as {
      kind: "cover" | "fact" | "summary" | "cta";
      title: string;
      bodyText: string;
      templateId: string;
      category?: string;
      presetId?: string;
      fontMood?: string;
    };

    const { htmlPath, pngPath } = await renderSingleSlide({
      slideIndex: parsed.slideIndex!,
      kind: content.kind,
      title: content.title,
      bodyText: content.bodyText,
      templateId: content.templateId,
      inputPath: parsed.input!,
      topicPath: parsed.topic!,
      outDir: parsed.out,
      category: content.category,
      stylePresetId: content.presetId ?? parsed.style,
      fontMood: content.fontMood ?? parsed.fontMood,
    });

    console.log(`\n--- Slide ${parsed.slideIndex!} Rendered ---`);
    console.log(`HTML     : ${htmlPath}`);
    console.log(`PNG      : ${pngPath}`);
    return;
  }

  // ---- preflight ----
  if (parsed.mode === "preflight") {
    const preview = await preflightAndCredits({
      inputPath: parsed.input!,
      outDir: parsed.out,
    });

    console.log("\n--- Preflight Complete ---");
    console.log(`Picked Asset : ${preview.pickedAssetId}`);
    console.log(`Role         : ${preview.role}`);
    console.log(`Local Path   : ${preview.localPath}`);
    console.log(`Footer       : ${preview.footerCredits}`);
    console.log(`Caption App. : ${preview.captionAppendix || "(none)"}`);
    console.log(`\nSaved:`);
    console.log(`  ${parsed.out}/compliance.preview.json`);
    console.log(`  ${parsed.out}/credits.preview.json`);
    return;
  }

  // ---- map ----
  if (parsed.mode === "map") {
    console.log(`Topic    : ${parsed.topic!}`);
    if (parsed.template) {
      console.log(`Template : ${parsed.template}`);
    }

    await templateAndMappingPreview({
      inputPath: parsed.input!,
      topicPath: parsed.topic!,
      outDir: parsed.out,
      templatePath: parsed.template,
    });

    console.log("\n--- Template & Mapping Preview Complete ---");
    console.log(`\nSaved:`);
    console.log(`  ${parsed.out}/template.preview.json`);
    console.log(`  ${parsed.out}/mapping.preview.json`);
    return;
  }

  // ---- html ----
  if (parsed.mode === "html") {
    console.log(`Topic    : ${parsed.topic!}`);
    if (parsed.template) {
      console.log(`Template : ${parsed.template}`);
    }

    const { htmlPath } = await generateCoverHtml({
      inputPath: parsed.input!,
      topicPath: parsed.topic!,
      outDir: parsed.out,
      templatePath: parsed.template,
    });

    console.log("\n--- HTML Generation Complete ---");
    console.log(`HTML     : ${htmlPath}`);
    console.log(`Mapping  : ${parsed.out}/mapping.preview.json`);
    return;
  }

  // ---- deck-html ----
  if (parsed.mode === "deck-html") {
    console.log(`Topic    : ${parsed.topic!}`);
    if (parsed.seed) console.log(`Seed     : ${parsed.seed}`);
    if (parsed.style) console.log(`Style    : ${parsed.style}`);

    const { slideCount, htmlPaths, reportPath } = await generateHtmlDeck({
      inputPath: parsed.input!,
      topicPath: parsed.topic!,
      outDir: parsed.out,
      seed: parsed.seed,
      stylePresetId: parsed.style,
    });

    console.log("\n--- Deck HTML Generation Complete ---");
    console.log(`Slides   : ${slideCount}`);
    for (const hp of htmlPaths) {
      console.log(`  ${hp}`);
    }
    console.log(`QA Report: ${reportPath}`);
    return;
  }

  // ---- png ----
  if (parsed.mode === "png") {
    const { pngPath } = await renderCoverPng({ outDir: parsed.out });

    console.log("\n--- PNG Rendering Complete ---");
    console.log(`PNG      : ${pngPath}`);
    return;
  }

  // ---- deck-png ----
  if (parsed.mode === "deck-png") {
    const { count, pngPaths } = await renderDeckPng({ outDir: parsed.out });

    console.log("\n--- Deck PNG Rendering Complete ---");
    console.log(`Rendered : ${count} slides`);
    for (const pp of pngPaths) {
      console.log(`  ${pp}`);
    }
    return;
  }

  // ---- deck-qa ----
  if (parsed.mode === "deck-qa") {
    const { count, reportPath } = await qaDeck({ outDir: parsed.out });

    console.log("\n--- Deck QA Complete ---");
    console.log(`Measured : ${count} slides`);
    console.log(`Report   : ${reportPath}`);
    return;
  }

  // ---- deck-finalize ----
  if (parsed.mode === "deck-finalize") {
    console.log(`Topic    : ${parsed.topic!}`);
    if (parsed.seed) console.log(`Seed     : ${parsed.seed}`);
    if (parsed.style) console.log(`Style    : ${parsed.style}`);

    const { captionPath, manifestPath, slideCount } = await finalizeDeck({
      inputPath: parsed.input!,
      topicPath: parsed.topic!,
      outDir: parsed.out,
      seed: parsed.seed,
      stylePresetId: parsed.style,
    });

    console.log("\n--- Deck Finalize Complete ---");
    console.log(`Slides   : ${slideCount}`);
    console.log(`Caption  : ${captionPath}`);
    console.log(`Manifest : ${manifestPath}`);
    return;
  }

  // ---- finalize ----
  if (parsed.mode === "finalize") {
    console.log(`Topic    : ${parsed.topic!}`);
    if (parsed.template) {
      console.log(`Template : ${parsed.template}`);
    }

    const { captionPath, manifestPath } = await finalizeOneSlide({
      inputPath: parsed.input!,
      topicPath: parsed.topic!,
      outDir: parsed.out,
      templatePath: parsed.template,
    });

    console.log("\n--- Finalize Complete ---");
    console.log(`Caption  : ${captionPath}`);
    console.log(`Manifest : ${manifestPath}`);
    return;
  }

  // ---- render ----
  console.log(`Topic    : ${parsed.topic!}`);
  if (parsed.template) {
    console.log(`Template : ${parsed.template}`);
  }
  if (parsed.postType) {
    console.log(`PostType : ${parsed.postType}`);
  }

  const result = await compose({
    inputPath: parsed.input!,
    topicPath: parsed.topic!,
    outDir: parsed.out,
    templatePath: parsed.template,
    postType: parsed.postType,
    humanInputPath: parsed.humanInput,
  });

  console.log("\n--- Composition Complete ---");
  console.log(`Post ID    : ${result.postId}`);
  console.log(`Slides     : ${result.slides.length}`);
  for (const slide of result.slides) {
    console.log(
      `  Slide ${String(slide.slideIndex).padStart(2, "0")} : ${slide.pngPath}`
    );
  }
  console.log(`Caption    : saved to caption.txt`);
  console.log(`Manifest   : saved to layout_manifest.json`);
}

main().catch((error: unknown) => {
  console.error("--- Composition Failed ---");
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error("Unknown error:", error);
  }
  process.exitCode = 1;
});
