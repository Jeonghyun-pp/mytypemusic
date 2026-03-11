import { describe, it, expect } from "vitest";
import { sanitizeForSatori, validateForSatori } from "../satori-sanitizer";

describe("sanitizeForSatori", () => {
  it("passes through valid Satori HTML unchanged (except display:flex insertion)", () => {
    const html = '<div style="display:flex;width:1080px;height:1080px;background:#000"></div>';
    const result = sanitizeForSatori(html);
    expect(result).toContain("display:flex");
    expect(result).toContain("width:1080px");
    expect(result).toContain("background:#000");
  });

  it("strips unsupported CSS properties", () => {
    const html = '<div style="display:flex;filter:blur(5px);transform:rotate(45deg);color:#fff"></div>';
    const result = sanitizeForSatori(html);
    expect(result).not.toContain("filter");
    expect(result).not.toContain("transform");
    expect(result).toContain("color:#fff");
  });

  it("removes <style> and <script> blocks", () => {
    const html = '<style>.foo { color: red; }</style><div style="display:flex"><script>alert(1)</script></div>';
    const result = sanitizeForSatori(html);
    expect(result).not.toContain("<style");
    expect(result).not.toContain("<script");
    expect(result).toContain("<div");
  });

  it("converts <br> to spacing div", () => {
    const html = '<div style="display:flex">hello<br/>world</div>';
    const result = sanitizeForSatori(html);
    expect(result).not.toContain("<br");
    expect(result).toContain("height:8px");
  });

  it("converts <hr> to border div", () => {
    const html = '<div style="display:flex"><hr></div>';
    const result = sanitizeForSatori(html);
    expect(result).not.toContain("<hr");
    expect(result).toContain("height:1px");
    expect(result).toContain("background-color:#ccc");
  });

  it("removes class and className attributes", () => {
    const html = '<div class="foo bar" style="display:flex"><span className="baz" style="display:flex"></span></div>';
    const result = sanitizeForSatori(html);
    expect(result).not.toContain("class=");
    expect(result).not.toContain("className=");
  });

  it("adds default width/height to <img> tags missing them", () => {
    const html = '<img src="test.png" />';
    const result = sanitizeForSatori(html);
    expect(result).toContain('width="200"');
    expect(result).toContain('height="200"');
  });

  it("does not add width/height to <img> that already has them", () => {
    const html = '<img src="test.png" width="100" height="50" />';
    const result = sanitizeForSatori(html);
    expect(result).toContain('width="100"');
    expect(result).toContain('height="50"');
    // Should not have double width/height
    expect(result.match(/width/g)?.length).toBe(1);
  });

  it("converts rem/em units to px", () => {
    const html = '<div style="display:flex;font-size:1.5rem;padding:2em"></div>';
    const result = sanitizeForSatori(html);
    expect(result).toContain("font-size:24px"); // 1.5 * 16 = 24
    expect(result).toContain("padding:32px"); // 2 * 16 = 32
    expect(result).not.toContain("rem");
    expect(result).not.toContain("em");
  });

  it("adds display:flex when missing", () => {
    const html = '<div style="color:#fff;width:100px"></div>';
    const result = sanitizeForSatori(html);
    expect(result).toContain("display:flex");
  });

  it("handles empty/whitespace input", () => {
    expect(sanitizeForSatori("")).toBe("");
    expect(sanitizeForSatori("   ")).toBe("   ");
  });

  it("strips grid-related CSS properties", () => {
    const html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;color:#000"></div>';
    const result = sanitizeForSatori(html);
    expect(result).not.toContain("grid-template");
    expect(result).toContain("gap:10px");
    expect(result).toContain("color:#000");
  });
});

describe("validateForSatori", () => {
  it("returns empty array for valid HTML", () => {
    const html = '<div style="display:flex;width:100px;color:#fff"></div>';
    const issues = validateForSatori(html);
    expect(issues).toHaveLength(0);
  });

  it("detects <style> tags", () => {
    const html = '<style>.foo{}</style><div style="display:flex"></div>';
    const issues = validateForSatori(html);
    expect(issues).toContain("<style> tag found");
  });

  it("detects unsupported CSS properties", () => {
    const html = '<div style="display:flex;filter:blur(5px);animation:spin 1s"></div>';
    const issues = validateForSatori(html);
    expect(issues).toContain("Unsupported CSS: filter");
    expect(issues).toContain("Unsupported CSS: animation");
  });

  it("detects <img> without width/height", () => {
    const html = '<img src="test.png" />';
    const issues = validateForSatori(html);
    expect(issues).toContain("<img> missing width");
    expect(issues).toContain("<img> missing height");
  });

  it("detects rem units", () => {
    const html = '<div style="font-size:1.5rem"></div>';
    const issues = validateForSatori(html);
    expect(issues).toContain("rem unit found");
  });

  it("detects class attributes", () => {
    const html = '<div class="foo" style="display:flex"></div>';
    const issues = validateForSatori(html);
    expect(issues).toContain("class attribute found");
  });
});
