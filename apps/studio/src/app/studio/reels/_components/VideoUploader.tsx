"use client";

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";

interface VideoUploaderProps {
  onVideoSelect: (file: File, blobUrl: string) => void;
  hasVideo: boolean;
}

export default function VideoUploader({ onVideoSelect, hasVideo }: VideoUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("video/")) return;
      const blobUrl = URL.createObjectURL(file);
      onVideoSelect(file, blobUrl);
    },
    [onVideoSelect],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div style={s.container}>
      <span style={s.label}>{hasVideo ? "Video" : "Video Upload"}</span>
      <div
        style={{
          ...s.dropzone,
          borderColor: dragging ? "var(--accent)" : "var(--border)",
          background: dragging ? "rgba(99,102,241,0.08)" : "var(--bg-input)",
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          style={{ display: "none" }}
          onChange={onChange}
        />
        {hasVideo ? (
          <span style={s.hint}>Click or drop to replace</span>
        ) : (
          <span style={s.hint}>Drag & drop video or click to browse</span>
        )}
      </div>
    </div>
  );
}

const s = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  },
  label: {
    fontSize: "13px",
    color: "var(--text-muted)",
    fontWeight: 600,
  },
  dropzone: {
    border: "2px dashed var(--border)",
    borderRadius: "8px",
    padding: "24px 16px",
    textAlign: "center" as const,
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
  },
  hint: {
    fontSize: "13px",
    color: "var(--text-muted)",
  },
};
