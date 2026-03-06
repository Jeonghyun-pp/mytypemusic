import { prisma } from "@/lib/db";

interface SmartSlot {
  scheduledAt: Date;
  dayLabel: string;
  timeLabel: string;
  reason: string;
}

/**
 * Get the next smart schedule time for an account.
 * Considers optimal engagement times, avoids collisions with existing
 * scheduled/published posts, and respects daily publish limits.
 */
export async function getSmartScheduleTime(
  accountId: string,
  options?: { maxPerDay?: number },
): Promise<SmartSlot | null> {
  const maxPerDay = options?.maxPerDay ?? 3;

  // 1. Get optimal times from post performance data
  const performances = await prisma.postPerformance.findMany({
    where: { snsAccountId: accountId },
  });

  // Aggregate by (dayOfWeek, hourOfDay)
  const slotMap = new Map<string, { total: number; count: number }>();
  for (const p of performances) {
    const key = `${p.dayOfWeek}-${p.hourOfDay}`;
    const entry = slotMap.get(key) ?? { total: 0, count: 0 };
    entry.total += p.engagementRate;
    entry.count += 1;
    slotMap.set(key, entry);
  }

  // Rank slots by average engagement
  const rankedSlots = Array.from(slotMap.entries())
    .map(([key, v]) => {
      const [dow, hour] = key.split("-").map(Number) as [number, number];
      return { dayOfWeek: dow, hourOfDay: hour, avg: v.total / v.count };
    })
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10);

  // Fallback: if no performance data, use common good times
  if (rankedSlots.length === 0) {
    for (const h of [12, 18, 9, 20, 15]) {
      for (let d = 0; d < 7; d++) {
        rankedSlots.push({ dayOfWeek: d, hourOfDay: h, avg: 0 });
      }
    }
  }

  // 2. Get existing scheduled/published posts for collision avoidance
  const now = new Date();
  const lookAhead = new Date(now);
  lookAhead.setDate(lookAhead.getDate() + 7);

  const existingPubs = await prisma.publication.findMany({
    where: {
      snsAccountId: accountId,
      status: { in: ["scheduled", "published"] },
      OR: [
        { scheduledAt: { gte: now, lte: lookAhead } },
        { publishedAt: { gte: now, lte: lookAhead } },
      ],
    },
    select: { scheduledAt: true, publishedAt: true },
  });

  // Build a set of occupied hours and daily counts
  const occupiedHours = new Set<string>();
  const dailyCounts = new Map<string, number>();

  for (const pub of existingPubs) {
    const date = pub.scheduledAt ?? pub.publishedAt;
    if (!date) continue;
    const dateStr = date.toISOString().slice(0, 10);
    const hourKey = `${dateStr}-${date.getHours()}`;
    occupiedHours.add(hourKey);
    dailyCounts.set(dateStr, (dailyCounts.get(dateStr) ?? 0) + 1);
  }

  const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

  // 3. Find next available slot
  for (const slot of rankedSlots) {
    // Check next 14 days for this slot
    for (let offset = 0; offset < 14; offset++) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + offset);

      if (candidate.getDay() !== slot.dayOfWeek) continue;

      candidate.setHours(slot.hourOfDay, 0, 0, 0);
      if (candidate <= now) continue;

      const dateStr = candidate.toISOString().slice(0, 10);
      const hourKey = `${dateStr}-${slot.hourOfDay}`;

      // Skip if same hour already occupied
      if (occupiedHours.has(hourKey)) continue;

      // Skip if daily limit reached
      if ((dailyCounts.get(dateStr) ?? 0) >= maxPerDay) continue;

      return {
        scheduledAt: candidate,
        dayLabel: DAY_LABELS[slot.dayOfWeek] ?? "",
        timeLabel: `${String(slot.hourOfDay).padStart(2, "0")}:00`,
        reason: slot.avg > 0
          ? `참여율 ${(slot.avg * 100).toFixed(1)}% 기반 추천`
          : "일반 추천 시간",
      };
    }
  }

  return null;
}

/**
 * Adjust a requested schedule time to avoid collisions.
 * If the exact hour is taken, shifts ±1h, ±2h until a free slot is found.
 */
export async function adjustScheduleTime(
  accountId: string,
  requestedTime: Date,
  maxPerDay = 3,
): Promise<Date> {
  const dateStr = requestedTime.toISOString().slice(0, 10);

  const existingPubs = await prisma.publication.findMany({
    where: {
      snsAccountId: accountId,
      status: { in: ["scheduled", "published"] },
      scheduledAt: {
        gte: new Date(`${dateStr}T00:00:00Z`),
        lte: new Date(`${dateStr}T23:59:59Z`),
      },
    },
    select: { scheduledAt: true },
  });

  const occupiedHours = new Set(
    existingPubs.map((p) => p.scheduledAt?.getHours()).filter((h) => h != null),
  );

  // Check if daily limit reached
  if (existingPubs.length >= maxPerDay) {
    // Move to next day, same hour
    const next = new Date(requestedTime);
    next.setDate(next.getDate() + 1);
    return adjustScheduleTime(accountId, next, maxPerDay);
  }

  // Try the requested hour first
  if (!occupiedHours.has(requestedTime.getHours())) {
    return requestedTime;
  }

  // Try ±1h, ±2h, ±3h
  for (let delta = 1; delta <= 3; delta++) {
    for (const dir of [1, -1]) {
      const candidate = new Date(requestedTime);
      candidate.setHours(candidate.getHours() + delta * dir);

      // Stay within reasonable hours (7AM - 11PM)
      if (candidate.getHours() < 7 || candidate.getHours() > 23) continue;
      if (candidate <= new Date()) continue;
      if (!occupiedHours.has(candidate.getHours())) return candidate;
    }
  }

  // Fallback: next day same time
  const nextDay = new Date(requestedTime);
  nextDay.setDate(nextDay.getDate() + 1);
  return adjustScheduleTime(accountId, nextDay, maxPerDay);
}
