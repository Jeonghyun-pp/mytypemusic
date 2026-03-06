import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { json, badRequest, serverError } from "@/lib/studio";
import { extractSnsQuotes, CARD_SIZES, type SnsCardData, type CardPlatform } from "@/lib/pipeline/sns-card";

/**
 * POST /api/visual/sns-card — Extract shareable quotes from article content.
 *
 * Body: { topic, content, maxQuotes?, brandColor? }
 * Returns: { cards: SnsCardData[] }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const topic = body.topic as string;
    const content = body.content as string;
    if (!topic || !content) return badRequest("topic and content are required");

    const cards = await extractSnsQuotes({
      topic,
      content,
      maxQuotes: (body.maxQuotes as number) ?? 5,
      brandColor: body.brandColor as string | undefined,
    });

    return json({ cards });
  } catch (e) {
    return serverError(String(e));
  }
}

/**
 * GET /api/visual/sns-card — Render a card image as PNG.
 *
 * Query params:
 *   quote, category, layout, colorScheme, bg1, bg2, accent, fontSize, platform
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const quote = sp.get("quote");
    if (!quote) return new Response("quote is required", { status: 400 });

    const platform = (sp.get("platform") ?? "instagram") as CardPlatform;
    const size = CARD_SIZES[platform] ?? CARD_SIZES.instagram;

    const card: SnsCardData = {
      quote,
      attribution: sp.get("attribution") ?? undefined,
      category: sp.get("category") ?? "",
      layout: (sp.get("layout") as SnsCardData["layout"]) ?? "centered",
      colorScheme: (sp.get("colorScheme") as SnsCardData["colorScheme"]) ?? "dark",
      backgroundGradient: [sp.get("bg1") ?? "#1a1a2e", sp.get("bg2") ?? "#16213e"],
      accentColor: sp.get("accent") ?? "#e94560",
      fontSize: Number(sp.get("fontSize")) || 48,
    };

    return new ImageResponse(
      renderCard(card, size),
      { width: size.width, height: size.height },
    );
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
}

// ── Card JSX renderer for ImageResponse ─────────────────

function renderCard(
  card: SnsCardData,
  size: { width: number; height: number },
) {
  const isVertical = size.height > size.width;
  const padding = isVertical ? "80px 60px" : "60px 80px";

  const textColor = card.colorScheme === "light" ? "#1a1a1a" : "#ffffff";
  const categoryBg = card.colorScheme === "light"
    ? "rgba(0,0,0,0.08)"
    : "rgba(255,255,255,0.15)";

  const baseStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    padding,
    background: `linear-gradient(135deg, ${card.backgroundGradient[0]}, ${card.backgroundGradient[1]})`,
    fontFamily: "Pretendard, sans-serif",
    color: textColor,
  };

  if (card.layout === "centered") {
    return (
      <div style={{ ...baseStyle, justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        {card.category && (
          <div style={{
            display: "flex",
            fontSize: 20,
            padding: "8px 24px",
            borderRadius: 20,
            background: categoryBg,
            marginBottom: 40,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}>
            {card.category}
          </div>
        )}
        <div style={{
          display: "flex",
          fontSize: card.fontSize,
          fontWeight: 700,
          lineHeight: 1.4,
          maxWidth: "90%",
        }}>
          {card.quote}
        </div>
        {card.attribution && (
          <div style={{
            display: "flex",
            fontSize: 18,
            marginTop: 40,
            opacity: 0.7,
          }}>
            — {card.attribution}
          </div>
        )}
        <div style={{
          display: "flex",
          position: "absolute",
          bottom: 40,
          left: 0,
          right: 0,
          justifyContent: "center",
        }}>
          <div style={{
            display: "flex",
            width: 40,
            height: 4,
            borderRadius: 2,
            background: card.accentColor,
          }} />
        </div>
      </div>
    );
  }

  if (card.layout === "left-aligned") {
    return (
      <div style={{ ...baseStyle, justifyContent: "center" }}>
        <div style={{
          display: "flex",
          width: 6,
          height: 60,
          borderRadius: 3,
          background: card.accentColor,
          marginBottom: 30,
        }} />
        {card.category && (
          <div style={{
            display: "flex",
            fontSize: 18,
            marginBottom: 24,
            color: card.accentColor,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}>
            {card.category}
          </div>
        )}
        <div style={{
          display: "flex",
          fontSize: card.fontSize,
          fontWeight: 700,
          lineHeight: 1.4,
          maxWidth: "85%",
        }}>
          {card.quote}
        </div>
        {card.attribution && (
          <div style={{
            display: "flex",
            fontSize: 18,
            marginTop: 30,
            opacity: 0.6,
          }}>
            {card.attribution}
          </div>
        )}
      </div>
    );
  }

  // split layout
  return (
    <div style={{ ...baseStyle, justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{
          display: "flex",
          fontSize: 20,
          padding: "8px 24px",
          borderRadius: 20,
          background: card.accentColor,
          color: "#fff",
          fontWeight: 600,
          alignSelf: "flex-start",
        }}>
          {card.category}
        </div>
      </div>
      <div style={{
        display: "flex",
        fontSize: card.fontSize,
        fontWeight: 700,
        lineHeight: 1.4,
      }}>
        {card.quote}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        {card.attribution && (
          <div style={{ display: "flex", fontSize: 18, opacity: 0.6 }}>
            {card.attribution}
          </div>
        )}
        <div style={{
          display: "flex",
          width: 40,
          height: 4,
          borderRadius: 2,
          background: card.accentColor,
        }} />
      </div>
    </div>
  );
}
