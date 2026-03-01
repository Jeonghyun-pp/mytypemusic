"use client";

import { useState, useEffect, useCallback } from "react";
import type { ContentPlanGeneration, PlanItem } from "@/lib/studio/plan/types";

export function usePlanStore() {
  const [plans, setPlans] = useState<ContentPlanGeneration[]>([]);

  useEffect(() => {
    fetch("/api/db/plans")
      .then((r) => r.json())
      .then((data) => setPlans(data as ContentPlanGeneration[]))
      .catch(() => {});
  }, []);

  const addPlan = useCallback(
    async (plan: ContentPlanGeneration) => {
      const res = await fetch("/api/db/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan),
      });
      if (res.ok) {
        const created = (await res.json()) as ContentPlanGeneration;
        setPlans((prev) => [created, ...prev].slice(0, 10));
      }
    },
    [],
  );

  const deletePlan = useCallback(
    async (planId: string) => {
      const res = await fetch(`/api/db/plans/${planId}`, { method: "DELETE" });
      if (res.ok) {
        setPlans((prev) => prev.filter((p) => p.id !== planId));
      }
    },
    [],
  );

  const updatePlanItem = useCallback(
    async (planId: string, itemId: string, patch: Partial<PlanItem>) => {
      const res = await fetch(`/api/db/plans/${planId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setPlans((prev) =>
          prev.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  items: p.items.map((item) =>
                    item.id === itemId ? { ...item, ...patch } : item,
                  ),
                }
              : p,
          ),
        );
      }
    },
    [],
  );

  const deletePlanItem = useCallback(
    async (planId: string, itemId: string) => {
      const res = await fetch(`/api/db/plans/${planId}/items/${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPlans((prev) =>
          prev.map((p) =>
            p.id === planId
              ? { ...p, items: p.items.filter((item) => item.id !== itemId) }
              : p,
          ),
        );
      }
    },
    [],
  );

  const addPlanItem = useCallback(
    async (planId: string, item: PlanItem): Promise<PlanItem | null> => {
      const res = await fetch(`/api/db/plans/${planId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        const created = (await res.json()) as PlanItem;
        setPlans((prev) =>
          prev.map((p) =>
            p.id === planId ? { ...p, items: [...p.items, created] } : p,
          ),
        );
        return created;
      }
      return null;
    },
    [],
  );

  const getLatestPlan = useCallback((): ContentPlanGeneration | null => {
    return plans[0] ?? null;
  }, [plans]);

  return { plans, addPlan, deletePlan, updatePlanItem, deletePlanItem, addPlanItem, getLatestPlan };
}
