"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { HexColorPicker } from "react-colorful";

interface ColorPickerPopoverProps {
  color: string;
  onChange: (color: string) => void;
  recentColors?: string[];
  documentColors?: string[];
  paletteColors?: string[];
}

function hexFromAny(c: string): string {
  if (c.startsWith("#") && (c.length === 7 || c.length === 4)) return c;
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    const r = Number(m[1]).toString(16).padStart(2, "0");
    const g = Number(m[2]).toString(16).padStart(2, "0");
    const b = Number(m[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }
  return "#000000";
}

export default function ColorPickerPopover({
  color,
  onChange,
  recentColors = [],
  documentColors = [],
  paletteColors = [],
}: ColorPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(hexFromAny(color));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHexInput(hexFromAny(color));
  }, [color]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const handlePickerChange = useCallback(
    (hex: string) => {
      setHexInput(hex);
      onChange(hex);
    },
    [onChange],
  );

  const handleHexInput = useCallback(
    (val: string) => {
      setHexInput(val);
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        onChange(val);
      }
    },
    [onChange],
  );

  const swatchRow = (colors: string[], label: string) => {
    if (colors.length === 0) return null;
    return (
      <div style={{ marginTop: "8px" }}>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </div>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {colors.map((c, i) => (
            <button
              key={`${c}-${i}`}
              type="button"
              title={c}
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "4px",
                border: c === color ? "2px solid var(--accent)" : "1px solid rgba(0,0,0,0.15)",
                background: c,
                cursor: "pointer",
                padding: 0,
              }}
              onClick={() => handlePickerChange(hexFromAny(c))}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        style={{
          width: "36px",
          height: "36px",
          padding: "3px",
          borderRadius: "10px",
          border: "1px solid var(--border-light)",
          background: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onClick={() => setOpen(!open)}
      >
        <span
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "7px",
            background: color,
            display: "block",
            border: "1px solid rgba(0,0,0,0.1)",
          }}
        />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 200,
            top: "100%",
            left: 0,
            marginTop: "6px",
            padding: "12px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            width: "220px",
          }}
        >
          <HexColorPicker
            color={hexFromAny(color)}
            onChange={handlePickerChange}
            style={{ width: "100%", height: "160px" }}
          />
          <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>HEX</span>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexInput(e.target.value)}
              style={{
                flex: 1,
                padding: "5px 8px",
                borderRadius: "6px",
                border: "1px solid var(--border-light)",
                background: "var(--bg-input)",
                color: "var(--text)",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                outline: "none",
              }}
            />
          </div>
          {swatchRow(paletteColors, "팔레트")}
          {swatchRow(documentColors, "문서 색상")}
          {swatchRow(recentColors, "최근 사용")}
        </div>
      )}
    </div>
  );
}
