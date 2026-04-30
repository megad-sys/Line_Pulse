"use client";

import { useState, useEffect } from "react";
import { Plus, GripVertical, Trash2, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────

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

// ── Mock data (shown when production_lines table is empty) ────

const MOCK_LINES: Line[] = [
  { id: "mock-1", tenant_id: "mock", name: "Line A", description: "PCB Assembly",    created_at: new Date().toISOString(), stationCount: 5 },
  { id: "mock-2", tenant_id: "mock", name: "Line B", description: "Final Assembly",  created_at: new Date().toISOString(), stationCount: 3 },
];

const MOCK_STATIONS: Record<string, LineStation[]> = {
  "mock-1": [
    { id: "ms-1", tenant_id: "mock", line_id: "mock-1", station_name: "SMT",               target_mins: 5, sequence_order: 0 },
    { id: "ms-2", tenant_id: "mock", line_id: "mock-1", station_name: "Soldering",          target_mins: 6, sequence_order: 1 },
    { id: "ms-3", tenant_id: "mock", line_id: "mock-1", station_name: "Visual Inspection",  target_mins: 7, sequence_order: 2 },
    { id: "ms-4", tenant_id: "mock", line_id: "mock-1", station_name: "Functional Test",    target_mins: 8, sequence_order: 3 },
    { id: "ms-5", tenant_id: "mock", line_id: "mock-1", station_name: "Packaging",          target_mins: 4, sequence_order: 4 },
  ],
  "mock-2": [
    { id: "ms-6", tenant_id: "mock", line_id: "mock-2", station_name: "Sub-Assembly",   target_mins: 10, sequence_order: 0 },
    { id: "ms-7", tenant_id: "mock", line_id: "mock-2", station_name: "Final Assembly", target_mins: 12, sequence_order: 1 },
    { id: "ms-8", tenant_id: "mock", line_id: "mock-2", station_name: "QC Check",       target_mins:  6, sequence_order: 2 },
  ],
};

// ── Component ─────────────────────────────────────────────────

export default function LinesPage() {
  const supabase = createClient();

  const [lines, setLines]               = useState<Line[]>([]);
  const [selectedLine, setSelectedLine] = useState<Line | null>(null);
  const [stations, setStations]         = useState<LineStation[]>([]);
  const [loading, setLoading]           = useState(true);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [isDemo, setIsDemo]             = useState(false);
  const [tenantId, setTenantId]         = useState("");
  const [setupIncomplete, setSetupIncomplete] = useState(false);
  const [setupUserId, setSetupUserId]         = useState("");
  const [setupUserName, setSetupUserName]     = useState("");
  const [setupFactoryName, setSetupFactoryName] = useState("");
  const [settingUp, setSettingUp]             = useState(false);
  const [setupError, setSetupError]           = useState("");

  // Add-line form
  const [showAddLine, setShowAddLine] = useState(false);
  const [lineName, setLineName]       = useState("");
  const [lineDesc, setLineDesc]       = useState("");
  const [addingLine, setAddingLine]   = useState(false);
  const [lineError, setLineError]     = useState("");

  // Add-station form
  const [showAddStation, setShowAddStation] = useState(false);
  const [stationName, setStationName]       = useState("");
  const [targetMins, setTargetMins]         = useState("5");
  const [addingStation, setAddingStation]   = useState(false);
  const [stationError, setStationError]     = useState("");

  // Drag state
  const [dragIndex, setDragIndex]         = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // ── Initial load ──────────────────────────────────────────

  useEffect(() => { loadLines(); }, []);

  async function loadLines() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profile?.tenant_id) {
      setTenantId(profile.tenant_id);
      setSetupIncomplete(false);
    } else {
      setSetupUserId(user.id);
      setSetupUserName(user.user_metadata?.full_name ?? user.email ?? "");
      setSetupIncomplete(true);
      setLines(MOCK_LINES);
      setIsDemo(true);
      setLoading(false);
      return;
    }

    const { data: linesData, error } = await supabase
      .from("production_lines")
      .select("*")
      .order("created_at", { ascending: true });

    if (error || !linesData || linesData.length === 0) {
      setLines(MOCK_LINES);
      setIsDemo(true);
      setLoading(false);
      return;
    }

    // Fetch station counts for all lines in one query
    const { data: countRows } = await supabase
      .from("line_stations")
      .select("line_id");

    const counts: Record<string, number> = {};
    (countRows ?? []).forEach((r: { line_id: string }) => {
      counts[r.line_id] = (counts[r.line_id] ?? 0) + 1;
    });

    setLines(
      (linesData as Line[]).map((l) => ({ ...l, stationCount: counts[l.id] ?? 0 }))
    );
    setIsDemo(false);
    setLoading(false);
  }

  // ── Complete account setup (missing tenant / profile) ────

  async function handleCompleteSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!setupFactoryName.trim()) return;
    setSetupError("");
    setSettingUp(true);

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: setupUserId,
        factoryName: setupFactoryName.trim(),
        fullName: setupUserName,
      }),
    });

    if (!res.ok) {
      const body = await res.json();
      setSetupError(body.error ?? "Setup failed. Try again.");
      setSettingUp(false);
      return;
    }

    // Reload — now the profile + tenant exist
    await loadLines();
  }

  // ── Select a line → load its stations ────────────────────

  async function handleSelectLine(line: Line) {
    setSelectedLine(line);
    setShowAddStation(false);
    setStationError("");

    if (isDemo) {
      setStations(MOCK_STATIONS[line.id] ?? []);
      return;
    }

    setStationsLoading(true);
    const { data } = await supabase
      .from("line_stations")
      .select("*")
      .eq("line_id", line.id)
      .order("sequence_order", { ascending: true });

    setStations((data as LineStation[]) ?? []);
    setStationsLoading(false);
  }

  // ── Add line ──────────────────────────────────────────────

  async function handleAddLine(e: React.FormEvent) {
    e.preventDefault();
    if (!lineName.trim()) return;
    if (!tenantId) { setLineError("Account setup is incomplete — sign out and sign up again."); return; }
    setLineError("");
    setAddingLine(true);

    const { data, error } = await supabase
      .from("production_lines")
      .insert({ tenant_id: tenantId, name: lineName.trim(), description: lineDesc.trim() || null })
      .select()
      .single();

    setAddingLine(false);

    if (error) { setLineError(error.message); return; }

    const newLine: Line = { ...(data as Line), stationCount: 0 };
    setLines((prev) => [...prev.filter((l) => !l.id.startsWith("mock")), newLine]);
    setIsDemo(false);
    setLineName("");
    setLineDesc("");
    setShowAddLine(false);
  }

  // ── Add station ───────────────────────────────────────────

  async function handleAddStation(e: React.FormEvent) {
    e.preventDefault();
    if (!stationName.trim() || !selectedLine) return;
    if (!tenantId) { setStationError("Account setup is incomplete — sign out and sign up again."); return; }
    setStationError("");
    setAddingStation(true);

    const nextOrder = stations.length;
    const { data, error } = await supabase
      .from("line_stations")
      .insert({
        tenant_id: tenantId,
        line_id: selectedLine.id,
        station_name: stationName.trim(),
        target_mins: Math.max(1, parseInt(targetMins, 10) || 5),
        sequence_order: nextOrder,
      })
      .select()
      .single();

    setAddingStation(false);

    if (error) { setStationError(error.message); return; }

    setStations((prev) => [...prev, data as LineStation]);
    setLines((prev) =>
      prev.map((l) =>
        l.id === selectedLine.id ? { ...l, stationCount: (l.stationCount ?? 0) + 1 } : l
      )
    );
    setStationName("");
    setTargetMins("5");
    setShowAddStation(false);
  }

  // ── Delete station ────────────────────────────────────────

  async function handleDeleteStation(stationId: string) {
    if (isDemo) return;

    setStations((prev) => prev.filter((s) => s.id !== stationId));
    setLines((prev) =>
      prev.map((l) =>
        l.id === selectedLine?.id ? { ...l, stationCount: Math.max(0, (l.stationCount ?? 1) - 1) } : l
      )
    );

    await supabase.from("line_stations").delete().eq("id", stationId);

    // Re-fetch to keep sequence_order consistent after deletion
    if (selectedLine) {
      const { data } = await supabase
        .from("line_stations")
        .select("*")
        .eq("line_id", selectedLine.id)
        .order("sequence_order", { ascending: true });
      if (data) setStations(data as LineStation[]);
    }
  }

  // ── Drag-and-drop reorder ─────────────────────────────────

  async function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...stations];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const updated = reordered.map((s, i) => ({ ...s, sequence_order: i }));
    setStations(updated);
    setDragIndex(null);
    setDragOverIndex(null);

    if (!isDemo) {
      await Promise.all(
        updated.map((s) =>
          supabase.from("line_stations").update({ sequence_order: s.sequence_order }).eq("id", s.id)
        )
      );
    }
  }

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F7F5F0" }}>
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="max-w-[1200px] mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">Production Lines</h1>
              {isDemo && (
                <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  Demo data
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Configure your production lines and their station sequences
            </p>
          </div>
          <button
            onClick={() => { setShowAddLine(true); setLineError(""); }}
            className="flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus size={16} />
            Add Line
          </button>
        </div>

        {/* Inline setup card — shown when profile has no tenant yet */}
        {setupIncomplete && (
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5 mb-5">
            <p className="text-sm font-semibold text-gray-900 mb-0.5">One more step — name your factory</p>
            <p className="text-sm text-gray-500 mb-4">
              Your account exists but your factory workspace hasn&apos;t been created yet.
            </p>
            <form onSubmit={handleCompleteSetup} className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Factory name *</label>
                <input
                  type="text"
                  value={setupFactoryName}
                  onChange={(e) => setSetupFactoryName(e.target.value)}
                  placeholder="e.g. Precision Electronics GmbH"
                  required
                  autoFocus
                  className="input"
                />
              </div>
              <div className="pb-px">
                <button
                  type="submit"
                  disabled={settingUp}
                  className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60"
                >
                  {settingUp ? "Setting up..." : "Complete setup"}
                </button>
              </div>
            </form>
            {setupError && (
              <p className="text-xs text-red-600 flex items-center gap-1.5 mt-2">
                <AlertCircle size={12} /> {setupError}
              </p>
            )}
          </div>
        )}

        {/* Add-line form */}
        {showAddLine && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">New production line</h2>
            <form onSubmit={handleAddLine} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Line name *</label>
                  <input
                    type="text"
                    value={lineName}
                    onChange={(e) => setLineName(e.target.value)}
                    placeholder="e.g. Line A"
                    required
                    autoFocus
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={lineDesc}
                    onChange={(e) => setLineDesc(e.target.value)}
                    placeholder="e.g. PCB Assembly"
                    className="input"
                  />
                </div>
              </div>
              {lineError && (
                <p className="text-xs text-red-600 flex items-center gap-1.5">
                  <AlertCircle size={12} /> {lineError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={addingLine}
                  className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60"
                >
                  {addingLine ? "Saving..." : "Save line"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddLine(false); setLineName(""); setLineDesc(""); setLineError(""); }}
                  className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Two-panel layout */}
        <div className="flex gap-5 items-start">

          {/* Left — lines list */}
          <div className="w-72 shrink-0">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  {lines.length} {lines.length === 1 ? "line" : "lines"}
                </span>
              </div>

              {lines.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">
                  No lines yet. Add your first line above.
                </p>
              ) : (
                <ul>
                  {lines.map((line, i) => {
                    const active = selectedLine?.id === line.id;
                    return (
                      <li key={line.id}>
                        <button
                          onClick={() => handleSelectLine(line)}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                            i < lines.length - 1 ? "border-b border-gray-50" : ""
                          } ${active ? "bg-gray-50" : "hover:bg-gray-50/60"}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{line.name}</p>
                            {line.description && (
                              <p className="text-xs text-gray-400 truncate mt-0.5">{line.description}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1 font-mono">
                              {line.stationCount ?? 0} stations ·{" "}
                              {new Date(line.created_at).toLocaleDateString("en-GB")}
                            </p>
                          </div>
                          <ChevronRight
                            size={14}
                            className={`shrink-0 ${active ? "text-gray-600" : "text-gray-300"}`}
                          />
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
              <div
                className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center"
                style={{ minHeight: 200 }}
              >
                <p className="text-sm text-gray-400">← Select a line to view its stations</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

                {/* Panel header */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedLine.name}</h2>
                    {selectedLine.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{selectedLine.description}</p>
                    )}
                  </div>
                  {!isDemo && (
                    <button
                      onClick={() => { setShowAddStation(true); setStationError(""); }}
                      className="flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors px-3 py-1.5 rounded-lg"
                    >
                      <Plus size={14} />
                      Add Station
                    </button>
                  )}
                </div>

                {stationsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 size={18} className="animate-spin text-gray-400" />
                  </div>
                ) : (
                  <>
                    {/* Column headers */}
                    {stations.length > 0 && (
                      <div className="grid grid-cols-[2rem_2rem_1fr_8rem_2.5rem] gap-3 px-5 py-2 border-b border-gray-50 bg-gray-50/50">
                        <div />
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">#</div>
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Station</div>
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Target</div>
                        <div />
                      </div>
                    )}

                    {/* Station rows */}
                    {stations.length === 0 && !showAddStation && (
                      <p className="px-5 py-8 text-center text-sm text-gray-400">
                        No stations yet.{!isDemo && " Add the first step for this line."}
                      </p>
                    )}

                    {stations.map((station, i) => (
                      <div
                        key={station.id}
                        draggable={!isDemo}
                        onDragStart={() => setDragIndex(i)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i); }}
                        onDrop={() => handleDrop(i)}
                        onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                        className={`grid grid-cols-[2rem_2rem_1fr_8rem_2.5rem] gap-3 items-center px-5 py-3 border-b border-gray-50 last:border-0 select-none transition-colors ${
                          dragOverIndex === i && dragIndex !== i
                            ? "bg-blue-50"
                            : "hover:bg-gray-50/50"
                        } ${dragIndex === i ? "opacity-40" : ""}`}
                      >
                        {/* Drag handle */}
                        <div className={`flex items-center justify-center text-gray-300 ${!isDemo ? "cursor-grab active:cursor-grabbing" : ""}`}>
                          <GripVertical size={16} />
                        </div>

                        {/* Step number */}
                        <span className="text-xs font-mono text-gray-400">{i + 1}</span>

                        {/* Station name */}
                        <span className="text-sm font-medium text-gray-800">{station.station_name}</span>

                        {/* Target */}
                        <span className="text-sm text-gray-500 font-mono">{station.target_mins} min</span>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteStation(station.id)}
                          disabled={isDemo}
                          className="flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors disabled:opacity-0"
                          title="Delete station"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}

                    {/* Add-station form */}
                    {showAddStation && (
                      <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50">
                        <form onSubmit={handleAddStation} className="flex items-end gap-3">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Station name *
                            </label>
                            <input
                              type="text"
                              value={stationName}
                              onChange={(e) => setStationName(e.target.value)}
                              placeholder="e.g. Visual Inspection"
                              required
                              autoFocus
                              className="input"
                            />
                          </div>
                          <div className="w-28">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Target mins
                            </label>
                            <input
                              type="number"
                              value={targetMins}
                              onChange={(e) => setTargetMins(e.target.value)}
                              min={1}
                              className="input"
                            />
                          </div>
                          <div className="flex gap-2 pb-px">
                            <button
                              type="submit"
                              disabled={addingStation}
                              className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-60 transition-colors"
                            >
                              {addingStation ? "Adding..." : "Add"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddStation(false);
                                setStationName("");
                                setTargetMins("5");
                                setStationError("");
                              }}
                              className="text-sm text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                        {stationError && (
                          <p className="text-xs text-red-600 flex items-center gap-1.5 mt-2">
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
    </div>
  );
}
