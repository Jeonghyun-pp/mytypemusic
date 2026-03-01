import type { PlanItem } from "./types";

function formatDateGCal(dateStr: string): string {
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

export function buildGoogleCalendarUrl(item: PlanItem): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.title,
    dates: `${formatDateGCal(item.date)}/${nextDay(item.date)}`,
    details: item.description + (item.tags.length ? `\n\n${item.tags.join(" ")}` : ""),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function openGoogleCalendar(item: PlanItem) {
  window.open(buildGoogleCalendarUrl(item), "_blank", "noopener");
}
