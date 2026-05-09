"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SESSION_KEY = "data_source_selected";

type Card = "qr" | "csv" | "erp";

export function DataSourceModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Card | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem(SESSION_KEY)) {
      setOpen(true);
    }
  }, []);

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, "true");
    setOpen(false);
  }

  function handleSkip() {
    dismiss();
  }

  function handleQR() {
    dismiss();
    router.push("/setup/stations");
  }

  function handleERP() {
    dismiss();
    router.push("/settings/integrations");
  }

  function handleCSVClick() {
    setActive("csv");
    fileRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // shift_id and tenant_id are derived server-side from the session
      // Pass placeholder values; the route validates server-side auth
      formData.append("shift_id", "");
      formData.append("tenant_id", "");

      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      dismiss();
      setToast(`${data.inserted} events imported`);
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Upload failed");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!open) {
    return toast ? <Toast message={toast} /> : null;
  }

  const cards: { id: Card; label: string; title: string; body: string; cta: string; onClick: () => void }[] = [
    {
      id: "qr",
      label: "QR TRACKING",
      title: "Start from scratch",
      body: "We generate QR codes for your stations. Operators scan on entry, exit, and defect. No existing system needed.",
      cta: "Set up QR →",
      onClick: handleQR,
    },
    {
      id: "csv",
      label: "CSV IMPORT",
      title: "Import today's plan",
      body: "Upload your production plan as a CSV file. LinePulse maps it to your stations and starts monitoring immediately.",
      cta: uploading ? "Uploading…" : "Upload CSV →",
      onClick: handleCSVClick,
    },
    {
      id: "erp",
      label: "ERP / MES INTEGRATION",
      title: "Connect existing system",
      body: "Already running SAP, Oracle, or another MES? Connect via our API and your data flows in automatically.",
      cta: "Get integration docs →",
      onClick: handleERP,
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-1 font-mono text-xs uppercase tracking-widest text-[#9a9688]">
            Data source
          </div>
          <h2 className="mb-1 font-display text-2xl font-bold text-[#1a1916]">
            How do you want to feed data today?
          </h2>
          <p className="mb-8 text-sm text-[#9a9688]">
            You can switch between sources any time.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            {cards.map((card) => (
              <button
                key={card.id}
                onClick={card.onClick}
                disabled={uploading}
                className={`rounded-xl border-2 p-5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 ${
                  active === card.id
                    ? "border-[#1a1916] bg-[#F7F5F0]"
                    : "border-[#E5E2DC] bg-white hover:border-[#1a1916]/40"
                }`}
              >
                <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[#9a9688]">
                  {card.label}
                </div>
                <div className="mb-2 font-display text-base font-bold text-[#1a1916]">
                  {card.title}
                </div>
                <p className="mb-4 text-sm leading-relaxed text-[#9a9688]">{card.body}</p>
                <span className="text-sm font-medium text-[#1a1916]">{card.cta}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={handleSkip}
              className="text-sm text-[#9a9688] hover:text-[#1a1916] transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file input for CSV */}
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {toast && <Toast message={toast} />}
    </>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-[#1a1916] px-5 py-3 text-sm text-white shadow-lg">
      {message}
    </div>
  );
}
