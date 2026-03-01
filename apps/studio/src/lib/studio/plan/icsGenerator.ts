import type { PlanItem } from "./types";

function formatDateICS(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function generateICS(items: PlanItem[]): string {
  const events = items
    .map(
      (item) =>
        `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${formatDateICS(item.date)}\r\nDTEND;VALUE=DATE:${nextDay(item.date)}\r\nSUMMARY:${escapeICS(item.title)}\r\nDESCRIPTION:${escapeICS(item.description + (item.tags.length ? "\\n\\n" + item.tags.join(" ") : ""))}\r\nCATEGORIES:${escapeICS(item.category)}\r\nEND:VEVENT`,
    )
    .join("\r\n");

  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Web Magazine Studio//EN\r\nCALSCALE:GREGORIAN\r\n${events}\r\nEND:VCALENDAR`;
}

export function downloadICS(items: PlanItem[], filename = "content-plan.ics") {
  const icsContent = generateICS(items);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
