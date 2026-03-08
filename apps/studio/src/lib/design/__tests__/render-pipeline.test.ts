/**
 * Design Engine — Render Pipeline Integration Test.
 *
 * Validates that the rendering pipeline (Satori → PNG) works correctly with:
 *   - Korean text (Pretendard font)
 *   - Multiple aspect ratios (1080x1080, 1080x1920, 1200x675)
 *   - BrandKit styles
 *   - Design engine JSX-style inputs
 *
 * Run: npx tsx apps/studio/src/lib/design/__tests__/render-pipeline.test.ts
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { renderHtmlToPngBuffer } from "../../../../../../agents/shared/render";
import { DEFAULT_BRAND_KIT, getBrandFontStack, pickGradient } from "../brand-kit";
import { PLATFORM_SIZES } from "../types";
import type { DesignPlatform } from "../types";

const OUT_DIR = path.resolve(process.cwd(), "tmp", "design-test-output");

let passed = 0;
let failed = 0;

async function assert(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${(e as Error).message}`);
  }
}

// ── Test 1: Basic Korean text rendering ─────────────────

async function testKoreanTextRendering() {
  const kit = DEFAULT_BRAND_KIT;
  const html = `
    <div style="display:flex;flex-direction:column;width:1080;height:1080;background:${kit.colors.background.dark};padding:${kit.layout.safeMargin}px;font-family:${getBrandFontStack(kit, 'heading')}">
      <div style="display:flex;color:${kit.colors.accent};font-size:${kit.typography.sizes.label}px;font-weight:700;letter-spacing:2px">
        ALBUM REVIEW
      </div>
      <div style="display:flex;color:${kit.colors.text.onDark};font-size:${kit.typography.sizes.title}px;font-weight:800;margin-top:24px;line-height:1.3">
        NewJeans 새 앨범 완벽 해부
      </div>
      <div style="display:flex;color:${kit.colors.text.secondary};font-size:${kit.typography.sizes.body}px;font-weight:400;margin-top:16px;line-height:1.6">
        2026년 가장 기대되는 컴백, 뉴진스의 신보를 트랙별로 분석합니다.
      </div>
    </div>
  `;

  const png = await renderHtmlToPngBuffer(html, "bold-display", 1080, 1080);

  if (png.length < 1000) throw new Error(`PNG too small: ${png.length} bytes`);

  await writeFile(path.join(OUT_DIR, "01-korean-text.png"), png);
}

// ── Test 2: Multiple aspect ratios ──────────────────────

async function testMultipleAspectRatios() {
  const kit = DEFAULT_BRAND_KIT;
  const platforms: DesignPlatform[] = ["instagram", "instagram_story", "twitter"];

  for (const platform of platforms) {
    const { width, height } = PLATFORM_SIZES[platform];
    const html = `
      <div style="display:flex;flex-direction:column;width:${width};height:${height};background:${pickGradient(kit, 0)};padding:${kit.layout.safeMargin}px;justify-content:center;align-items:center">
        <div style="display:flex;color:${kit.colors.text.onDark};font-size:${kit.typography.sizes.subtitle}px;font-weight:700;font-family:${getBrandFontStack(kit)}">
          ${platform} (${width}x${height})
        </div>
        <div style="display:flex;color:${kit.colors.accent};font-size:${kit.typography.sizes.body}px;margin-top:12px;font-family:${getBrandFontStack(kit, 'body')}">
          플랫폼별 비율 테스트
        </div>
      </div>
    `;

    const png = await renderHtmlToPngBuffer(html, "bold-display", width, height);
    if (png.length < 1000) throw new Error(`${platform} PNG too small: ${png.length} bytes`);
    await writeFile(path.join(OUT_DIR, `02-ratio-${platform}.png`), png);
  }
}

// ── Test 3: Card news slide simulation ──────────────────

async function testCardNewsSlide() {
  const kit = DEFAULT_BRAND_KIT;
  const html = `
    <div style="display:flex;flex-direction:column;width:1080;height:1350;background:linear-gradient(180deg, #1A1A2E 0%, #2D1B69 100%);padding:${kit.layout.safeMargin}px">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="display:flex;width:4px;height:24px;background:${kit.colors.accent};border-radius:2px"></div>
        <div style="display:flex;color:${kit.colors.accent};font-size:14px;font-weight:700;letter-spacing:2px;font-family:${getBrandFontStack(kit)}">
          TRENDING
        </div>
      </div>
      <div style="display:flex;color:${kit.colors.text.onDark};font-size:42px;font-weight:800;margin-top:32px;line-height:1.25;font-family:${getBrandFontStack(kit)}">
        2026 상반기 음악 트렌드 키워드 5
      </div>
      <div style="display:flex;flex-direction:column;margin-top:40px;gap:16px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="display:flex;justify-content:center;align-items:center;width:48px;height:48px;background:${kit.colors.primary};border-radius:${kit.layout.cornerRadius}px;color:white;font-size:24px;font-weight:800;font-family:${getBrandFontStack(kit)}">1</div>
          <div style="display:flex;flex-direction:column">
            <div style="display:flex;color:${kit.colors.text.onDark};font-size:22px;font-weight:700;font-family:${getBrandFontStack(kit)}">AI 프로듀싱의 대중화</div>
            <div style="display:flex;color:${kit.colors.text.secondary};font-size:15px;font-weight:400;margin-top:4px;font-family:${getBrandFontStack(kit, 'body')}">AI 작곡 도구가 인디 씬을 변화시키다</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:16px">
          <div style="display:flex;justify-content:center;align-items:center;width:48px;height:48px;background:${kit.colors.primary};border-radius:${kit.layout.cornerRadius}px;color:white;font-size:24px;font-weight:800;font-family:${getBrandFontStack(kit)}">2</div>
          <div style="display:flex;flex-direction:column">
            <div style="display:flex;color:${kit.colors.text.onDark};font-size:22px;font-weight:700;font-family:${getBrandFontStack(kit)}">K-POP 글로벌 확장</div>
            <div style="display:flex;color:${kit.colors.text.secondary};font-size:15px;font-weight:400;margin-top:4px;font-family:${getBrandFontStack(kit, 'body')}">빌보드 HOT 100 진입이 일상이 되다</div>
          </div>
        </div>
      </div>
      <div style="display:flex;margin-top:auto;color:${kit.colors.text.secondary};font-size:12px;font-family:${getBrandFontStack(kit, 'body')}">
        Web Magazine | 2026.03
      </div>
    </div>
  `;

  const png = await renderHtmlToPngBuffer(html, "bold-display", 1080, 1350);
  if (png.length < 1000) throw new Error(`Card news PNG too small: ${png.length} bytes`);
  await writeFile(path.join(OUT_DIR, "03-card-news-slide.png"), png);
}

// ── Test 4: Brand gradient presets ──────────────────────

async function testGradientPresets() {
  const kit = DEFAULT_BRAND_KIT;

  for (let i = 0; i < kit.colors.gradients.length; i++) {
    const html = `
      <div style="display:flex;flex-direction:column;width:540;height:540;background:${pickGradient(kit, i)};padding:40px;justify-content:center;align-items:center">
        <div style="display:flex;color:white;font-size:24px;font-weight:700;font-family:${getBrandFontStack(kit)}">
          Gradient #${i + 1}
        </div>
      </div>
    `;
    const png = await renderHtmlToPngBuffer(html, "bold-display", 540, 540);
    if (png.length < 500) throw new Error(`Gradient ${i} PNG too small`);
    await writeFile(path.join(OUT_DIR, `04-gradient-${i + 1}.png`), png);
  }
}

// ── Run all tests ───────────────────────────────────────

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`\nDesign Engine Render Pipeline Tests`);
  console.log(`Output: ${OUT_DIR}\n`);

  await assert("Korean text rendering (1080x1080)", testKoreanTextRendering);
  await assert("Multiple aspect ratios (IG, Story, Twitter)", testMultipleAspectRatios);
  await assert("Card news slide simulation (1080x1350)", testCardNewsSlide);
  await assert("Brand gradient presets (5 variants)", testGradientPresets);

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total`);

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
