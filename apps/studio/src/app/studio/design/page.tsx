"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DesignEditor from "./_components/DesignEditor";
import ProjectBrowser from "./_components/ProjectBrowser";
import ProjectEditorWrapper from "./_components/ProjectEditorWrapper";

function DesignPageInner() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");
  const quick = searchParams.get("quick");
  const topic = searchParams.get("topic");
  const carousel = searchParams.get("carousel");

  if (projectId) {
    return <ProjectEditorWrapper key={projectId} projectId={projectId} />;
  }

  if (quick || topic) {
    return <DesignEditor initialTopic={topic ?? undefined} initialCarousel={carousel ?? undefined} />;
  }

  return <ProjectBrowser />;
}

export default function DesignPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>로딩 중...</div>}>
      <DesignPageInner />
    </Suspense>
  );
}
