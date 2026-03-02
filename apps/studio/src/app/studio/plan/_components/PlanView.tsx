"use client";

import { useState, useEffect, useCallback } from "react";
import { useCalendarEvents } from "../../calendar/_components/calendarStore";
import { usePlanStore } from "./planStore";
import PlanConfigForm from "./PlanConfigForm";
import PlanTimeline from "./PlanTimeline";
import PlanItemDetail from "./PlanItemDetail";
import PlanExportControls from "./PlanExportControls";
import type { PlanItem, ContentPlanGeneration, CategoryId, PlanGenerateResponse, FrequencyConfig } from "@/lib/studio/plan/types";

export default function PlanView() {
  const calendarStore = useCalendarEvents();
  const planStore = usePlanStore();

  const [currentPlan, setCurrentPlan] = useState<ContentPlanGeneration | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load latest plan when plans are fetched from DB
  useEffect(() => {
    const latest = planStore.plans[0];
    if (latest && !currentPlan) {
      setCurrentPlan(latest);
    }
  }, [planStore.plans, currentPlan]);

  const selectedItem = currentPlan?.items.find((i) => i.id === selectedItemId) ?? null;

  const handleGenerate = useCallback(
    async (config: {
      startDate: string;
      endDate: string;
      frequency: FrequencyConfig;
      preferences?: {
        focusCategories?: CategoryId[];
        avoidCategories?: CategoryId[];
        typeRatio?: { post: number; reels: number; promotion: number };
        notes?: string;
      };
    }) => {
      setIsGenerating(true);
      setError(null);
      setSelectedItemId(null);

      try {
        const res = await fetch("/api/plan/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...config,
            existingEvents: calendarStore.events
              .filter((e) => e.date >= config.startDate && e.date <= config.endDate)
              .map((e) => ({ date: e.date, title: e.title, category: e.category })),
          }),
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `Server error ${res.status}`);
        }

        const data = (await res.json()) as PlanGenerateResponse;

        const plan: ContentPlanGeneration = {
          id: crypto.randomUUID(),
          startDate: config.startDate,
          endDate: config.endDate,
          frequency: config.frequency,
          summary: data.summary,
          createdAt: new Date().toISOString(),
          preferences: config.preferences,
          items: data.items.map((item) => ({
            ...item,
            id: crypto.randomUUID(),
            addedToCalendar: false,
          })),
        };

        setCurrentPlan(plan);
        planStore.addPlan(plan);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsGenerating(false);
      }
    },
    [calendarStore.events, planStore],
  );

  const handleAddToCalendar = useCallback(
    async (item: PlanItem) => {
      if (!currentPlan || item.addedToCalendar) return;

      const calendarEventId = await calendarStore.addEvent({
        date: item.date,
        title: item.title,
        type: item.type,
        category: item.category,
        status: "planned",
        note: item.description + (item.tags.length ? `\n\n${item.tags.join(" ")}` : ""),
      });

      const patch = { addedToCalendar: true, calendarEventId };
      setCurrentPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.id === item.id ? { ...i, ...patch } : i,
          ),
        };
      });
      planStore.updatePlanItem(currentPlan.id, item.id, patch);
    },
    [currentPlan, calendarStore, planStore],
  );

  const handleRemoveFromCalendar = useCallback(
    async (item: PlanItem) => {
      if (!currentPlan || !item.addedToCalendar) return;

      if (item.calendarEventId) {
        await calendarStore.deleteEvent(item.calendarEventId);
      }

      const patch = { addedToCalendar: false, calendarEventId: null as string | null };
      setCurrentPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.id === item.id ? { ...i, ...patch } : i,
          ),
        };
      });
      planStore.updatePlanItem(currentPlan.id, item.id, patch);
    },
    [currentPlan, calendarStore, planStore],
  );

  const handleUpdateItem = useCallback(
    async (itemId: string, patch: Partial<PlanItem>) => {
      if (!currentPlan) return;
      const item = currentPlan.items.find((i) => i.id === itemId);
      const updatedItems = currentPlan.items.map((i) =>
        i.id === itemId ? { ...i, ...patch } : i,
      );
      const updatedPlan = { ...currentPlan, items: updatedItems };
      setCurrentPlan(updatedPlan);
      planStore.updatePlanItem(currentPlan.id, itemId, patch);

      if (item?.addedToCalendar && item.calendarEventId) {
        const calendarPatch: Record<string, string> = {};
        if (patch.date !== undefined) calendarPatch.date = patch.date;
        if (patch.title !== undefined) calendarPatch.title = patch.title;
        if (patch.type !== undefined) calendarPatch.type = patch.type;
        if (patch.category !== undefined) calendarPatch.category = patch.category;
        if (patch.description !== undefined || patch.tags !== undefined) {
          const merged = { ...item, ...patch };
          calendarPatch.note =
            merged.description +
            (merged.tags.length ? `\n\n${merged.tags.join(" ")}` : "");
        }
        if (Object.keys(calendarPatch).length > 0) {
          calendarStore.updateEvent(item.calendarEventId, calendarPatch);
        }
      }
    },
    [currentPlan, planStore, calendarStore],
  );

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      if (!currentPlan) return;
      const item = currentPlan.items.find((i) => i.id === itemId);
      const updatedItems = currentPlan.items.filter((i) => i.id !== itemId);
      setCurrentPlan({ ...currentPlan, items: updatedItems });
      if (selectedItemId === itemId) setSelectedItemId(null);
      if (item?.addedToCalendar && item.calendarEventId) {
        await calendarStore.deleteEvent(item.calendarEventId);
      }
      await planStore.deletePlanItem(currentPlan.id, itemId);
    },
    [currentPlan, selectedItemId, planStore, calendarStore],
  );

  const handleAddItem = useCallback(async () => {
    if (!currentPlan) return;

    const newItem: PlanItem = {
      id: crypto.randomUUID(),
      date: currentPlan.startDate,
      title: "",
      description: "",
      type: "post",
      category: "scene-news",
      tags: [],
      reasoning: "",
      addedToCalendar: false,
    };

    const created = await planStore.addPlanItem(currentPlan.id, newItem);
    if (created) {
      setCurrentPlan((prev) =>
        prev ? { ...prev, items: [...prev.items, created] } : prev,
      );
      setSelectedItemId(created.id);
    }
  }, [currentPlan, planStore]);

  const handleAddAllToCalendar = useCallback(async () => {
    if (!currentPlan) return;
    for (const item of currentPlan.items) {
      if (!item.addedToCalendar) {
        await handleAddToCalendar(item);
      }
    }
  }, [currentPlan, handleAddToCalendar]);

  const handleRemoveAllFromCalendar = useCallback(async () => {
    if (!currentPlan) return;
    for (const item of currentPlan.items) {
      if (item.addedToCalendar) {
        await handleRemoveFromCalendar(item);
      }
    }
  }, [currentPlan, handleRemoveFromCalendar]);

  return (
    <div style={styles.wrapper}>
      {/* Config form */}
      <PlanConfigForm onGenerate={handleGenerate} isGenerating={isGenerating} />

      {/* Error message */}
      {error && (
        <div style={styles.errorBanner}>
          {error}
          <button style={styles.errorClose} onClick={() => setError(null)}>
            x
          </button>
        </div>
      )}

      {/* Loading state */}
      {isGenerating && (
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <span style={styles.loadingText}>AI가 콘텐츠 플랜을 생성하고 있습니다...</span>
        </div>
      )}

      {/* Plan summary */}
      {currentPlan && !isGenerating && (
        <div style={styles.summary}>
          <span style={styles.summaryText}>{currentPlan.summary}</span>
          <span style={styles.summaryDate}>
            {currentPlan.startDate} ~ {currentPlan.endDate}
          </span>
        </div>
      )}

      {/* Body: Timeline + Detail panel */}
      {currentPlan && !isGenerating && (
        <div style={styles.body}>
          <div style={styles.timelineSection}>
            <PlanTimeline
              items={currentPlan.items}
              selectedItemId={selectedItemId}
              onSelectItem={setSelectedItemId}
              onAddToCalendar={handleAddToCalendar}
              onRemoveFromCalendar={handleRemoveFromCalendar}
              onAddItem={handleAddItem}
            />
          </div>
          <div style={styles.sidePanel}>
            {selectedItem ? (
              <PlanItemDetail
                item={selectedItem}
                onAddToCalendar={() => handleAddToCalendar(selectedItem)}
                onRemoveFromCalendar={() => handleRemoveFromCalendar(selectedItem)}
                onUpdate={(patch) => handleUpdateItem(selectedItem.id, patch)}
                onDelete={() => handleDeleteItem(selectedItem.id)}
              />
            ) : (
              <div style={styles.placeholder}>
                <p style={styles.placeholderText}>
                  항목을 클릭하면 상세 정보가 표시됩니다.
                </p>
              </div>
            )}
            {currentPlan.items.length > 0 && (
              <div style={{ marginTop: "20px" }}>
                <PlanExportControls
                  items={currentPlan.items}
                  onAddAllToCalendar={handleAddAllToCalendar}
                  onRemoveAllFromCalendar={handleRemoveAllFromCalendar}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px",
  } as React.CSSProperties,

  errorBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderRadius: "12px",
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.2)",
    color: "var(--red)",
    fontSize: "14px",
  } as React.CSSProperties,

  errorClose: {
    background: "transparent",
    border: "none",
    color: "var(--red)",
    fontSize: "16px",
    cursor: "pointer",
    padding: "4px 8px",
  } as React.CSSProperties,

  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    padding: "60px 20px",
  } as React.CSSProperties,

  spinner: {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    border: "2px solid var(--border-light)",
    borderTopColor: "var(--accent)",
    animation: "spin 0.8s linear infinite",
  } as React.CSSProperties,

  loadingText: {
    color: "var(--text-muted)",
    fontSize: "14px",
  } as React.CSSProperties,

  summary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderRadius: "12px",
    background: "var(--accent-light)",
  } as React.CSSProperties,

  summaryText: {
    fontSize: "14px",
    fontWeight: 500,
    color: "var(--text)",
    flex: 1,
  } as React.CSSProperties,

  summaryDate: {
    fontSize: "12px",
    color: "var(--text-muted)",
    flexShrink: 0,
    marginLeft: "16px",
  } as React.CSSProperties,

  body: {
    display: "flex",
    gap: "20px",
    alignItems: "flex-start",
  } as React.CSSProperties,

  timelineSection: {
    flex: 1,
    minWidth: 0,
    background: "var(--bg-card)",
    borderRadius: "var(--radius-xl)",
    border: "1px solid var(--border-light)",
    padding: "16px 8px",
    maxHeight: "600px",
    overflowY: "auto" as const,
  } as React.CSSProperties,

  sidePanel: {
    width: "360px",
    flexShrink: 0,
  } as React.CSSProperties,

  placeholder: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "200px",
    padding: "40px 20px",
    borderRadius: "var(--radius-xl)",
    border: "1px dashed var(--border-light)",
  } as React.CSSProperties,

  placeholderText: {
    color: "var(--text-muted)",
    fontSize: "14px",
    textAlign: "center" as const,
  } as React.CSSProperties,
};
