# Agent 2: Card-News Composition (1-Slide MVP)

Takes Agent 1's `validated-post.json` + editorial `topic.json` and produces a single Instagram card-news image (1080x1350) with attribution.

## Input Files

| File | Description |
|------|-------------|
| `validated-post.json` | Agent 1 output — compliance result with images, attribution |
| `topic.json` | Editorial content — title, subtitle, category, keyFacts |

## Output Files (in `--out` directory)

| File | Description |
|------|-------------|
| `slide_01.html` | Cover slide HTML (mode: html) |
| `slide_01.png` | Rendered PNG screenshot (mode: png) |
| `caption.txt` | Instagram caption text (mode: finalize) |
| `layout_manifest.json` | Manifest with assets, credits, output paths (mode: finalize) |

## Execution Flow

Run modes **in order** — each step depends on the previous.

```
CLI=agents/cardnews-composition/cli.ts
INPUT=outputs/<postId>/validated-post.json
TOPIC=topic.json
OUT=outputs/<postId>/agent2
```

### 1. Preflight — validate input + resolve credits

```bash
npx tsx $CLI --mode preflight --input $INPUT --out $OUT
```

Outputs: `compliance.preview.json`, `credits.preview.json`

### 2. Map — validate template + build slot mapping

```bash
npx tsx $CLI --mode map --input $INPUT --topic $TOPIC --out $OUT
```

Outputs: `template.preview.json`, `mapping.preview.json`

### 3. HTML — generate cover slide HTML

```bash
npx tsx $CLI --mode html --input $INPUT --topic $TOPIC --out $OUT
```

Outputs: `slide_01.html`, `mapping.preview.json`

### 4. PNG — render HTML to PNG via Playwright

```bash
npx tsx $CLI --mode png --out $OUT
```

Outputs: `slide_01.png`

### 5. Finalize — generate caption + manifest

```bash
npx tsx $CLI --mode finalize --input $INPUT --topic $TOPIC --out $OUT
```

Outputs: `caption.txt`, `layout_manifest.json`

## Mode Arguments

| Mode | `--input` | `--topic` | `--out` | `--template` |
|------|-----------|-----------|---------|--------------|
| preflight | required | — | required | optional |
| map | required | required | required | optional |
| html | required | required | required | optional |
| png | — | — | required | — |
| finalize | required | required | required | optional |
| render | required | required | required | optional |

## Failure Cases

### allowed=false

```bash
npx tsx agents/cardnews-composition/cli.ts \
  --mode preflight \
  --input agents/cardnews-composition/fixtures/validated-post.allowed-false.json \
  --out outputs/_test/agent2
```

Expected error: `Post not allowed: blocked for test`

### Attribution required but no credits resolvable

```bash
npx tsx agents/cardnews-composition/cli.ts \
  --mode preflight \
  --input agents/cardnews-composition/fixtures/validated-post.attribution-required-but-missing.json \
  --out outputs/_test/agent2
```

Expected error: `footerCredits required: attribution is mandatory for this post/asset but no credit text could be resolved (assetId=no-credit-asset-001)`

### Missing slide_01.html (finalize before html)

```bash
npx tsx agents/cardnews-composition/cli.ts \
  --mode finalize \
  --input agents/cardnews-composition/fixtures/validated-post.ok.json \
  --topic agents/cardnews-composition/fixtures/topic.min.json \
  --out outputs/_test/empty
```

Expected error: `slide_01.html not found (run --mode html)`

### Missing slide_01.png (finalize before png)

Run `--mode html` first on a directory, then `--mode finalize` without running `--mode png`.

Expected error: `slide_01.png not found (run --mode png)`

## Text Fitting

Long title/subtitle/credits text is automatically truncated with "..." based on template slot `constraints` (`maxChars`/`maxLines`). HTML generation also measures text overflow via Playwright and auto-shrinks font size (title -6px, subtitle -4px, max 2 retries) if text exceeds its bounding box. After rendering, `qa.report.json` is generated with safe-area and footer-zone violation checks; violations are then auto-fixed by adjusting element offsets and font sizes (max 2 retries, subtitle hidden on 2nd retry if still outside safe area). Test with the long-text fixture:

```bash
npx tsx agents/cardnews-composition/cli.ts --mode html \
  --input agents/cardnews-composition/fixtures/validated-post.ok.json \
  --topic agents/cardnews-composition/fixtures/topic.long.json \
  --out outputs/_test/agent2
```

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Missing required argument: --out` | `--out` flag omitted | Add `--out <dir>` |
| `slide_01.html not found` | Running png/finalize before html | Run `--mode html` first |
| `slide_01.png not found` | Running finalize before png | Run `--mode png` first |
| `footerCredits required` | Attribution mandatory but no credit text available | Ensure `validated-post.json` has attribution data |
| `Post not allowed` | Agent 1 blocked the post | Check Agent 1 compliance output |
| `browserType.launch: Executable doesn't exist` | Playwright browsers not installed | Run `npx playwright install chromium` |
