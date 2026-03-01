"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import type { SlideSpec, SlideStyleOverrides } from "@/lib/studio/designEditor/types";
import { generateHtmlFromSlide } from "@/lib/studio/designEditor/generateHtml";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "13px" }}>
      에디터 로딩 중...
    </div>
  ),
});

interface CodeEditorTabProps {
  slide: SlideSpec;
  globalStyle?: SlideStyleOverrides;
  onCustomHtmlChange: (html: string) => void;
  onClearCustomHtml: () => void;
}

const SATORI_HINTS = [
  "div with children → display:flex 필수",
  "금지: text-shadow, box-shadow, object-fit, filter",
  "img: 절대 px만 (% 불가)",
  "캔버스: 1080 × 1350 px",
];

function formatHtml(html: string): string {
  let indent = 0;
  const lines: string[] = [];
  const tokens = html.replace(/></g, ">\n<").split("\n");
  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("</")) indent = Math.max(0, indent - 1);
    lines.push("  ".repeat(indent) + trimmed);
    if (
      trimmed.startsWith("<") &&
      !trimmed.startsWith("</") &&
      !trimmed.endsWith("/>") &&
      !trimmed.startsWith("<img") &&
      !trimmed.startsWith("<br") &&
      !trimmed.startsWith("<hr")
    ) {
      indent++;
    }
  }
  return lines.join("\n");
}

/** Register custom light theme matching app design system */
function defineTheme(monaco: typeof import("monaco-editor")) {
  monaco.editor.defineTheme("studio-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "tag", foreground: "5B7CF7" },
      { token: "attribute.name", foreground: "D97706" },
      { token: "attribute.value", foreground: "16A34A" },
      { token: "delimiter", foreground: "8B8FA3" },
      { token: "comment", foreground: "8B8FA3", fontStyle: "italic" },
      { token: "string", foreground: "16A34A" },
    ],
    colors: {
      "editor.background": "#FAFAFC",
      "editor.foreground": "#1A1A2E",
      "editor.lineHighlightBackground": "#F0F1F5",
      "editor.selectionBackground": "#D5D6FF",
      "editorLineNumber.foreground": "#C0C1CC",
      "editorLineNumber.activeForeground": "#8B8FA3",
      "editorIndentGuide.background": "#E5E6EB",
      "editorIndentGuide.activeBackground": "#C0C1CC",
      "editor.inactiveSelectionBackground": "#E8E9F0",
      "editorCursor.foreground": "#5B7CF7",
      "editorWhitespace.foreground": "#E5E6EB",
      "editorBracketMatch.background": "#E8E5FF",
      "editorBracketMatch.border": "#5B7CF7",
    },
  });
}

export default function CodeEditorTab({
  slide,
  globalStyle,
  onCustomHtmlChange,
  onClearCustomHtml,
}: CodeEditorTabProps) {
  const [showHints, setShowHints] = useState(false);
  const initializedRef = useRef(false);
  const [editorValue, setEditorValue] = useState<string>("");
  const themeReady = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (slide.customHtml) {
      setEditorValue(slide.customHtml);
    } else {
      const html = generateHtmlFromSlide(slide, globalStyle);
      const formatted = formatHtml(html);
      setEditorValue(formatted);
      onCustomHtmlChange(formatted);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const prevSlideIndex = useRef(slide.slideIndex);
  useEffect(() => {
    if (slide.slideIndex === prevSlideIndex.current) return;
    prevSlideIndex.current = slide.slideIndex;
    initializedRef.current = true;

    if (slide.customHtml) {
      setEditorValue(slide.customHtml);
    } else {
      const html = generateHtmlFromSlide(slide, globalStyle);
      setEditorValue(formatHtml(html));
    }
  }, [slide.slideIndex, slide.customHtml, slide, globalStyle]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const val = value ?? "";
      setEditorValue(val);
      onCustomHtmlChange(val);
    },
    [onCustomHtmlChange],
  );

  const handleRegenerate = useCallback(() => {
    const html = generateHtmlFromSlide(slide, globalStyle);
    const formatted = formatHtml(html);
    setEditorValue(formatted);
    onCustomHtmlChange(formatted);
  }, [slide, globalStyle, onCustomHtmlChange]);

  const handleClear = useCallback(() => {
    onClearCustomHtml();
    const html = generateHtmlFromSlide(slide, globalStyle);
    setEditorValue(formatHtml(html));
  }, [slide, globalStyle, onClearCustomHtml]);

  return (
    <div style={s.wrapper}>
      {/* Toolbar */}
      <div style={s.toolbar}>
        <div style={s.toolbarLeft}>
          <button type="button" style={s.btn} onClick={handleRegenerate}>
            템플릿에서 다시 생성
          </button>
          {slide.customHtml && (
            <button type="button" style={s.btnDanger} onClick={handleClear}>
              초기화
            </button>
          )}
        </div>
        <button
          type="button"
          style={{ ...s.hintToggle, ...(showHints ? s.hintToggleActive : {}) }}
          onClick={() => setShowHints((v) => !v)}
          title="Satori 제한사항"
        >
          ?
        </button>
      </div>

      {/* Hints */}
      {showHints && (
        <div style={s.hints}>
          {SATORI_HINTS.map((hint) => (
            <div key={hint} style={s.hintItem}>{hint}</div>
          ))}
        </div>
      )}

      {/* Editor */}
      <div style={s.editor}>
        <MonacoEditor
          height="100%"
          language="html"
          theme="studio-light"
          value={editorValue}
          onChange={handleEditorChange}
          beforeMount={(monaco) => {
            if (!themeReady.current) {
              defineTheme(monaco);
              themeReady.current = true;
            }
          }}
          options={{
            minimap: { enabled: false },
            wordWrap: "on",
            lineNumbers: "on",
            fontSize: 13,
            fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
            scrollBeyondLastLine: false,
            tabSize: 2,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: "line",
            scrollbar: {
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            occurrencesHighlight: "off" as const,
            selectionHighlight: false,
            roundedSelection: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            smoothScrolling: true,
            bracketPairColorization: { enabled: true },
            guides: { indentation: true, bracketPairs: true },
          }}
        />
      </div>
    </div>
  );
}

const s = {
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    background: "#FAFAFC",
  } as const,

  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderBottom: "1px solid var(--border-light)",
    flexShrink: 0,
    background: "var(--bg-card)",
  } as const,

  toolbarLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  } as const,

  btn: {
    padding: "6px 14px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text)",
    fontSize: "11px",
    fontWeight: 500 as const,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as const,

  btnDanger: {
    padding: "6px 14px",
    borderRadius: "8px",
    border: "1px solid rgba(239,68,68,0.25)",
    background: "rgba(239,68,68,0.05)",
    color: "var(--red)",
    fontSize: "11px",
    fontWeight: 500 as const,
    cursor: "pointer",
    transition: "all var(--transition)",
  } as const,

  hintToggle: {
    width: "26px",
    height: "26px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: 600 as const,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all var(--transition)",
  } as const,

  hintToggleActive: {
    background: "var(--accent)",
    color: "#fff",
    borderColor: "var(--accent)",
  } as const,

  hints: {
    padding: "10px 14px",
    background: "var(--accent-light)",
    borderBottom: "1px solid var(--border-light)",
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
    flexShrink: 0,
  } as const,

  hintItem: {
    fontSize: "11px",
    lineHeight: 1.5,
    color: "var(--text-muted)",
    paddingLeft: "10px",
    borderLeft: "2px solid var(--accent)",
  } as const,

  editor: {
    flex: 1,
    minHeight: 0,
  } as const,
};
