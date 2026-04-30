"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Printer, RotateCcw, AlertCircle, Loader2, Factory } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────

type Line = { id: string; name: string; description: string | null };
type CreatedPart = { id: string; qr_code: string };

// ── Helpers ───────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────

export default function NewBatchPage() {
  const supabase = createClient();

  // Core data
  const [tenantId, setTenantId]       = useState("");
  const [lines, setLines]             = useState<Line[]>([]);
  const [loading, setLoading]         = useState(true);

  // Form state
  const [selectedLineId, setSelectedLineId] = useState("");
  const [firstStation, setFirstStation]     = useState("");
  const [batchRef, setBatchRef]             = useState("");
  const [numParts, setNumParts]             = useState(50);
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState("");

  // Success state — null = form, array = success screen
  const [createdParts, setCreatedParts]     = useState<CreatedPart[] | null>(null);
  const [createdLineName, setCreatedLineName] = useState("");

  // ── Init ────────────────────────────────────────────────────

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profile?.tenant_id) setTenantId(profile.tenant_id);

    const { data: linesData } = await supabase
      .from("production_lines")
      .select("id, name, description")
      .order("created_at", { ascending: true });

    setLines((linesData as Line[]) ?? []);
    setBatchRef(await nextBatchRef());
    setLoading(false);
  }

  async function nextBatchRef() {
    const year = new Date().getFullYear();
    const { data } = await supabase
      .from("parts")
      .select("batch_ref")
      .like("batch_ref", `BATCH-${year}-%`);

    const count = new Set((data ?? []).map((r: { batch_ref: string }) => r.batch_ref)).size;
    return `BATCH-${year}-${pad(count + 1, 4)}`;
  }

  // ── Line selection ───────────────────────────────────────────

  async function handleLineChange(lineId: string) {
    setSelectedLineId(lineId);
    setFirstStation("");
    if (!lineId) return;

    const { data } = await supabase
      .from("line_stations")
      .select("station_name")
      .eq("line_id", lineId)
      .order("sequence_order", { ascending: true })
      .limit(1)
      .single();

    setFirstStation(data?.station_name ?? "");
  }

  // ── Submit ───────────────────────────────────────────────────

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
      .from("parts")
      .insert(rows)
      .select("id, qr_code");

    setSubmitting(false);

    if (insertError) { setError(insertError.message); return; }

    setCreatedParts(data as CreatedPart[]);
    setCreatedLineName(line.name);
  }

  // ── Reset to form ─────────────────────────────────────────────

  async function handleReset() {
    setCreatedParts(null);
    setSelectedLineId("");
    setFirstStation("");
    setNumParts(50);
    setError("");
    setBatchRef(await nextBatchRef());
  }

  // ── Loading ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F7F5F0" }}>
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Success screen ────────────────────────────────────────────

  if (createdParts) {
    return (
      <>
        {/* Print styles — hides nav/header, formats grid for A4 */}
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
            }
          }
        `}</style>

        <div className="min-h-screen" style={{ backgroundColor: "#F7F5F0" }}>
          <div className="max-w-[1200px] mx-auto px-6 py-6">

            {/* Success header */}
            <div className="no-print flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle2 size={18} className="text-green-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {createdParts.length} parts created
                  </h1>
                  <p className="text-sm text-gray-500 mt-0.5 font-mono">
                    {batchRef} · {createdLineName}
                    {firstStation && ` · starting at ${firstStation}`}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw size={14} />
                  New Batch
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Printer size={16} />
                  Print All Labels
                </button>
              </div>
            </div>

            {/* QR grid */}
            <div className="qr-grid grid grid-cols-5 gap-3">
              {createdParts.map((part, i) => (
                <div
                  key={part.id}
                  className="qr-card bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 flex flex-col items-center gap-2"
                >
                  {/* Label header */}
                  <div className="w-full flex items-center gap-1 mb-0.5">
                    <Factory size={10} className="text-gray-400 shrink-0" />
                    <span className="text-xs font-bold text-gray-400 tracking-widest uppercase" style={{ fontSize: 9 }}>
                      FactoryOS
                    </span>
                  </div>

                  {/* QR code — encodes /scan/{part.id} */}
                  <QRCodeSVG
                    value={`${APP_URL}/scan/${part.id}`}
                    size={100}
                    level="M"
                    includeMargin={false}
                  />

                  {/* Label text */}
                  <div className="w-full text-center">
                    <p className="text-xs font-mono font-semibold text-gray-700 truncate">
                      {batchRef}
                    </p>
                    <p className="text-gray-400 truncate font-mono" style={{ fontSize: 10 }}>
                      {part.qr_code}
                    </p>
                    <p className="text-gray-300 font-mono mt-0.5" style={{ fontSize: 9 }}>
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

  // ── Form ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="max-w-[520px] mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">New Batch</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Create a batch of parts entering a production line
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Production line */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Production line *
              </label>
              {lines.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  No lines set up yet.{" "}
                  <a
                    href="/dashboard/settings/lines"
                    className="font-semibold underline"
                  >
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

            {/* First station hint */}
            {firstStation && (
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
                <span className="text-gray-500">Parts start at</span>
                <span className="font-semibold text-gray-800">{firstStation}</span>
              </div>
            )}

            {/* Batch reference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Batch reference
              </label>
              <input
                type="text"
                value={batchRef}
                readOnly
                className="input bg-gray-50 text-gray-500 cursor-default font-mono"
              />
            </div>

            {/* Number of parts */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Number of parts *
              </label>
              <input
                type="number"
                value={numParts}
                onChange={(e) =>
                  setNumParts(Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)))
                }
                min={1}
                max={500}
                required
                className="input"
              />
              <p className="text-xs text-gray-400 mt-1">Max 500 per batch</p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || lines.length === 0 || !tenantId}
              className="w-full bg-gray-900 text-white font-semibold py-3 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60 text-sm"
            >
              {submitting ? `Creating ${numParts} parts…` : `Create ${numParts} parts`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
