"use client";

import { Suspense } from "react";
import PublishView from "./_components/PublishView";

export default function PublishPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>로딩 중...</div>}>
      <PublishView />
    </Suspense>
  );
}
