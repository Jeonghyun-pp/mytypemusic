import type { InsightsAdapter, PostInsights, AccountInsights } from "./types";

const API = "https://graph.facebook.com/v21.0";

export const instagramInsightsAdapter: InsightsAdapter = {
  platform: "instagram",

  async fetchAccountInsights(accessToken, userId) {
    // Follower count
    const profileRes = await fetch(
      `${API}/${userId}?fields=followers_count&access_token=${accessToken}`,
    );
    const profile = profileRes.ok
      ? ((await profileRes.json()) as { followers_count?: number })
      : {};

    // Demographics (requires Instagram Insights API)
    const result: AccountInsights = {
      followersCount: profile.followers_count ?? 0,
    };

    try {
      const demoRes = await fetch(
        `${API}/${userId}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&access_token=${accessToken}`,
      );
      if (demoRes.ok) {
        const demoData = (await demoRes.json()) as {
          data?: Array<{
            name: string;
            total_value?: {
              breakdowns?: Array<{
                dimension_keys: string[];
                results: Array<{ dimension_values: string[]; value: number }>;
              }>;
            };
          }>;
        };

        const demo = demoData.data?.[0]?.total_value?.breakdowns;
        if (demo) {
          const demographics: AccountInsights["demographics"] = {};

          for (const breakdown of demo) {
            const dimension = breakdown.dimension_keys[0];
            if (dimension === "age") {
              const total = breakdown.results.reduce((s, r) => s + r.value, 0);
              demographics.age = breakdown.results.map((r) => ({
                range: r.dimension_values[0] ?? "",
                percentage: total > 0 ? Math.round((r.value / total) * 100) : 0,
              }));
            }
            if (dimension === "gender") {
              const total = breakdown.results.reduce((s, r) => s + r.value, 0);
              demographics.gender = breakdown.results.map((r) => ({
                type: r.dimension_values[0] ?? "",
                percentage: total > 0 ? Math.round((r.value / total) * 100) : 0,
              }));
            }
            if (dimension === "city") {
              const total = breakdown.results.reduce((s, r) => s + r.value, 0);
              demographics.topCities = breakdown.results
                .sort((a, b) => b.value - a.value)
                .slice(0, 10)
                .map((r) => ({
                  name: r.dimension_values[0] ?? "",
                  percentage: total > 0 ? Math.round((r.value / total) * 100) : 0,
                }));
            }
            if (dimension === "country") {
              const total = breakdown.results.reduce((s, r) => s + r.value, 0);
              demographics.topCountries = breakdown.results
                .sort((a, b) => b.value - a.value)
                .slice(0, 10)
                .map((r) => ({
                  name: r.dimension_values[0] ?? "",
                  percentage: total > 0 ? Math.round((r.value / total) * 100) : 0,
                }));
            }
          }

          result.demographics = demographics;
        }
      }
    } catch {
      // demographics may not be available for all accounts
    }

    return result;
  },

  async fetchPostInsights(accessToken, platformPostId) {
    // Basic fields
    const fieldsRes = await fetch(
      `${API}/${platformPostId}?fields=like_count,comments_count&access_token=${accessToken}`,
    );
    const fields = fieldsRes.ok
      ? ((await fieldsRes.json()) as {
          like_count?: number;
          comments_count?: number;
        })
      : {};

    // Media insights (reach, impressions, saved)
    let reach = 0;
    let impressions = 0;
    let saved = 0;
    try {
      const insightsRes = await fetch(
        `${API}/${platformPostId}/insights?metric=reach,impressions,saved&access_token=${accessToken}`,
      );
      if (insightsRes.ok) {
        const data = (await insightsRes.json()) as {
          data?: Array<{ name: string; values: Array<{ value: number }> }>;
        };
        for (const metric of data.data ?? []) {
          const val = metric.values?.[0]?.value ?? 0;
          if (metric.name === "reach") reach = val;
          if (metric.name === "impressions") impressions = val;
          if (metric.name === "saved") saved = val;
        }
      }
    } catch {
      /* insights may not be available for all post types */
    }

    return {
      views: impressions || reach,
      likes: fields.like_count ?? 0,
      comments: fields.comments_count ?? 0,
      shares: 0,
      saves: saved,
    };
  },
};
