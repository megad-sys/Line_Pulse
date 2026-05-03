"use client";

import { useState, useEffect } from "react";
import { Plus, GripVertical, Trash2, ChevronRight, Loader2, AlertCircle, RotateCcw, CheckCircle2, Printer, Factory } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";
import { apiPublicFetch } from "@/lib/api";

/* ── Types ────────────────────────────────────────────────── */
type Line = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  created_at: string;
  stationCount?: number;
};
type LineStation = {
  id: string;
  tenant_id: string;
  line_id: string;
  station_name: string;
  target_mins: number;
  sequence_order: number;
};
type CreatedPart = { id: string; qr_code: string };

/* ── Helpers ──────────────────────────────────────────────── */
function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function pad(n: number, w: number) { return String(n).padStart(w, "0"); }
const APP_URL = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");

/* ── Mock data ────────────────────────────────────────────── */
const MOCK_LINES: Line[] = [
  { id: "mock-1", tenant_id: "mock", name: "Line A", description: "PCB Assembly",   created_at: new Date().toISOString(), stationCount: 5 },
  { id: "mock-2", tenant_id: "mock", name: "Line B", description: "Final Assembly", created_at: new Date().toISOString(), stationCount: 3 },
];
const MOCK_STATIONS: Record<string, LineStation[]> = {
  "mock-1": [
    { id: "ms-1", tenant_id: "mock", line_id: "mock-1", station_name: "SMT",              target_mins: 5, sequence_order: 0 },
    { id: "ms-2", tenant_id: "mock", line_id: "mock-1", station_name: "Soldering",         target_mins: 6, sequence_order: 1 },
    { id: "ms-3", tenant_id: "mock", line_id: "mock-1", station_name: "Visual Inspection", target_mins: 7, sequence_order: 2 },
    { id: "ms-4", tenant_id: "mock", line_id: "mock-1", station_name: "Functional Test",   target_mins: 8, sequence_order: 3 },
    { id: "ms-5", tenant_id: "mock", line_id: "mock-1", station_name: "Packaging",         target_mins: 4, sequence_order: 4 },
  ],
  "mock-2": [
    { id: "ms-6", tenant_id: "mock", line_id: "mock-2", station_name: "Sub-Assembly",   target_mins: 10, sequence_order: 0 },
    { id: "ms-7", tenant_id: "mock", line_id: "mock-2", station_name: "Final Assembly", target_mins: 12, sequence_order: 1 },
    { id: "ms-8", tenant_id: "mock", line_id: "mock-2", station_name: "QC Check",       target_mins:  6, sequence_order: 2 },
  ],
};

type View = "lines" | "batch" | "printed";

