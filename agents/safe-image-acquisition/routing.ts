export type SourceTrack = "PR" | "EDITORIAL" | "STOCK" | "AI";

export type RoutingPlan = {
  tracks: SourceTrack[];
};

const categoryTrackOrder: Record<
  "music" | "fashion" | "celebrity" | "issue",
  SourceTrack[]
> = {
  celebrity: ["PR", "EDITORIAL", "STOCK", "AI"],
  fashion: ["PR", "STOCK", "AI", "EDITORIAL"],
  music: ["PR", "STOCK", "AI", "EDITORIAL"],  // PR includes pressroom + spotify
  issue: ["STOCK", "AI", "PR", "EDITORIAL"],
};

export function buildRoutingPlan(
  category: "music" | "fashion" | "celebrity" | "issue"
): RoutingPlan {
  return { tracks: categoryTrackOrder[category] };
}

const providerTrackMap = new Map<string, SourceTrack>([
  ["pressroom", "PR"],
  ["spotify", "PR"],
  ["unsplash", "STOCK"],
  ["pexels", "STOCK"],
  ["ai-generation", "AI"],
]);

export function providerTrackOf(providerName: string): SourceTrack {
  const track = providerTrackMap.get(providerName);
  if (track === undefined) {
    throw new Error(
      `No track mapping for provider "${providerName}". Register it in providerTrackMap.`
    );
  }
  return track;
}
