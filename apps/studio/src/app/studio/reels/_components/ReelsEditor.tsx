"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { TextOverlay } from "@/remotion/ReelsComp";
import type { PlayerPreviewHandle } from "./PlayerPreview";
import { CONTENT_CATEGORIES } from "@/lib/studio/contentCategories";
import VideoUploader from "./VideoUploader";
import TextOverlayPanel from "./TextOverlayPanel";
import TimelineBar from "./TimelineBar";

const PlayerPreview = dynamic(() => import("./PlayerPreview"), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#111", borderRadius: "var(--radius-sm)", color: "#555" }}>
      Loading player...
    </div>
  ),
});

const FPS = 30;
const DEFAULT_DURATION = FPS * 10; // 10 seconds

export default function ReelsEditor() {
  // ── State ──
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [overlayTexts, setOverlayTexts] = useState<TextOverlay[]>([]);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(DEFAULT_DURATION);
  const [totalFrames, setTotalFrames] = useState(DEFAULT_DURATION);
  const [uploading, setUploading] = useState(false);
  const [serverUrl, setServerUrl] = useState("");

  const playerRef = useRef<PlayerPreviewHandle>(null);

  // ── Detect video duration via hidden <video> element ──
  useEffect(() => {
    if (!videoUrl) return;
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = videoUrl;
    video.onloadedmetadata = () => {
      const frames = Math.ceil(video.duration * FPS);
      setTotalFrames(frames);
      setTrimEnd(frames);
      URL.revokeObjectURL(video.src);
    };
  }, [videoUrl]);

  // ── Video upload handler ──
  const handleVideoSelect = useCallback(async (file: File, blobUrl: string) => {
    setVideoFile(file);
    setVideoUrl(blobUrl);
    setTrimStart(0);

    // Upload to server in background
    setUploading(true);
    try {
      const form = new FormData();
      form.append("video", file);
      const res = await fetch("/api/reels/upload", { method: "POST", body: form });
      if (res.ok) {
        const data = (await res.json()) as { url: string };
        setServerUrl(data.url);
      }
    } catch {
      // Keep using blob URL for preview
    } finally {
      setUploading(false);
    }
  }, []);

  // ── Player props ──
  const inputProps = useMemo(
    () => ({
      videoUrl,
      overlayTexts,
      trimStartFrame: trimStart,
      trimEndFrame: trimEnd,
    }),
    [videoUrl, overlayTexts, trimStart, trimEnd],
  );

  const durationInFrames = trimEnd - trimStart;

  return (
    <div style={s.outer}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.headerTitle}>Reels Editor</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={s.categorySelect}
          >
            <option value="">카테고리 선택</option>
            {CONTENT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <span style={s.headerInfo}>
            1080 x 1920 · {FPS}fps
            {videoFile ? ` · ${videoFile.name}` : ""}
            {uploading ? " (uploading...)" : ""}
          </span>
        </div>
        <div style={s.headerActions}>
          <button
            type="button"
            style={{
              ...s.renderBtn,
              opacity: videoUrl ? 1 : 0.4,
            }}
            disabled={!videoUrl}
            onClick={() => {
              // Render will be implemented with /api/reels/render
              alert("Render feature coming soon!\nServer URL: " + (serverUrl || "not uploaded yet"));
            }}
          >
            MP4 Render
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={s.main}>
        {/* Left panel */}
        <div style={s.panel}>
          <div style={s.panelScroll}>
            <VideoUploader onVideoSelect={handleVideoSelect} hasVideo={!!videoUrl} />

            {videoUrl && (
              <>
                <div style={s.divider} />
                <TimelineBar
                  trimStart={trimStart}
                  trimEnd={trimEnd}
                  totalFrames={totalFrames}
                  fps={FPS}
                  onTrimChange={(start, end) => {
                    setTrimStart(start);
                    setTrimEnd(end);
                  }}
                />
              </>
            )}

            <div style={s.divider} />
            <TextOverlayPanel
              overlays={overlayTexts}
              onChange={setOverlayTexts}
              fps={FPS}
            />
          </div>
        </div>

        {/* Preview */}
        <div style={s.preview}>
          <PlayerPreview
            ref={playerRef}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
          />
        </div>
      </div>
    </div>
  );
}

const s = {
  outer: {
    display: "flex",
    flexDirection: "column" as const,
    height: "calc(100vh - 130px)",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border-light)",
    overflow: "hidden",
    boxShadow: "var(--shadow-card)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid var(--border-light)",
    flexShrink: 0,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  headerTitle: {
    fontSize: "15px",
    fontWeight: 600,
    color: "var(--text)",
  },
  categorySelect: {
    padding: "6px 10px",
    borderRadius: "10px",
    border: "1px solid var(--border-light)",
    background: "var(--bg-input)",
    fontSize: "12px",
    color: "var(--text)",
    outline: "none",
    cursor: "pointer",
    transition: "all var(--transition)",
  },
  headerInfo: {
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  renderBtn: {
    padding: "8px 16px",
    borderRadius: "10px",
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all var(--transition)",
  },
  main: {
    display: "flex",
    flex: 1,
    minHeight: 0,
  },
  panel: {
    width: "380px",
    flexShrink: 0,
    borderRight: "1px solid var(--border-light)",
    display: "flex",
    flexDirection: "column" as const,
  },
  panelScroll: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },
  preview: {
    flex: 1,
    display: "flex",
    padding: "20px",
    minWidth: 0,
    background: "var(--bg-secondary)",
  },
  divider: {
    height: "1px",
    background: "var(--border-light)",
    margin: "4px 0",
  },
};
