"use client";

import { Suspense } from "react";
import CreateHub from "./_components/CreateHub";

export default function CreatePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>로딩 중...</div>}>
      <CreateHub />
    </Suspense>
  );
}
