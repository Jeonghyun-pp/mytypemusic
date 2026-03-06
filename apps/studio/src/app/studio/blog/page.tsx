"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import BlogView from "./_components/BlogView";

function BlogPageInner() {
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic");
  const outline = searchParams.get("outline");
  return <BlogView initialTopic={topic ?? undefined} initialOutline={outline ?? undefined} />;
}

export default function BlogPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>로딩 중...</div>}>
      <BlogPageInner />
    </Suspense>
  );
}
