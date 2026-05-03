"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Printer, RotateCcw, AlertCircle, Loader2, Factory } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Line = { id: string; name: string; description: string | null };
type CreatedPart = { id: string; qr_code: string };

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function pad(n: number, width: number) {
  return String(n).padStart(width, "0");
}

const APP_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");

export default function NewBatchPage() {
  const supabase = createClient();

  const [tenantId, setTenantId]     = useState("");
  const [lines, setLines]           = useState<Line[]>([]);
  const [loading, setLoading]       = useState(true);

  const [selectedLineId, setSelectedLineId] = useState("");
  const [firstStation, setFirstStation]     = useState("");
  const [batchRef, setBatchRef]             = useState("");
  const [numParts, setNumParts]             = useState(50);
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState("");

  const [createdParts, setCreatedParts]       = useState<CreatedPart[] | null>(null);
  const [createdLineName, setCreatedLineName] = useState("");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from("profiles").select("tenant_id").eq("id", user.id).single();

    if (profile?.tenant_id) setTenantId(profile.tenant_id);

    const { data: linesData } = await supabase
      .from("production_lines").select("id, name, description").order("created_at", { ascending: true });

    setLines((linesData as Line[]) ?? []);
    setBatchRef(await nextBatchRef());
    setLoading(false);
  }

  async function nextBatchRef() {
    const year = new Date().getFullYear();
    const { data } = await supabase.from("parts").select("batch_ref").like("batch_ref", `BATCH-${year}-%`);
    const count = new Set((data ?? []).map((r: { batch_ref: string }) => r.batch_ref)).size;
    return `BATCH-${year}-${pad(count + 1, 4)}`;
  }

  async function handleLineChange(lineId: string) {
    setSelectedLineId(lineId);
    setFirstStation("");
    if (!lineId) return;

    const { data } = await supabase
      .from("line_stations").select("station_name")
      .eq("line_id", lineId).order("sequence_order", { ascending: true }).limit(1).single();

    setFirstStation(data?.station_name ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLineId || !batchRef || numParts < 1) return;
    setError("");
    setSubmitting(true);

    const line = lines.find((l) => l.id === selectedLineId)!;
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

    const { data, error: insertError } = await supabase
      .from("parts").insert(rows).select("id, qr_code");

    setSubmitting(false);
    if (insertError) { setError(insertError.message); return; }
    setCreatedParts(data as CreatedPart[]);
    setCreatedLineName(line.name);
  }

  async function handleReset() {
    setCreatedParts(null);
    setSelectedLineId("");
    setFirstStation("");
    setNumParts(50);
    setError("");
    setBatchRef(await nextBatchRef());
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#1a1916" }}>
        <Loader2 size={20} className="animate-spin" style={{ color: "#7a7870" }} />
      </div>
    );
  }

  if (createdParts) {
    return (
      <>
        <style>{`
          @media print {
            nav, .no-print { display: none !important; }
            body { background: white !important; }
            .qr-grid {
              display: grid !important;
              grid-template-columns: repeat(4, 1fr) !important;
              gap: 12px !important;
              padding: 16px !important;
            }
            .qr-card {
              border: 1px solid #d1d5db !important;
              border-radius: 8px !important;
              padding: 10px !important;
              break-inside: avoid !important;
              page-break-inside: avoid !important;
              background: white !important;
            }
            .qr-card * { color: #111827 !important; }
          }
        `}</style>

        <div className="min-h-screen" style={{ backgroundColor: "#1a1916" }}>
          <div className="max-w-[1200px] mx-auto px-6 py-6">

            <div className="no-print flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-[#4ade80]/10">
                  <CheckCircle2 size={18} style={{ color: "#4ade80" }} />
                </div>
                <div>
                  <h1 className="text-xl font-bold" style={{ color: "#f0ede8" }}>
                    {createdParts.length} parts created
                  </h1>
                  <p className="text-sm mt-0.5 font-mono" style={{ color: "#7a7870" }}>
                    {batchRef} · {createdLineName}
                    {firstStation && ` · starting at ${firstStation}`}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  style={{ color: "#f0ede8", backgroundColor: "#2e2e2b", border: "1px solid #3a3a35" }}
                >
                  <RotateCcw size={14} />
                  New Batch
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-500"
                >
                  <Printer size={16} />
                  Print All Labels
                </button>
              </div>
            </div>

            <div className="qr-grid grid grid-cols-5 gap-3">
              {createdParts.map((part, i) => (
                <div
                  key={part.id}
                  className="qr-card rounded-xl border p-3.5 flex flex-col items-center gap-2"
                  style={{ backgroundColor: "#222220", borderColor: "#3a3a35" }}
                >
                  <div className="w-full flex items-center gap-1 mb-0.5">
                    <Factory size={10} style={{ color: "#7a7870" }} className="shrink-0" />
                    <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#7a7870", fontSize: 9 }}>
                      Line Pulse
                    </span>
                  </div>

                  <QRCodeSVG
                    value={`${APP_URL}/scan/${part.id}`}
                    size={100}
                    level="M"
                    includeMargin={false}
                    bgColor="#222220"
                    fgColor="#f0ede8"
                  />

                  <div className="w-full text-center">
                    <p className="text-xs font-mono font-semibold truncate" style={{ color: "#f0ede8" }}>
                      {batchRef}
                    </p>
                    <p className="truncate font-mono" style={{ fontSize: 10, color: "#7a7870" }}>
                      {part.qr_code}
                    </p>
                    <p className="font-mono mt-0.5" style={{ fontSize: 9, color: "#4a4a45" }}>
                      #{pad(i + 1, 3)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#1a1916" }}>
      <div className="max-w-[520px] mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: "#f0ede8" }}>New Batch</h1>
          <p className="text-sm mt-0.5" style={{ color: "#7a7870" }}>
            Create a batch of parts entering a production line
          </p>
        </div>

        <div className="rounded-xl border p-6" style={{ backgroundColor: "#222220", borderColor: "#3a3a35" }}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#f0ede8" }}>
                Production line *
              </label>
              {lines.length === 0 ? (
                <p className="text-sm rounded-lg px-3 py-2.5" style={{ color: "#fbbf24", backgroundColor: "#1f1500", border: "1px solid #5c3d00" }}>
                  No lines set up yet.{" "}
                  <a href="/dashboard/settings/lines" className="font-semibold underline">
                    Create a line first →
                  </a>
                </p>
              ) : (
                <select
                  value={selectedLineId}
                  onChange={(e) => handleLineChange(e.target.value)}
                  required
                  className="input"
                >
                  <option value="">Select a line…</option>
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}{l.description ? ` — ${l.description}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {firstStation && (
              <div className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm" style={{ backgroundColor: "#2e2e2b" }}>
                <span style={{ color: "#7a7870" }}>Parts start at</span>
                <span className="font-semibold" style={{ color: "#f0ede8" }}>{firstStation}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#f0ede8" }}>
                Batch reference
              </label>
              <input
                type="text"
                value={batchRef}
                readOnly
                className="input font-mono cursor-default"
                style={{ color: "#7a7870" }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#f0ede8" }}>
                Number of parts *
              </label>
              <input
                type="number"
                value={numParts}
                onChange={(e) => setNumParts(Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)))}
                min={1}
                max={500}
                required
                className="input"
              />
              <p className="text-xs mt-1" style={{ color: "#7a7870" }}>Max 500 per batch</p>
            </div>

            {error && (
              <p className="text-sm rounded-lg px-3 py-2 flex items-center gap-1.5" style={{ color: "#f87171", backgroundColor: "#f87171/10", border: "1px solid #f8717133" }}>
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || lines.length === 0 || !tenantId}
              className="w-full font-semibold py-3 rounded-lg transition-colors disabled:opacity-60 text-sm bg-blue-600 text-white hover:bg-blue-500"
            >
              {submitting ? `Creating ${numParts} parts…` : `Create ${numParts} parts`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
