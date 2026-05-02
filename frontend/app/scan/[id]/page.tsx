"use client";

import { useState, useEffect } from "react";
import {
  Factory,
  CheckCircle2,
  Play,
  X,
  Loader2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { apiPublicFetch } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────

type PartScan = {
  type: "part";
  part: {
    id: string;
    qr_code: string;
    batch_ref: string;
    current_station: string;
    current_status: string;
    line_name: string;
  };
  stations: string[];
};

type WorkOrderScan = {
  type: "work_order";
  workOrder: {
    wo_number: string;
    part_number: string;
    customer_name: string;
    planned_qty: number;
    stations: string[];
  };
};

type ScanData = PartScan | WorkOrderScan;

const STATUS_LABELS: Record<string, string> = {
  wip: "In Progress",
  done: "Complete",
  failed_qc: "Failed QC",
  scrapped: "Scrapped",
};

const STATUS_COLORS: Record<string, string> = {
  wip: "text-blue-700 bg-blue-50 border-blue-200",
  done: "text-green-700 bg-green-50 border-green-200",
  failed_qc: "text-red-700 bg-red-50 border-red-200",
  scrapped: "text-gray-600 bg-gray-100 border-gray-200",
};

// ── Demo part constants ────────────────────────────────────────

const DEMO_PART_ID = "demo-part-001";
const DEMO_STATIONS = [
  "SMT Assembly",
  "Soldering",
  "Visual Inspection",
  "Functional Test",
  "Packaging",
];
const DEMO_PART_DATA: PartScan = {
  type: "part",
  part: {
    id: DEMO_PART_ID,
    qr_code: "line-a-demo-001",
    batch_ref: "DEMO-BATCH",
    current_station: "SMT Assembly",
    current_status: "wip",
    line_name: "Line A — PCB Assembly",
  },
  stations: DEMO_STATIONS,
};

// ── Component ──────────────────────────────────────────────────

export default function ScanPage({ params }: { params: { id: string } }) {
  const isDemo = params.id === DEMO_PART_ID;

  const [data, setData]             = useState<ScanData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [nameEntered, setNameEntered]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed]   = useState<string | null>(null);

  const [currentStation, setCurrentStation] = useState("");
  const [currentStatus, setCurrentStatus]   = useState("");
  const [selectedStation, setSelectedStation] = useState("");

  useEffect(() => {
    if (isDemo) {
      setData(DEMO_PART_DATA);
      setCurrentStation(DEMO_PART_DATA.part.current_station);
      setCurrentStatus(DEMO_PART_DATA.part.current_status);
      setLoading(false);
      return;
    }

    apiPublicFetch(`/api/scan/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
        if (d.type === "part") {
          setCurrentStation(d.part.current_station);
          setCurrentStatus(d.part.current_status);
        }
      })
      .catch(() => setError("Could not load scan data."))
      .finally(() => setLoading(false));
  }, [params.id, isDemo]);

  async function handleAction(action: "started" | "completed" | "failed_qc" | "scrapped") {
    if (!data) return;
    const station = data.type === "part" ? currentStation : selectedStation;
    if (!station) return;

    setSubmitting(true);

    // Demo mode: simulate locally, no DB write
    if (isDemo) {
      await new Promise((r) => setTimeout(r, 600));

      if (action === "completed" && data.type === "part") {
        const idx = DEMO_STATIONS.indexOf(currentStation);
        const next = DEMO_STATIONS[idx + 1];
        if (next) {
          setCurrentStation(next);
        } else {
          setCurrentStatus("done");
        }
      } else if (action === "failed_qc") {
        setCurrentStatus("failed_qc");
      } else if (action === "scrapped") {
        setCurrentStatus("scrapped");
      }

      const labels: Record<string, string> = {
        started: "Started",
        completed: "Completed",
        failed_qc: "Failed QC recorded",
        scrapped: "Scrapped",
      };
      setConfirmed(`${labels[action] ?? "Recorded"} — Demo mode, scan not recorded`);
      setTimeout(() => setConfirmed(null), 4000);
      setSubmitting(false);
      return;
    }

    // Live mode: write to DB
    const res = await apiPublicFetch(`/api/scan/${params.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        station_name: station,
        action,
        operator_name: operatorName || undefined,
      }),
    });

    setSubmitting(false);

    if (res.ok) {
      const result = await res.json();
      if (result.newStatus) setCurrentStatus(result.newStatus);
      if (result.newStation) setCurrentStation(result.newStation);
      const labels: Record<string, string> = {
        started: "Started",
        completed: "Completed",
        failed_qc: "Failed QC recorded",
        scrapped: "Scrapped",
      };
      setConfirmed(labels[action] ?? "Recorded");
      setTimeout(() => setConfirmed(null), 3000);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to record scan.");
    }
  }

  // ── Loading ────────────────────────────────────────────────

  if (loading) {
    return (
      <Shell isDemo={isDemo}>
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      </Shell>
    );
  }

  if (error || !data) {
    return (
      <Shell isDemo={isDemo}>
        <div className="px-6 py-8 text-center">
          <AlertCircle size={28} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-800 mb-1">
            This QR code isn&apos;t recognised.
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Ask your supervisor for a new label.
          </p>
        </div>
      </Shell>
    );
  }

  // ── Part scan ──────────────────────────────────────────────

  if (data.type === "part") {
    const { part, stations } = data;
    const isTerminal = currentStatus === "done" || currentStatus === "scrapped";
    const currentIdx = stations.indexOf(currentStation);

    return (
      <Shell isDemo={isDemo}>
        {/* Demo banner */}
        {isDemo && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center">
            <p className="text-xs font-semibold text-amber-700">
              Demo Mode — scans are not recorded
            </p>
          </div>
        )}

        {/* Part info */}
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-3">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs font-mono font-bold text-blue-700">{part.batch_ref}</span>
            <span className={`text-xs border px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[currentStatus] ?? "text-gray-600 bg-gray-100 border-gray-200"}`}>
              {STATUS_LABELS[currentStatus] ?? currentStatus}
            </span>
          </div>
          <p className="text-sm font-bold text-gray-900 font-mono">{part.qr_code}</p>
          <p className="text-xs text-gray-500 mt-0.5">{part.line_name}</p>
        </div>

        {/* Operator name */}
        {!nameEntered && (
          <div className="px-4 py-3 border-b border-gray-100 bg-yellow-50">
            <p className="text-xs text-yellow-700 mb-1.5 font-medium">Enter your name (optional)</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Your name..."
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setNameEntered(true)}
                className="flex-1 text-sm border border-yellow-200 rounded-lg px-3 py-2 bg-white outline-none"
              />
              <button
                onClick={() => setNameEntered(true)}
                className="text-xs font-semibold text-yellow-800 bg-yellow-100 border border-yellow-200 px-3 py-2 rounded-lg"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* Station progress */}
        <div className="px-4 py-4 border-b border-gray-100">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2.5">
            Station Progress
          </p>
          <div className="flex flex-col gap-1">
            {stations.map((s, i) => {
              const isPast    = i < currentIdx;
              const isCurrent = s === currentStation;
              const isFuture  = i > currentIdx;
              return (
                <div
                  key={s}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                    isCurrent ? "bg-blue-50 border border-blue-200" : isPast ? "opacity-40" : "opacity-60"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      isPast ? "bg-green-100 text-green-600" : isCurrent ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {isPast ? "✓" : i + 1}
                  </div>
                  <span className={`text-sm flex-1 ${isCurrent ? "font-bold text-blue-800" : "text-gray-500"}`}>
                    {s}
                  </span>
                  {isCurrent && !isTerminal && <span className="text-xs text-blue-400 font-medium">← here</span>}
                  {isFuture && <span className="text-xs text-gray-300">Step {i + 1}</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-4">
          {confirmed ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <CheckCircle2 size={24} className="text-green-500 mx-auto mb-1.5" />
              <p className="font-bold text-green-800 text-sm leading-snug">{confirmed}</p>
              <p className="text-xs text-green-600 mt-0.5">{new Date().toLocaleTimeString()}</p>
            </div>
          ) : isTerminal ? (
            <div className={`rounded-xl p-4 text-center border ${STATUS_COLORS[currentStatus]}`}>
              <CheckCircle2 size={20} className="mx-auto mb-1.5 opacity-60" />
              <p className="font-bold text-sm">{STATUS_LABELS[currentStatus]}</p>
              <p className="text-xs opacity-70 mt-0.5">No further actions available</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-400 text-center mb-0.5">
                {currentStation} — select action:
              </p>
              <button
                onClick={() => handleAction("started")}
                disabled={submitting}
                className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60"
              >
                <Play size={15} fill="white" />
                Start at {currentStation}
              </button>
              <button
                onClick={() => handleAction("completed")}
                disabled={submitting}
                className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 active:scale-95 transition-all disabled:opacity-60"
              >
                <CheckCircle2 size={15} />
                Complete → advance
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction("failed_qc")}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 active:scale-95 transition-all disabled:opacity-60"
                >
                  <X size={14} />
                  Failed QC
                </button>
                <button
                  onClick={() => handleAction("scrapped")}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-700 text-white rounded-xl font-bold text-sm hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-60"
                >
                  <Trash2 size={14} />
                  Scrap
                </button>
              </div>
            </div>
          )}
        </div>

        {nameEntered && operatorName && (
          <div className="bg-gray-50 px-4 py-2 border-t border-gray-100">
            <p className="text-xs text-center text-gray-400">Operator: {operatorName}</p>
          </div>
        )}
      </Shell>
    );
  }

  // ── Work order fallback ────────────────────────────────────

  const wo = data.workOrder;
  const stations = wo.stations ?? [];

  return (
    <Shell isDemo={false} woNumber={wo.wo_number} partNumber={wo.part_number} customer={wo.customer_name} qty={wo.planned_qty}>
      {!nameEntered && (
        <div className="px-4 py-3 border-b border-gray-100 bg-yellow-50">
          <p className="text-xs text-yellow-700 mb-1.5 font-medium">Enter your name (optional)</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Your name..."
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setNameEntered(true)}
              className="flex-1 text-sm border border-yellow-200 rounded-lg px-3 py-2 bg-white outline-none"
            />
            <button
              onClick={() => setNameEntered(true)}
              className="text-xs font-semibold text-yellow-800 bg-yellow-100 border border-yellow-200 px-3 py-2 rounded-lg"
            >
              OK
            </button>
          </div>
        </div>
      )}
      <div className="px-4 py-4 border-b border-gray-100">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2.5">Select Station</p>
        <div className="flex flex-col gap-1.5">
          {stations.map((station: string, i: number) => {
            const isActive = station === selectedStation;
            return (
              <button
                key={i}
                onClick={() => setSelectedStation(isActive ? "" : station)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                  isActive ? "border-blue-300 bg-blue-50 shadow-sm" : "border-gray-100 bg-gray-50/40 hover:border-gray-200"
                }`}
              >
                <span className={`text-sm flex-1 ${isActive ? "font-bold text-blue-800" : "text-gray-500"}`}>{station}</span>
                <span className="text-xs font-mono text-gray-400">Step {i + 1}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-4 py-4">
        {confirmed ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <CheckCircle2 size={24} className="text-green-500 mx-auto mb-2" />
            <p className="font-bold text-green-800 text-sm">{confirmed}</p>
            <p className="text-xs text-green-600 mt-0.5">{new Date().toLocaleTimeString()}</p>
          </div>
        ) : selectedStation ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-400 text-center mb-1">{selectedStation} — select action:</p>
            <button onClick={() => handleAction("started")} disabled={submitting} className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60">
              <Play size={15} fill="white" /> Start
            </button>
            <button onClick={() => handleAction("completed")} disabled={submitting} className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 active:scale-95 transition-all disabled:opacity-60">
              <CheckCircle2 size={15} /> Complete
            </button>
            <button onClick={() => handleAction("failed_qc")} disabled={submitting} className="flex items-center justify-center gap-2 w-full py-3 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 active:scale-95 transition-all disabled:opacity-60">
              <X size={15} /> Failed QC
            </button>
          </div>
        ) : (
          <p className="text-center text-sm text-gray-400 py-4">↑ Select a station to record a scan</p>
        )}
      </div>
    </Shell>
  );
}

// ── Shell ──────────────────────────────────────────────────────

function Shell({
  children,
  isDemo,
  woNumber,
  partNumber,
  customer,
  qty,
}: {
  children: React.ReactNode;
  isDemo: boolean;
  woNumber?: string;
  partNumber?: string;
  customer?: string;
  qty?: number;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-8 px-4" style={{ backgroundColor: "#e5e7eb" }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gray-900 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Factory size={16} className="text-amber-400" />
            <span className="text-white text-sm font-bold tracking-tight">FactoryOS</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${isDemo ? "text-amber-400 bg-amber-400/10" : "text-gray-400 bg-gray-800"}`}>
            {isDemo ? "Demo" : "Worker View"}
          </span>
        </div>
        {woNumber && (
          <div className="bg-blue-50 border-b border-blue-100 px-4 py-3">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-mono font-bold text-blue-700">{woNumber}</span>
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full font-medium">In Progress</span>
            </div>
            <p className="text-sm font-bold text-gray-900">{partNumber}</p>
            <p className="text-xs text-gray-500 mt-0.5">{customer} · {qty} units</p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
