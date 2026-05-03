"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";

type ToastType = "info" | "success" | "warning" | "error";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  body?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

const ICON: Record<ToastType, React.ReactNode> = {
  info:    <Info       size={15} className="text-blue-400  shrink-0 mt-0.5" />,
  success: <CheckCircle2 size={15} className="text-green-400 shrink-0 mt-0.5" />,
  warning: <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />,
  error:   <AlertCircle size={15} className="text-red-400   shrink-0 mt-0.5" />,
};

const BORDER: Record<ToastType, string> = {
  info:    "#3b82f6",
  success: "#4ade80",
  warning: "#fbbf24",
  error:   "#f87171",
};

const AUTO_DISMISS_MS = 6000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-4), { ...t, id }]);
    timers.current[id] = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }, [dismiss]);

  useEffect(() => {
    const current = timers.current;
    return () => { Object.values(current).forEach(clearTimeout); };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>
      {children}
      {/* Toast tray */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-80 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-xl border px-4 py-3 flex items-start gap-3 shadow-xl animate-in slide-in-from-right-5 duration-200"
            style={{ backgroundColor: "var(--surface2)", borderColor: BORDER[toast.type], borderLeftWidth: 3 }}
          >
            {ICON[toast.type]}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{toast.title}</p>
              {toast.body && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--muted)" }}>{toast.body}</p>}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="shrink-0 mt-0.5 transition-colors"
              style={{ color: "var(--muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#f0ede8")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#7a7870")}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
