"use client";

import { useState, useEffect } from "react";
import { Factory, CheckCircle2, Play, X, Lock, Loader2, AlertCircle } from "lucide-react";
import type { WorkOrder } from "@/lib/types";

export default function ScanPage({ params }: { params: { workOrderId: string } }) {
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [activeStation, setActiveStation] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ action: string; time: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/scan/${params.workOrderId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setWorkOrder(data.workOrder);
      })
      .catch(() => setError("Could not load work order."))
      .finally(() => setLoading(false));
  }, [params.workOrderId]);

  async function handleAction(action: "started" | "completed" | "failed_qc") {
    if (!workOrder || !activeStation) return;
    setSubmitting(true);

    const res = await fetch(`/api/scan/${params.workOrderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        station_name: activeStation,
        status: action,
        operator_name: operatorName || undefined,
      }),
    });

    setSubmitting(false);

    if (res.ok) {
      setConfirmed({ action: action.replace("_", " "), time: new Date().toLocaleTimeString() });
      setTimeout(() => setConfirmed(null), 2500);
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to record scan.");
    }
  }

  if (loading) {
    return (
      <ScanShell>
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      </ScanShell>
    );
  }

  if (error || !workOrder) {
    return (
      <ScanShell>
        <div className="px-4 py-6 text-center">
          <AlertCircle size={24} className="text-red-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-red-700">{error || "Work order not found."}</p>
        </div>
      </ScanShell>
    );
  }

  const stations = workOrder.stations ?? [];

  return (
    <ScanShell woNumber={workOrder.wo_number} partNumber={workOrder.part_number} customer={workOrder.customer_name} qty={workOrder.planned_qty}>
      {/* Operator name */}
      {!operatorName && (
        <div className="px-4 py-4 border-b border-gray-100 bg-yellow-50">
          <p className="text-xs text-yellow-700 mb-2 font-medium">Enter your name before scanning (optional)</p>
          <input
            type="text"
            placeholder="Your name..."
            onBlur={(e) => setOperatorName(e.target.value)}
            className="w-full text-sm border border-yellow-200 rounded-lg px-3 py-2 bg-white outline-none"
          />
        </div>
      )}

      {/* Station picker */}
      <div className="px-4 py-4 border-b border-gray-100">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2.5">
          Select Station
        </p>
        <div className="flex flex-col gap-1.5">
          {stations.map((station, i) => {
            const isActive = station === activeStation;
            return (
              <button
                key={i}
                onClick={() => setActiveStation(isActive ? null : station)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                  isActive
                    ? "border-blue-300 bg-blue-50 shadow-sm"
                    : "border-gray-100 bg-gray-50/40 hover:border-gray-200"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    isActive ? "bg-blue-500" : "bg-gray-200"
                  }`}
                >
                  {isActive ? (
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  ) : (
                    <Lock size={10} className="text-gray-400" />
                  )}
                </div>
                <span className={`text-sm flex-1 ${isActive ? "font-bold text-blue-800" : "text-gray-500"}`}>
                  {station}
                </span>
                <span className="text-xs font-mono text-gray-400">Step {i + 1}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action area */}
      <div className="px-4 py-4">
        {confirmed ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <CheckCircle2 size={24} className="text-green-500 mx-auto mb-2" />
            <p className="font-bold text-green-800 text-sm capitalize">Scan recorded!</p>
            <p className="text-xs text-green-600 mt-0.5">
              {confirmed.action} · {confirmed.time}
            </p>
          </div>
        ) : activeStation ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-400 text-center mb-1">
              {activeStation} · Select action:
            </p>
            <button
              onClick={() => handleAction("started")}
              disabled={submitting}
              className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60"
            >
              <Play size={15} fill="white" />
              Start
            </button>
            <button
              onClick={() => handleAction("completed")}
              disabled={submitting}
              className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 active:scale-95 transition-all disabled:opacity-60"
            >
              <CheckCircle2 size={15} />
              Complete
            </button>
            <button
              onClick={() => handleAction("failed_qc")}
              disabled={submitting}
              className="flex items-center justify-center gap-2 w-full py-3 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 active:scale-95 transition-all disabled:opacity-60"
            >
              <X size={15} />
              Failed QC
            </button>
          </div>
        ) : (
          <p className="text-center text-sm text-gray-400 py-4">
            ↑ Select a station above to record a scan
          </p>
        )}
      </div>

      <div className="bg-gray-50 px-4 py-2 border-t border-gray-100">
        <p className="text-xs text-center text-gray-400">
          {operatorName ? `Operator: ${operatorName}` : "No operator name set"}
        </p>
      </div>
    </ScanShell>
  );
}

function ScanShell({
  children,
  woNumber,
  partNumber,
  customer,
  qty,
}: {
  children: React.ReactNode;
  woNumber?: string;
  partNumber?: string;
  customer?: string;
  qty?: number;
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start py-8 px-4"
      style={{ backgroundColor: "#e5e7eb" }}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Phone nav */}
        <div className="bg-gray-900 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Factory size={16} className="text-amber-400" />
            <span className="text-white text-sm font-bold tracking-tight">FactoryOS</span>
          </div>
          <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
            Worker View
          </span>
        </div>

        {/* Work order card */}
        {woNumber && (
          <div className="bg-blue-50 border-b border-blue-100 px-4 py-3">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-mono font-bold text-blue-700">{woNumber}</span>
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full font-medium">
                In Progress
              </span>
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