export default function CustomerLineSetup() {
  const supabase = createClient();

  /* ── Auth / tenant ──────────────────────────────────────── */
  const [tenantId, setTenantId]                 = useState("");
  const [isDemo, setIsDemo]                     = useState(false);
  const [setupIncomplete, setSetupIncomplete]   = useState(false);
  const [setupUserId, setSetupUserId]           = useState("");
  const [setupUserName, setSetupUserName]       = useState("");
  const [setupFactoryName, setSetupFactoryName] = useState("");
  const [settingUp, setSettingUp]               = useState(false);
  const [setupError, setSetupError]             = useState("");

  /* ── Lines ──────────────────────────────────────────────── */
  const [loading, setLoading]               = useState(true);
  const [lines, setLines]                   = useState<Line[]>([]);
  const [selectedLine, setSelectedLine]     = useState<Line | null>(null);
  const [stations, setStations]             = useState<LineStation[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);

  const [showAddLine, setShowAddLine] = useState(false);
  const [lineName, setLineName]       = useState("");
  const [lineDesc, setLineDesc]       = useState("");
  const [addingLine, setAddingLine]   = useState(false);
  const [lineError, setLineError]     = useState("");

  const [showAddStation, setShowAddStation] = useState(false);
  const [stationName, setStationName]       = useState("");
  const [targetMins, setTargetMins]         = useState("5");
  const [addingStation, setAddingStation]   = useState(false);
  const [stationError, setStationError]     = useState("");

  const [dragIndex, setDragIndex]         = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  /* ── Batch creation ─────────────────────────────────────── */
  const [view, setView]                   = useState<View>("lines");
  const [batchLines, setBatchLines]       = useState<Line[]>([]);
  const [selectedLineId, setSelectedLineId] = useState("");
  const [firstStation, setFirstStation]   = useState("");
  const [batchRef, setBatchRef]           = useState("");
  const [numParts, setNumParts]           = useState(50);
  const [submitting, setSubmitting]       = useState(false);
  const [batchError, setBatchError]       = useState("");
  const [createdParts, setCreatedParts]   = useState<CreatedPart[] | null>(null);
  const [createdLineName, setCreatedLineName] = useState("");
  const [createdBatchRef, setCreatedBatchRef] = useState("");
  const [createdFirstStation, setCreatedFirstStation] = useState("");

  useEffect(() => { loadLines(); }, []);

  /* ── Data loading ───────────────────────────────────────── */
  async function loadLines() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from("profiles").select("tenant_id").eq("id", user.id).single();

    if (profile?.tenant_id) {
      setTenantId(profile.tenant_id);
      setSetupIncomplete(false);
    } else {
      setSetupUserId(user.id);
      setSetupUserName(user.user_metadata?.full_name ?? user.email ?? "");
      setSetupIncomplete(true);
      setLines(MOCK_LINES);
      setBatchLines(MOCK_LINES);
      setIsDemo(true);
      setLoading(false);
      return;
    }

    const { data: linesData, error } = await supabase
      .from("production_lines").select("*").order("created_at", { ascending: true });

    if (error || !linesData || linesData.length === 0) {
      setLines(MOCK_LINES);
      setBatchLines(MOCK_LINES);
      setIsDemo(true);
      setLoading(false);
      return;
    }

    const { data: countRows } = await supabase.from("line_stations").select("line_id");
    const counts: Record<string, number> = {};
    (countRows ?? []).forEach((r: { line_id: string }) => {
      counts[r.line_id] = (counts[r.line_id] ?? 0) + 1;
    });

    const mapped = (linesData as Line[]).map((l) => ({ ...l, stationCount: counts[l.id] ?? 0 }));
    setLines(mapped);
    setBatchLines(mapped);
    setIsDemo(false);
    setLoading(false);
  }

  async function nextBatchRef() {
    const year = new Date().getFullYear();
    const { data } = await supabase.from("parts").select("batch_ref").like("batch_ref", `BATCH-${year}-%`);
    const count = new Set((data ?? []).map((r: { batch_ref: string }) => r.batch_ref)).size;
    return `BATCH-${year}-${pad(count + 1, 4)}`;
  }

  /* ── Setup incomplete ───────────────────────────────────── */
  async function handleCompleteSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!setupFactoryName.trim()) return;
    setSetupError("");
    setSettingUp(true);
    const res = await apiPublicFetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: setupUserId, factoryName: setupFactoryName.trim(), fullName: setupUserName }),
    });
    if (!res.ok) {
      const body = await res.json();
      setSetupError(body.error ?? "Setup failed. Try again.");
      setSettingUp(false);
      return;
    }
    await loadLines();
  }

  /* ── Lines CRUD ─────────────────────────────────────────── */
  async function handleSelectLine(line: Line) {
    setSelectedLine(line);
    setShowAddStation(false);
    setStationError("");
    if (isDemo) { setStations(MOCK_STATIONS[line.id] ?? []); return; }
    setStationsLoading(true);
    const { data } = await supabase
      .from("line_stations").select("*")
      .eq("line_id", line.id).order("sequence_order", { ascending: true });
    setStations((data as LineStation[]) ?? []);
    setStationsLoading(false);
  }

  async function handleAddLine(e: React.FormEvent) {
    e.preventDefault();
    if (!lineName.trim()) return;
    if (!tenantId) { setLineError("Account setup is incomplete — complete setup first."); return; }
    setLineError("");
    setAddingLine(true);
    const { data, error } = await supabase
      .from("production_lines")
      .insert({ tenant_id: tenantId, name: lineName.trim(), description: lineDesc.trim() || null })
      .select().single();
    setAddingLine(false);
    if (error) { setLineError(error.message); return; }
    const newLine = { ...(data as Line), stationCount: 0 };
    setLines((prev) => [...prev.filter((l) => !l.id.startsWith("mock")), newLine]);
    setBatchLines((prev) => [...prev.filter((l) => !l.id.startsWith("mock")), newLine]);
    setIsDemo(false);
    setLineName("");
    setLineDesc("");
    setShowAddLine(false);
  }

  async function handleAddStation(e: React.FormEvent) {
    e.preventDefault();
    if (!stationName.trim() || !selectedLine) return;
    if (!tenantId) { setStationError("Account setup is incomplete."); return; }
    setStationError("");
    setAddingStation(true);
    const { data, error } = await supabase
      .from("line_stations")
      .insert({
        tenant_id: tenantId,
        line_id: selectedLine.id,
        station_name: stationName.trim(),
        target_mins: Math.max(1, parseInt(targetMins, 10) || 5),
        sequence_order: stations.length,
      })
      .select().single();
    setAddingStation(false);
    if (error) { setStationError(error.message); return; }
    setStations((prev) => [...prev, data as LineStation]);
    setLines((prev) => prev.map((l) => l.id === selectedLine.id ? { ...l, stationCount: (l.stationCount ?? 0) + 1 } : l));
    setStationName("");
    setTargetMins("5");
    setShowAddStation(false);
  }

  async function handleDeleteStation(stationId: string) {
    if (isDemo) return;
    setStations((prev) => prev.filter((s) => s.id !== stationId));
    setLines((prev) => prev.map((l) => l.id === selectedLine?.id ? { ...l, stationCount: Math.max(0, (l.stationCount ?? 1) - 1) } : l));
    await supabase.from("line_stations").delete().eq("id", stationId);
    if (selectedLine) {
      const { data } = await supabase.from("line_stations").select("*")
        .eq("line_id", selectedLine.id).order("sequence_order", { ascending: true });
      if (data) setStations(data as LineStation[]);
    }
  }

  async function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); setDragOverIndex(null); return; }
    const reordered = [...stations];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const updated = reordered.map((s, i) => ({ ...s, sequence_order: i }));
    setStations(updated);
    setDragIndex(null); setDragOverIndex(null);
    if (!isDemo) {
      await Promise.all(updated.map((s) => supabase.from("line_stations").update({ sequence_order: s.sequence_order }).eq("id", s.id)));
    }
  }

  /* ── Batch creation ─────────────────────────────────────── */
  async function openBatchView() {
    const ref = await nextBatchRef();
    setBatchRef(ref);
    setSelectedLineId("");
    setFirstStation("");
    setNumParts(50);
    setBatchError("");
    setCreatedParts(null);
    setView("batch");
  }

  async function handleBatchLineChange(lineId: string) {
    setSelectedLineId(lineId);
    setFirstStation("");
    if (!lineId) return;
    const { data } = await supabase
      .from("line_stations").select("station_name")
      .eq("line_id", lineId).order("sequence_order", { ascending: true }).limit(1).single();
    setFirstStation(data?.station_name ?? "");
  }

  async function handleBatchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLineId || !batchRef || numParts < 1) return;
    setBatchError("");
    setSubmitting(true);
    const line = batchLines.find((l) => l.id === selectedLineId)!;
    const lineSlug  = slugify(line.name);
    const batchSlug = batchRef.toLowerCase();
    const rows = Array.from({ length: numParts }, (_, i) => ({
      tenant_id:       tenantId,
      line_id:         selectedLineId,
      batch_ref:       batchRef,
      qr_code:         `${lineSlug}-${batchSlug}-${pad(i + 1, 3)}`,
      current_status:  "wip",
      current_station: firstStation,
    }));
    const { data, error: insertError } = await supabase.from("parts").insert(rows).select("id, qr_code");
    setSubmitting(false);
    if (insertError) { setBatchError(insertError.message); return; }
    setCreatedParts(data as CreatedPart[]);
    setCreatedLineName(line.name);
    setCreatedBatchRef(batchRef);
    setCreatedFirstStation(firstStation);
    setView("printed");
  }

  async function handleBatchReset() {
    setCreatedParts(null);
    setSelectedLineId("");
    setFirstStation("");
    setNumParts(50);
    setBatchError("");
    setBatchRef(await nextBatchRef());
    setView("batch");
  }

  /* ── Render ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
      </div>
    );
  }

  /* Printed QR sheet */
  if (view === "printed" && createdParts) {
    return (
      <>
        <style>{`
          @media print {
            nav, .no-print { display: none !important; }
            body { background: white !important; }
            .qr-grid { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 12px !important; padding: 16px !important; }
            .qr-card { border: 1px solid #d1d5db !important; border-radius: 8px !important; padding: 10px !important; break-inside: avoid !important; background: white !important; }
            .qr-card * { color: #111827 !important; }
          }
        `}</style>
        <div>
          <div className="no-print flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-[#4ade80]/10">
                <CheckCircle2 size={18} style={{ color: "#4ade80" }} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>{createdParts.length} parts created</h2>
                <p className="text-sm mt-0.5 font-mono" style={{ color: "var(--muted)" }}>
                  {createdBatchRef} · {createdLineName}{createdFirstStation && ` · starting at ${createdFirstStation}`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleBatchReset}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                style={{ color: "var(--text)", backgroundColor: "var(--surface2)", border: "1px solid var(--border)" }}>
                <RotateCcw size={14} /> New Batch
              </button>
              <button onClick={() => setView("lines")}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                style={{ color: "var(--text)", backgroundColor: "var(--surface2)", border: "1px solid var(--border)" }}>
                Back to Lines
              </button>
              <button onClick={() => window.print()}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-500">
                <Printer size={16} /> Print All Labels
              </button>
            </div>
          </div>
          <div className="qr-grid grid grid-cols-5 gap-3">
            {createdParts.map((part, i) => (
              <div key={part.id} className="qr-card rounded-xl border p-3.5 flex flex-col items-center gap-2"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="w-full flex items-center gap-1 mb-0.5">
                  <Factory size={10} style={{ color: "var(--muted)" }} className="shrink-0" />
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)", fontSize: 9 }}>Line Pulse</span>
                </div>
                <QRCodeSVG value={`${APP_URL}/scan/${part.id}`} size={100} level="M" includeMargin={false} bgColor="#222220" fgColor="#f0ede8" />
                <div className="w-full text-center">
                  <p className="text-xs font-mono font-semibold truncate" style={{ color: "var(--text)" }}>{createdBatchRef}</p>
                  <p className="truncate font-mono" style={{ fontSize: 10, color: "var(--muted)" }}>{part.qr_code}</p>
                  <p className="font-mono mt-0.5" style={{ fontSize: 9, color: "var(--subtle)" }}>#{pad(i + 1, 3)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  /* New batch form */
  if (view === "batch") {
    return (
      <div className="max-w-[480px]">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView("lines")} className="text-sm transition-colors" style={{ color: "var(--muted)" }}>
            ← Lines
          </button>
          <span style={{ color: "var(--border)" }}>/</span>
          <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>New Batch</h2>
        </div>
        <div className="rounded-xl border p-6" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <form onSubmit={handleBatchSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text)" }}>Production line *</label>
              {batchLines.length === 0 ? (
                <p className="text-sm rounded-lg px-3 py-2.5" style={{ color: "#fbbf24", backgroundColor: "#1f1500", border: "1px solid #5c3d00" }}>
                  No lines set up yet. Create a line first.
                </p>
              ) : (
                <select value={selectedLineId} onChange={(e) => handleBatchLineChange(e.target.value)} required className="input">
                  <option value="">Select a line…</option>
                  {batchLines.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}{l.description ? ` — ${l.description}` : ""}</option>
                  ))}
                </select>
              )}
            </div>
            {firstStation && (
              <div className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm" style={{ backgroundColor: "var(--surface2)" }}>
                <span style={{ color: "var(--muted)" }}>Parts start at</span>
                <span className="font-semibold" style={{ color: "var(--text)" }}>{firstStation}</span>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text)" }}>Batch reference</label>
              <input type="text" value={batchRef} readOnly className="input font-mono cursor-default" style={{ color: "var(--muted)" }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text)" }}>Number of parts *</label>
              <input type="number" value={numParts}
                onChange={(e) => setNumParts(Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)))}
                min={1} max={500} required className="input" />
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Max 500 per batch</p>
            </div>
            {batchError && (
              <p className="text-sm rounded-lg px-3 py-2 flex items-center gap-1.5" style={{ color: "#f87171", backgroundColor: "#1a0000", border: "1px solid #f8717133" }}>
                <AlertCircle size={14} className="shrink-0" /> {batchError}
              </p>
            )}
            <button type="submit" disabled={submitting || batchLines.length === 0 || !tenantId}
              className="w-full font-semibold py-3 rounded-lg transition-colors disabled:opacity-60 text-sm bg-blue-600 text-white hover:bg-blue-500">
              {submitting ? `Creating ${numParts} parts…` : `Create ${numParts} parts`}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* Lines management (default view) */
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>Production Lines</h2>
              {isDemo && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: "#fbbf24", backgroundColor: "#fbbf2415", border: "1px solid #fbbf2430" }}>
                  Demo data
                </span>
              )}
            </div>
            <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>Configure lines and stations, then create batches</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openBatchView}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-500">
            New Batch →
          </button>
          <button onClick={() => { setShowAddLine(true); setLineError(""); }}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}>
            <Plus size={15} /> Add Line
          </button>
        </div>
      </div>

      {/* Incomplete setup banner */}
      {setupIncomplete && (
        <div className="rounded-xl border p-5 mb-5" style={{ backgroundColor: "var(--surface)", borderColor: "#fbbf2430" }}>
          <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--text)" }}>One more step — name your factory</p>
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>Your account exists but your factory workspace hasn&apos;t been created yet.</p>
          <form onSubmit={handleCompleteSetup} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text)" }}>Factory name *</label>
              <input type="text" value={setupFactoryName} onChange={(e) => setSetupFactoryName(e.target.value)}
                placeholder="e.g. Precision Electronics GmbH" required autoFocus className="input" />
            </div>
            <div className="pb-px">
              <button type="submit" disabled={settingUp}
                className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                style={{ backgroundColor: "#2563eb", color: "#ffffff" }}>
                {settingUp ? "Setting up..." : "Complete setup"}
              </button>
            </div>
          </form>
          {setupError && (
            <p className="text-xs flex items-center gap-1.5 mt-2" style={{ color: "#f87171" }}>
              <AlertCircle size={12} /> {setupError}
            </p>
          )}
        </div>
      )}

      {/* Add-line form */}
      {showAddLine && (
        <div className="rounded-xl border p-5 mb-5" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>New production line</h3>
          <form onSubmit={handleAddLine} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text)" }}>Line name *</label>
                <input type="text" value={lineName} onChange={(e) => setLineName(e.target.value)}
                  placeholder="e.g. Line A" required autoFocus className="input" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text)" }}>Description</label>
                <input type="text" value={lineDesc} onChange={(e) => setLineDesc(e.target.value)}
                  placeholder="e.g. PCB Assembly" className="input" />
              </div>
            </div>
            {lineError && (
              <p className="text-xs flex items-center gap-1.5" style={{ color: "#f87171" }}>
                <AlertCircle size={12} /> {lineError}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={addingLine}
                className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                style={{ backgroundColor: "#2563eb", color: "#ffffff" }}>
                {addingLine ? "Saving..." : "Save line"}
              </button>
              <button type="button"
                onClick={() => { setShowAddLine(false); setLineName(""); setLineDesc(""); setLineError(""); }}
                className="text-sm px-4 py-2 rounded-lg" style={{ color: "var(--muted)" }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Two-panel layout */}
      <div className="flex gap-5 items-start">
        {/* Left — lines list */}
        <div className="w-64 shrink-0">
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                {lines.length} {lines.length === 1 ? "line" : "lines"}
              </span>
            </div>
            {lines.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--muted)" }}>No lines yet. Add your first line above.</p>
            ) : (
              <ul>
                {lines.map((line, i) => {
                  const active = selectedLine?.id === line.id;
                  return (
                    <li key={line.id}>
                      <button onClick={() => handleSelectLine(line)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
                        style={{
                          borderBottom: i < lines.length - 1 ? "1px solid var(--border)" : undefined,
                          backgroundColor: active ? "#2e2e2b" : undefined,
                        }}
                        onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#2e2e2b"; }}
                        onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = ""; }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{line.name}</p>
                          {line.description && <p className="text-xs truncate mt-0.5" style={{ color: "var(--muted)" }}>{line.description}</p>}
                          <p className="text-xs mt-1 font-mono" style={{ color: "var(--muted)" }}>
                            {line.stationCount ?? 0} stations · {new Date(line.created_at).toLocaleDateString("en-GB")}
                          </p>
                        </div>
                        <ChevronRight size={14} className="shrink-0" style={{ color: active ? "#7a7870" : "var(--border)" }} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right — stations panel */}
        <div className="flex-1 min-w-0">
          {!selectedLine ? (
            <div className="rounded-xl border flex items-center justify-center"
              style={{ minHeight: 200, backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--muted)" }}>← Select a line to view its stations</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                <div>
                  <h3 className="font-semibold" style={{ color: "var(--text)" }}>{selectedLine.name}</h3>
                  {selectedLine.description && <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{selectedLine.description}</p>}
                </div>
                {!isDemo && (
                  <button onClick={() => { setShowAddStation(true); setStationError(""); }}
                    className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: "var(--text)", backgroundColor: "var(--border)" }}>
                    <Plus size={14} /> Add Station
                  </button>
                )}
              </div>

              {stationsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={18} className="animate-spin" style={{ color: "var(--muted)" }} />
                </div>
              ) : (
                <>
                  {stations.length > 0 && (
                    <div className="grid grid-cols-[2rem_2rem_1fr_8rem_2.5rem] gap-3 px-5 py-2 border-b"
                      style={{ backgroundColor: "var(--surface2)", borderColor: "var(--border)" }}>
                      <div /><div className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>#</div>
                      <div className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>Station</div>
                      <div className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>Target</div>
                      <div />
                    </div>
                  )}
                  {stations.length === 0 && !showAddStation && (
                    <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--muted)" }}>
                      No stations yet.{!isDemo && " Add the first step for this line."}
                    </p>
                  )}
                  {stations.map((station, i) => (
                    <div key={station.id} draggable={!isDemo}
                      onDragStart={() => setDragIndex(i)}
                      onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i); }}
                      onDrop={() => handleDrop(i)}
                      onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                      className="grid grid-cols-[2rem_2rem_1fr_8rem_2.5rem] gap-3 items-center px-5 py-3 border-b last:border-0 select-none transition-colors"
                      style={{
                        borderColor: "var(--border)",
                        backgroundColor: dragOverIndex === i && dragIndex !== i ? "#60a5fa15" : dragIndex === i ? "#1a1916" : undefined,
                        opacity: dragIndex === i ? 0.4 : 1,
                      }}>
                      <div className={`flex items-center justify-center ${!isDemo ? "cursor-grab active:cursor-grabbing" : ""}`} style={{ color: "var(--border)" }}>
                        <GripVertical size={16} />
                      </div>
                      <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>{i + 1}</span>
                      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{station.station_name}</span>
                      <span className="text-sm font-mono" style={{ color: "var(--muted)" }}>{station.target_mins} min</span>
                      <button onClick={() => handleDeleteStation(station.id)} disabled={isDemo}
                        className="flex items-center justify-center transition-colors disabled:opacity-0"
                        style={{ color: "var(--border)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#3a3a35")}
                        title="Delete station">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {showAddStation && (
                    <div className="px-5 py-4 border-t" style={{ backgroundColor: "var(--surface2)", borderColor: "var(--border)" }}>
                      <form onSubmit={handleAddStation} className="flex items-end gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text)" }}>Station name *</label>
                          <input type="text" value={stationName} onChange={(e) => setStationName(e.target.value)}
                            placeholder="e.g. Visual Inspection" required autoFocus className="input" />
                        </div>
                        <div className="w-28">
                          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text)" }}>Target mins</label>
                          <input type="number" value={targetMins} onChange={(e) => setTargetMins(e.target.value)} min={1} className="input" />
                        </div>
                        <div className="flex gap-2 pb-px">
                          <button type="submit" disabled={addingStation}
                            className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                            style={{ backgroundColor: "#2563eb", color: "#ffffff" }}>
                            {addingStation ? "Adding..." : "Add"}
                          </button>
                          <button type="button"
                            onClick={() => { setShowAddStation(false); setStationName(""); setTargetMins("5"); setStationError(""); }}
                            className="text-sm px-3 py-2 rounded-lg" style={{ color: "var(--muted)" }}>
                            Cancel
                          </button>
                        </div>
                      </form>
                      {stationError && (
                        <p className="text-xs flex items-center gap-1.5 mt-2" style={{ color: "#f87171" }}>
                          <AlertCircle size={12} /> {stationError}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
