"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Plus, X, GripVertical, Factory, CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { shiftFromTime } from "@/lib/utils";

const DEFAULT_STATIONS = ["SMT", "Soldering", "Visual Inspection", "Functional Test", "Packaging"];

function genWoNumber() {
  return `WO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

const WO_NUMBER = genWoNumber();

export default function NewWorkOrderPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [stations, setStations] = useState([...DEFAULT_STATIONS]);
  const [newStation, setNewStation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const qrData = JSON.stringify({
    id: WO_NUMBER,
    customer: customer || "—",
    part: partNumber || "—",
    qty: quantity || "0",
    stations,
  });

  function addStation() {
    const trimmed = newStation.trim();
    if (trimmed && !stations.includes(trimmed)) {
      setStations([...stations, trimmed]);
      setNewStation("");
    }
  }

  function removeStation(i: number) {
    setStations(stations.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    if (!customer.trim() || !partNumber.trim() || !quantity || !dueDate) {
      setError("Please fill in all required fields.");
      return;
    }

    setError("");
    setSubmitting(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      setError("No tenant associated with your account. Contact your admin.");
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("work_orders").insert({
      tenant_id: profile.tenant_id,
      wo_number: WO_NUMBER,
      customer_name: customer.trim(),
      part_number: partNumber.trim(),
      planned_qty: parseInt(quantity, 10),
      due_date: dueDate,
      priority,
      stations,
      status: "planned",
      actual_qty: 0,
      units_scrapped: 0,
      serial_tracking: false,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/work-orders"), 1500);
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="max-w-[1100px] mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">New Work Order</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Fill in the details — a QR label is generated automatically
          </p>
        </div>

        <div className="flex gap-6 items-start">
          {/* Form */}
          <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Customer Name *">
                <input
                  type="text"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="e.g. Siemens AG"
                  className="input"
                />
              </Field>
              <Field label="Part Number *">
                <input
                  type="text"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="e.g. PCB-CTR-001"
                  className="input"
                />
              </Field>
              <Field label="Planned Quantity *">
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 240"
                  className="input"
                  min={1}
                />
              </Field>
              <Field label="Due Date *">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input"
                />
              </Field>
            </div>

            <Field label="Priority">
              <div className="flex gap-2 flex-wrap">
                {["low", "medium", "high", "urgent"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize ${
                      priority === p
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Production Stations
              </label>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {stations.map((station, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 group"
                  >
                    <GripVertical size={14} className="text-gray-300 shrink-0" />
                    <span className="flex-1 text-sm text-gray-700">{station}</span>
                    <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      Step {i + 1}
                    </span>
                    <button
                      onClick={() => removeStation(i)}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50">
                  <input
                    type="text"
                    value={newStation}
                    onChange={(e) => setNewStation(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addStation()}
                    placeholder="Add station..."
                    className="flex-1 text-sm bg-transparent outline-none text-gray-600 placeholder:text-gray-400"
                  />
                  <button
                    onClick={addStation}
                    className="text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || success}
              className="mt-1 w-full bg-gray-900 text-white font-semibold py-3 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {success ? (
                <>
                  <CheckCircle2 size={16} className="text-green-400" />
                  Work order created!
                </>
              ) : submitting ? (
                "Creating..."
              ) : (
                "Generate QR & Create"
              )}
            </button>
          </div>

          {/* QR preview */}
          <div className="w-72 shrink-0 sticky top-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">QR Label Preview</h3>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Factory size={13} className="text-gray-900" />
                  <span className="text-xs font-bold text-gray-900 tracking-widest">FACTORYOS</span>
                </div>
                <div className="mb-3 space-y-1.5">
                  <LabelRow label="WO ID" value={WO_NUMBER} mono />
                  <LabelRow label="Customer" value={customer || "—"} />
                  <LabelRow label="Part" value={partNumber || "—"} mono />
                  <LabelRow label="Qty" value={quantity || "0"} mono />
                </div>
                <div className="flex gap-px mb-3">
                  {Array.from({ length: 28 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gray-800 rounded-sm"
                      style={{ height: i % 3 === 0 ? 14 : i % 2 === 0 ? 10 : 12 }}
                    />
                  ))}
                </div>
                <div className="flex justify-center">
                  <QRCodeSVG value={qrData} size={96} level="M" />
                </div>
                <p className="text-center text-xs text-gray-400 mt-2">Scan at each station</p>
              </div>
              <p className="text-xs text-gray-400 text-center mt-3">Updates live as you type</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function LabelRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <span className={`text-xs font-medium text-gray-800 truncate text-right ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
