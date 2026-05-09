export default function IntegrationsPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <div className="mb-6">
          <div className="font-mono text-xs uppercase tracking-widest text-[#9a9688] mb-1">
            ERP / MES
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
            Integrations
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Connect your ERP or MES system to stream production events automatically.
          </p>
        </div>

        <div className="rounded-xl border border-[#E5E2DC] bg-white p-8 max-w-xl">
          <div className="font-mono text-xs uppercase tracking-widest text-[#9a9688] mb-3">
            Phase 2 — Coming 2026
          </div>
          <h2 className="font-display text-lg font-bold text-[#1a1916] mb-2">
            ERP &amp; MES connector
          </h2>
          <p className="text-sm leading-relaxed text-[#9a9688] mb-4">
            Post production events directly from SAP, Oracle, or any MES via our webhook API.
            Events land in LinePulse in real time — no CSV uploads required.
          </p>
          <p className="text-sm text-[#9a9688]">
            Contact{" "}
            <a
              href="mailto:hello@linepulse.com"
              className="text-[#1a1916] underline underline-offset-2"
            >
              hello@linepulse.com
            </a>{" "}
            to join the early access list.
          </p>
        </div>
      </div>
    </div>
  );
}
