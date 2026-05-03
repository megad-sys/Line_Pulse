"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { useDemoMode } from "@/lib/demo-context";
import { mockChartData } from "@/lib/mock-data";
import type { ChartDay } from "@/lib/types";
import { apiFetch } from "@/lib/api";

export default function PlannedVsProduced() {
  const { isDemo } = useDemoMode();
  const [days, setDays] = useState<ChartDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const loadData = useCallback(async () => {
    if (isDemo) {
      setDays(mockChartData as ChartDay[]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/daily-targets");
      if (res.ok) {
        const json = await res.json();
        setDays(json.days ?? []);
        const today = json.days?.find((d: ChartDay) => d.label === "Today");
        if (today?.planned) setTarget(String(today.planned));
      }
    } catch {
      setDays(mockChartData as ChartDay[]);
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSetTarget(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseInt(target, 10);
    if (!qty || qty < 1) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      await apiFetch("/api/daily-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, target_qty: qty }),
      });
      setSavedMsg("Target saved");
      setTimeout(() => setSavedMsg(""), 2500);
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "#7a7870" }}>Planned vs Produced</h3>

        <form onSubmit={handleSetTarget} className="flex items-center gap-2">
          <label className="text-xs" style={{ color: "#7a7870" }}>Today&apos;s target:</label>
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="e.g. 80"
            min={1}
            className="w-20 text-xs rounded-lg px-2 py-1.5 outline-none"
            style={{ backgroundColor: "#2e2e2b", border: "1px solid #3a3a35", color: "#f0ede8" }}
            disabled={isDemo}
          />
          <button
            type="submit"
            disabled={saving || !target || isDemo}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#2563eb", color: "#ffffff", fontWeight: 600 }}
          >
            {saving ? "Saving…" : "Set Target"}
          </button>
          {savedMsg && <span className="text-xs" style={{ color: "#4ade80" }}>{savedMsg}</span>}
          {isDemo && <span className="text-xs" style={{ color: "#fbbf24" }}>Demo — target saving disabled</span>}
        </form>
      </div>

      <div className="rounded-xl border p-5" style={{ backgroundColor: "#222220", borderColor: "#3a3a35" }}>
        {loading ? (
          <div className="h-52 flex items-center justify-center">
            <div
              className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{ borderColor: "#3a3a35", borderTopColor: "#7a7870" }}
            />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={days} barCategoryGap="30%" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3a3a35" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#7a7870" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#7a7870" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12, borderRadius: 8,
                  backgroundColor: "#222220",
                  border: "1px solid #3a3a35",
                  color: "#f0ede8",
                }}
                cursor={{ fill: "#2e2e2b" }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8, color: "#7a7870" }}
                iconType="circle"
                iconSize={8}
              />
              <Bar dataKey="planned"  name="Planned"  fill="#4a4a45" radius={[3, 3, 0, 0]} />
              <Bar dataKey="produced" name="Produced" fill="#4ade80" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
