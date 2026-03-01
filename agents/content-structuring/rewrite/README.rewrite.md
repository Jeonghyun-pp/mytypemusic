# Rewrite Module (Agent3)

LLM-based editor that polishes draft slides and captions before QA/Autofix.

## Position in Pipeline

```
Draft (ContentPlan + caption) → Rewrite (LLM polish) → QA/Autofix (deterministic clamp) → Bridge
```

## Core Rules

- **Rewrite-only**: No new facts, no new evidence. Only polish existing text.
- **JSON-only output**: LLM must return parseable JSON, no markdown.
- **Entity invariance**: Numbers, dates, proper nouns must not change.
- **Slide invariance**: Slide count, order, and kind must not change.
- **No URLs in output**: Evidence URLs are reference-only; never included in LLM output.
- **Profile-aware**: Respects per-kind length limits (headline chars, bullet count/chars).
