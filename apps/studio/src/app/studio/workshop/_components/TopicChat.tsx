"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  topicUpdate?: Record<string, unknown> | null;
  createdAt: string;
}

interface Props {
  draftId: string;
  messages: Message[];
  onNewMessage: () => void;
}

const SUGGESTION_CHIPS = [
  "각도를 바꿔줘",
  "더 논쟁적으로",
  "SEO 키워드 추천",
  "SNS 미리보기 다시 작성",
  "다른 아티스트로 바꿔줘",
];

export default function TopicChat({ draftId, messages, onNewMessage }: Props) {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, streamText]);

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;

    setInput("");
    setStreaming(true);
    setStreamText("");

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`/api/topics/${draftId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;

          try {
            const event = JSON.parse(payload) as {
              type: string;
              text?: string;
              message?: string;
            };
            if (event.type === "delta" && event.text) {
              setStreamText((prev) => prev + event.text);
            }
          } catch {
            // skip invalid JSON
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("[TopicChat] stream error:", err);
      }
    } finally {
      setStreaming(false);
      setStreamText("");
      abortRef.current = null;
      onNewMessage();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={s.wrapper}>
      {/* Message list */}
      <div ref={listRef} style={s.messageList}>
        {messages.length === 0 && !streaming && (
          <div style={s.emptyChat}>
            주제에 대해 AI와 대화하며 다듬어보세요
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              ...s.bubble,
              ...(m.role === "user" ? s.userBubble : s.aiBubble),
            }}
          >
            <div style={s.bubbleRole}>
              {m.role === "user" ? "나" : "AI"}
            </div>
            <div style={s.bubbleText}>{m.content}</div>
            {m.topicUpdate && (
              <div style={s.updateBadge}>주제 업데이트됨</div>
            )}
          </div>
        ))}

        {streaming && streamText && (
          <div style={{ ...s.bubble, ...s.aiBubble }}>
            <div style={s.bubbleRole}>AI</div>
            <div style={s.bubbleText}>{streamText}</div>
          </div>
        )}
      </div>

      {/* Suggestion chips */}
      {messages.length === 0 && !streaming && (
        <div style={s.chipRow}>
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip}
              style={s.chip}
              onClick={() => handleSend(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={s.inputRow}>
        <input
          style={s.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="주제를 어떻게 바꿀까요?"
          disabled={streaming}
        />
        <button
          style={{
            ...s.sendBtn,
            opacity: streaming || !input.trim() ? 0.5 : 1,
          }}
          onClick={() => handleSend()}
          disabled={streaming || !input.trim()}
        >
          {streaming ? "..." : "전송"}
        </button>
      </div>
    </div>
  );
}

const s = {
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    height: "100%",
  },
  messageList: {
    flex: 1,
    overflowY: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    padding: "8px 0",
    maxHeight: 400,
    minHeight: 200,
  },
  emptyChat: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "var(--text-muted)",
    fontSize: 13,
  },
  bubble: {
    padding: "8px 12px",
    borderRadius: 10,
    maxWidth: "85%",
    fontSize: 13,
    lineHeight: 1.5,
  },
  userBubble: {
    alignSelf: "flex-end" as const,
    background: "var(--accent)",
    color: "#fff",
  },
  aiBubble: {
    alignSelf: "flex-start" as const,
    background: "var(--bg-input)",
    color: "var(--text)",
  },
  bubbleRole: {
    fontSize: 10,
    fontWeight: 600,
    opacity: 0.7,
    marginBottom: 2,
  },
  bubbleText: {
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
  },
  updateBadge: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: 600,
    color: "var(--green, #22c55e)",
    padding: "2px 6px",
    borderRadius: 4,
    background: "rgba(34,197,94,0.1)",
    display: "inline-block",
  },
  chipRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap" as const,
    padding: "4px 0",
  },
  chip: {
    padding: "5px 10px",
    borderRadius: 16,
    border: "1px solid var(--border-light)",
    background: "var(--bg-card)",
    color: "var(--text-muted)",
    fontSize: 11,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  inputRow: {
    display: "flex",
    gap: 6,
  },
  input: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
  },
  sendBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
};
