"use client";

import { usePipeline } from "./PipelineProvider";

interface Props {
  isMobile: boolean;
  onClick: () => void;
}

export default function PipelineAwareFab({ isMobile, onClick }: Props) {
  const { isActive } = usePipeline();

  // When pipeline is active, push FAB above the bottom bar (56px)
  const bottom = isActive
    ? (isMobile ? 20 : 28) + 60
    : (isMobile ? 20 : 28);

  return (
    <button
      className="fab-btn"
      onClick={onClick}
      style={{
        position: "fixed",
        bottom,
        right: isMobile ? 20 : 28,
        width: 52,
        height: 52,
        borderRadius: "50%",
        border: "none",
        background: "linear-gradient(135deg, var(--accent), #2E8D5A)",
        color: "#fff",
        fontSize: 26,
        fontWeight: 300,
        cursor: "pointer",
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "bottom 0.2s ease",
      }}
      title="새 포스트"
    >
      +
    </button>
  );
}
