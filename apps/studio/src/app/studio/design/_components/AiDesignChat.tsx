"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { DesignSpec, AiDesignAction } from "@/lib/studio/designEditor/types";

// ── Types ────────────────────────────────────────────────

export interface DesignChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: AiDesignAction[];
}

interface AiDesignChatProps {
  spec: DesignSpec;
  onApplyActions: (actions: AiDesignAction[]) => void;
}

// ── SSE parser ───────────────────────────────────────────

interface SseEvent {
  type: string;
  text?: string;
  message?: string;
  actions?: AiDesignAction[];
}

function parseSSE(buffer: string): [SseEvent[], string] {
  const events: SseEvent[] = [];
  const lines = buffer.split("\n");
  let remaining = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("data: ")) {
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        events.push(JSON.parse(data) as SseEvent);
      } catch { /* skip */ }
    } else if (line === "" || line === "\r") {
      // empty line = event boundary
    } else {
      if (i === lines.length - 1) remaining = line;
    }
  }
  return [events, remaining];
}

// ── Styles ───────────────────────────────────────────────

const s = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    minHeight: 0,
  } as const,
  messageList: {
    flex: 1,
    overflowY: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
    marginBottom: "12px",
    minHeight: 0,
  } as const,
  msgBubble: {
    maxWidth: "95%",
    padding: "10px 14px",
    borderRadius: "var(--radius-sm)",
    fontSize: "13px",
    lineHeight: "1.5",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
  } as const,
  userMsg: {
    alignSelf: "flex-end" as const,
    background: "var(--accent)",
    color: "#fff",
  } as const,
  assistantMsg: {
    alignSelf: "flex-start" as const,
    background: "var(--bg-input)",
    color: "var(--text)",
  } as const,
  actionBadge: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: 600,
    background: "var(--accent-light)",
    color: "var(--accent)",
    marginTop: "6px",
    marginRight: "4px",
  } as const,
  inputRow: {
    display: "flex",
    gap: "8px",
    flexShrink: 0,
  } as const,
  input: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: "13px",
    outline: "none",
    transition: "border-color var(--transition)",
  } as const,
  sendBtn: {
    padding: "10px 18px",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
    transition: "all var(--transition)",
  } as const,
  empty: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-muted)",
    fontSize: "13px",
    textAlign: "center" as const,
    padding: "20px",
    lineHeight: "1.6",
  } as const,
};

// ── Component ────────────────────────────────────────────

export default function AiDesignChat({ spec, onApplyActions }: AiDesignChatProps) {
  const [messages, setMessages] = useState<DesignChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: DesignChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const res = await fetch("/api/design/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          designSpec: spec,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).error ?? `HTTP ${String(res.status)}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let appliedActions: AiDesignAction[] = [];

      // Add placeholder assistant message
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const [events, remaining] = parseSSE(buffer);
        buffer = remaining;

        for (const evt of events) {
          if (evt.type === "delta" && evt.text) {
            // delta events contain raw JSON tokens, not displayable text
            // We accumulate but don't show — the final "actions" event has the clean message
          } else if (evt.type === "actions") {
            assistantText = evt.message ?? "";
            appliedActions = evt.actions ?? [];

            // Apply actions to the design spec
            if (appliedActions.length > 0) {
              onApplyActions(appliedActions);
            }
          }
        }
      }

      // Update the assistant message with final content
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = {
            ...last,
            content: assistantText || "(응답 없음)",
            actions: appliedActions.length > 0 ? appliedActions : undefined,
          };
        }
        return updated;
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const errMsg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = { ...last, content: `Error: ${errMsg}` };
        } else {
          updated.push({ role: "assistant", content: `Error: ${errMsg}` });
        }
        return updated;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, messages, streaming, spec, onApplyActions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div style={s.container}>
      <div ref={listRef} style={s.messageList}>
        {messages.length === 0 && (
          <div style={s.empty}>
            디자인에 대해 AI에게 요청해보세요.<br />
            예: &quot;배경을 어두운 네이비로 바꿔줘&quot;<br />
            &quot;제목을 더 크게 해줘&quot;
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            <div
              style={{
                ...s.msgBubble,
                ...(msg.role === "user" ? s.userMsg : s.assistantMsg),
              }}
            >
              {msg.content || (streaming && i === messages.length - 1 ? "생각 중..." : "")}
            </div>
            {msg.actions && msg.actions.length > 0 && (
              <div style={{ marginTop: "4px" }}>
                {msg.actions.map((a, j) => (
                  <span key={j} style={s.actionBadge}>
                    {a.action}{a.explanation ? `: ${a.explanation}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={s.inputRow}>
        <input
          style={s.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="디자인 변경 요청..."
          disabled={streaming}
        />
        <button
          type="button"
          style={{ ...s.sendBtn, opacity: streaming ? 0.5 : 1 }}
          onClick={() => void handleSend()}
          disabled={streaming}
        >
          {streaming ? "..." : "전송"}
        </button>
      </div>
    </div>
  );
}
