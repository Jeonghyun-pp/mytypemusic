"use client";

import { Suspense } from "react";
import DesignGenerateWizard from "./_components/DesignGenerateWizard";

export default function DesignGeneratePage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          로딩 중...
        </div>
      }
    >
      <DesignGenerateWizard />
    </Suspense>
  );
}
