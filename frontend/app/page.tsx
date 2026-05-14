import Link from "next/link";
import { Reveal } from "@/components/landing/Reveal";

/* ── Primitives ──────────────────────────────────────────────── */

function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-6 ${className}`}>{children}</div>;
}

function MonoLabel({ children }: { children: React.ReactNode }) {
  return <div className="font-mono-label">{children}</div>;
}

const BOOK_DEMO_URL = "https://calendly.com/gadmenna97/30min";

function PrimaryButton({
  href,
  children,
  variant = "dark",
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "dark" | "outline" | "white" | "white-outline";
  external?: boolean;
}) {
  const base =
    "inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5";
  const styles = {
    dark:           "bg-[#1a1916] text-white hover:bg-[#1a1916]/90",
    outline:        "border border-[#E5E2DC] bg-white text-[#1a1916] hover:bg-[#F7F5F0]",
    white:          "bg-white text-[#1a1916] hover:bg-white/90",
    "white-outline": "border border-white/30 text-white hover:bg-white/10",
  }[variant];
  return (
    <a
      href={href}
      className={`${base} ${styles}`}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

/* ── Sections ────────────────────────────────────────────────── */

function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#E5E2DC]/70 bg-white/80 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-lg font-bold tracking-tight text-[#1a1916]">
          Line Pulse
        </Link>
        <nav className="flex items-center gap-7">
          <a href="#how" className="hidden text-sm text-[#1a1916]/80 hover:text-[#1a1916] sm:inline">
            How it works
          </a>
          <a href="#features" className="hidden text-sm text-[#1a1916]/80 hover:text-[#1a1916] sm:inline">
            Features
          </a>
          <a href="/login" className="hidden text-sm text-[#1a1916]/80 hover:text-[#1a1916] sm:inline">
            Dashboard
          </a>
          <a
            href={BOOK_DEMO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-md bg-[#1a1916] px-4 text-sm font-medium text-white hover:bg-[#1a1916]/90"
          >
            Book a Demo →
          </a>
        </nav>
      </Container>
    </header>
  );
}

function Product() {
  return (
    <section className="relative pt-24 pb-24 sm:pt-32 sm:pb-28">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <MonoLabel>AI AGENTS FOR MANUFACTURING</MonoLabel>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight text-[#1a1916] sm:text-6xl md:text-7xl">
              AI agents that monitor, decide, and act on your production lines.
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-[#9a9688]">
              Agents recommend the next best action with full operational context. Once approved,
              LinePulse executes across your existing systems — updating work orders, notifying teams,
              triggering maintenance workflows, and logging every action automatically.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <PrimaryButton href={BOOK_DEMO_URL} external>Book a Demo →</PrimaryButton>
              <PrimaryButton href="#how" variant="outline">
                See how it works
              </PrimaryButton>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <p className="mt-6 text-sm text-[#9a9688]">
              No hardware required &nbsp;·&nbsp; Live in one afternoon &nbsp;·&nbsp; Connects to the tools your team already uses
            </p>
          </Reveal>
        </div>

        <Reveal delay={400} className="mt-16 flex flex-col gap-6">
          <DashboardMockup />
          <AgentMockup />
        </Reveal>
      </Container>
    </section>
  );
}

function DashboardMockup() {
  const kpis = [
    { label: "OEE",        value: "71%",   color: "text-amber-300" },
    { label: "FPY",        value: "93.2%", color: "text-emerald-300" },
    { label: "DPMO",       value: "8,200", color: "text-emerald-300" },
    { label: "Throughput", value: "23.4/hr", color: "text-blue-300" },
  ];

  const rows = [
    { station: "SMT Assembly",      wip: 12, time: "5.2m",  status: "ok",   note: "✓" },
    { station: "Soldering",         wip: 8,  time: "6.1m",  status: "ok",   note: "✓" },
    { station: "Visual Inspection", wip: 23, time: "14.8m", status: "warn", note: "⚠ BOTTLENECK" },
    { station: "Functional Test",   wip: 5,  time: "7.3m",  status: "ok",   note: "✓" },
    { station: "Packaging",         wip: 0,  time: "4.4m",  status: "ok",   note: "✓" },
  ];

  return (
    <div className="mx-auto max-w-4xl rounded-2xl bg-[#1a1916] p-6 shadow-2xl shadow-black/10 ring-1 ring-black/10 sm:p-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 text-sm">✦</span>
          <span className="font-mono text-xs uppercase tracking-widest text-white/70">LinePulse · Shopfloor</span>
          <span className="ml-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] text-amber-300">Demo data</span>
        </div>
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/40 mb-1">{k.label}</p>
            <p className={`text-xl font-bold font-mono ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-4 py-2.5 font-mono font-medium">Station</th>
              <th className="px-4 py-2.5 font-mono font-medium">WIP</th>
              <th className="px-4 py-2.5 font-mono font-medium">Avg Cycle</th>
              <th className="px-4 py-2.5 font-mono font-medium">vs Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-white/80">
            {rows.map((r) => (
              <tr key={r.station}>
                <td className="px-4 py-2.5 text-sm">{r.station}</td>
                <td className="px-4 py-2.5 font-mono text-sm">{r.wip > 0 ? r.wip : "—"}</td>
                <td className="px-4 py-2.5 font-mono text-sm">{r.time}</td>
                <td className={`px-4 py-2.5 font-mono text-xs font-semibold ${r.status === "warn" ? "text-amber-300" : "text-emerald-300"}`}>
                  {r.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AgentMockup() {
  return (
    <div className="mx-auto max-w-4xl rounded-2xl bg-[#1a1916] p-6 shadow-2xl shadow-black/10 ring-1 ring-black/10 sm:p-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 text-sm">✦</span>
          <span className="font-mono text-xs uppercase tracking-widest text-white/70">LinePulse · AI Agents · Production</span>
        </div>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
          ⚠ Awaiting Approval
        </span>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/40 mb-1">Data</p>
            <p className="text-white/70">5 stations · 74 units completed · 3.2h remaining</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/40 mb-1">Analysis</p>
            <p className="text-white/70">Visual Inspection at 14.8 min avg (2.3× target). 23 parts backing up. Shift plan at risk.</p>
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-white/40 mb-3">Recommended Action</p>
          <div className="rounded-lg border border-blue-400/20 bg-blue-400/5 p-4">
            <p className="text-white/90 text-sm font-medium mb-1">Reallocate operator from Packaging → Visual Inspection for remainder of shift</p>
            <p className="text-emerald-300 text-xs font-mono">Estimated recovery: 47 min · Plan back on track</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-[#1a1916] hover:bg-white/90 transition-colors">
            Approve &amp; Execute →
          </button>
          <p className="text-xs text-white/30">On approval: notifies team · updates WO priority · logs issue</p>
        </div>
      </div>
    </div>
  );
}

function Problem() {
  const cards = [
    {
      icon: "📋",
      title: "No one watching the floor",
      body: "Between shifts, between meetings, between reports — your production line runs unsupervised. Problems compound before anyone notices.",
    },
    {
      icon: "⏱",
      title: "Humans can't monitor everything",
      body: "An engineer can't watch every station, every shift, every day. By the time a bottleneck is obvious, it's already cost you hours and a missed deadline.",
    },
    {
      icon: "💸",
      title: "Your ERP records. It doesn't act.",
      body: "SAP and Oracle tell you what happened yesterday. They don't tell you what's going wrong right now.",
    },
  ];
  return (
    <section className="border-y border-[#E5E2DC] bg-[#F7F5F0] py-24 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <Reveal>
            <MonoLabel>The Problem</MonoLabel>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight text-[#1a1916] sm:text-5xl">
              Most factories find out about problems too late.
            </h2>
          </Reveal>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {cards.map((c, i) => (
            <Reveal key={c.title} delay={i * 100}>
              <div className="h-full rounded-xl border border-[#E5E2DC] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <div className="text-2xl">{c.icon}</div>
                <h3 className="mt-5 font-display text-xl font-bold text-[#1a1916]">{c.title}</h3>
                <p className="mt-3 leading-relaxed text-[#9a9688]">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Solution() {
  const cols = [
    {
      icon: "▢",
      title: "Workers scan. You see everything.",
      body: "Stick a QR label on each part. Workers scan with their phone — no app download, no login. Status updates instantly.",
    },
    {
      icon: "◎",
      title: "Agent computes. Agent acts.",
      body: "Every 15 minutes, the agent analyses your full production state — cycle times, QC rates, station queues — and decides what needs action. It doesn't wait to be asked.",
    },
    {
      icon: "↗",
      title: "Approves once. Executes everywhere.",
      body: "When an operator approves an agent recommendation, LinePulse coordinates the execution automatically across connected systems — work orders, maintenance workflows, team notifications, and operational tracking.",
    },
  ];
  return (
    <section className="py-24 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <Reveal>
            <MonoLabel>The Solution</MonoLabel>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight text-[#1a1916] sm:text-5xl">
              An autonomous AI agent — running on your floor, 24 hours a day.
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#9a9688]">
              Workers scan a QR code at each station. The agent processes every scan, detects every anomaly,
              and takes action — automatically. No one needs to open a dashboard for the agent to do its job.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
          {cols.map((c, i) => (
            <Reveal key={c.title} delay={i * 100}>
              <div className="border-t border-[#1a1916] pt-6">
                <div className="font-display text-2xl text-[#1a1916]">{c.icon}</div>
                <h3 className="mt-5 font-display text-xl font-bold leading-snug text-[#1a1916]">{c.title}</h3>
                <p className="mt-3 leading-relaxed text-[#9a9688]">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Connect your data",
      body: "Use QR codes, upload a CSV production plan, or connect your existing ERP or MES system. LinePulse works with what you already have.",
    },
    {
      n: "02",
      title: "Data structures itself",
      body: "Raw events become cycle times, throughput, WIP, and defect rates — automatically.",
    },
    {
      n: "03",
      title: "Agents monitor",
      body: "AI agents watch every production line continuously, detecting bottlenecks, flagging quality spikes, planning your resources, and keeping your plan on track.",
    },
    {
      n: "04",
      title: "Approve once. System executes.",
      body: "Approve an agent recommendation once. LinePulse handles the downstream coordination across your existing tools, workflows, and operational systems.",
    },
  ];
  return (
    <section id="how" className="border-y border-[#E5E2DC] py-24 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <Reveal>
            <MonoLabel>How it works</MonoLabel>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight text-[#1a1916] sm:text-5xl">
              Live in one afternoon.
            </h2>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-4">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 90}>
              <div className="rounded-xl border border-[#E5E2DC] p-6 transition-colors hover:bg-[#F7F5F0]">
                <div className="font-mono text-xs text-[#9a9688]">{s.n}</div>
                <h3 className="mt-4 font-display text-lg font-bold text-[#1a1916]">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#9a9688]">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

function DashboardPreview() {
  return (
    <section className="py-24 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <Reveal>
            <MonoLabel>The Dashboard</MonoLabel>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight text-[#1a1916] sm:text-5xl">
              Your entire floor, visible from one screen.
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#9a9688]">
              Live KPIs, station-by-station status, and AI agent recommendations — all in one place.
              No configuration needed. Data starts flowing the moment workers begin scanning.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-md bg-[#1a1916] px-5 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1a1916]/90"
              >
                View Dashboard →
              </a>
              <span className="text-sm text-[#9a9688]">Login required · Demo data available</span>
            </div>
          </Reveal>
        </div>

        <Reveal delay={320} className="mt-14 flex flex-col gap-6">
          <DashboardMockup />
          <AgentMockup />
        </Reveal>
      </Container>
    </section>
  );
}

function Features() {
  const features = [
    { title: "Real-time floor visibility",  body: "Parts tracked at every station, live." },
    { title: "AI Agents, not dashboards",   body: "LinePulse agents continuously monitor production activity — detecting bottlenecks and downtime patterns, surfacing quality issues, and highlighting what needs attention before problems escalate. Your team stays in control, with faster decisions and real-time operational awareness." },
    { title: "Operator approval flow",      body: "Agents recommend. Operators approve in one click. The system executes — no copy-pasting into other tools, no manual follow-up." },
    { title: "Native integrations",         body: "Email, Slack, Microsoft Teams, work order reprioritisation, and maintenance ticketing — all triggered automatically the moment an action is approved." },
    { title: "Manufacturing KPIs",          body: "OEE, FPY, DPMO, cycle time — calculated automatically." },
    { title: "Works alongside your existing systems", body: "Designed to sit next to your ERP, MES, or spreadsheets — not replace them." },
  ];
  return (
    <section id="features" className="bg-[#F7F5F0] py-24 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <Reveal>
            <MonoLabel>Features</MonoLabel>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight text-[#1a1916] sm:text-5xl">
              Deploy fast. Operate smarter.
            </h2>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80}>
              <div className="h-full rounded-xl border border-[#E5E2DC] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <h3 className="font-display text-lg font-bold text-[#1a1916]">{f.title}</h3>
                <p className="mt-2 leading-relaxed text-[#9a9688]">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

function CTA() {
  return (
    <section className="bg-[#1a1916] py-24 text-white sm:py-28">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <h2 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Your AI production agent — live this afternoon.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="mx-auto mt-5 max-w-md text-lg text-white/60">
              The agent starts working the moment you connect your first data source.
            </p>
          </Reveal>
          <Reveal delay={160}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <PrimaryButton href={BOOK_DEMO_URL} variant="white" external>
                Book a Demo →
              </PrimaryButton>
              <PrimaryButton href="https://mail.google.com/mail/?view=cm&fs=1&to=gadmenna97@gmail.com&su=Demo+Booking%3A+Line+Pulse" variant="white-outline" external>
                Contact us
              </PrimaryButton>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#E5E2DC] bg-[#F7F5F0] py-12">
      <Container>
        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
          <div>
            <div className="font-display text-lg font-bold text-[#1a1916]">Line Pulse</div>
            <div className="mt-1 text-sm text-[#9a9688]">Agentic AI for manufacturing.</div>
          </div>
          <nav className="flex items-center gap-7 text-sm">
            <a href="#" className="text-[#1a1916]/80 hover:text-[#1a1916]">Privacy Policy</a>
            <a href="https://mail.google.com/mail/?view=cm&fs=1&to=gadmenna97@gmail.com&su=Demo+Booking%3A+Line+Pulse" className="text-[#1a1916]/80 hover:text-[#1a1916]">Contact</a>
          </nav>
        </div>
        <div className="mt-6">
          <p className="font-mono text-xs text-[#9a9688]">
            Works with QR tracking, CSV imports, and ERP/MES integrations.
          </p>
        </div>
        <div className="mt-6 border-t border-[#E5E2DC] pt-6 text-xs text-[#9a9688]">
          © 2026 Line Pulse
        </div>
      </Container>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-[#1a1916]">
      <LandingNav />
      <Product />
      <Problem />
      <Solution />
      <HowItWorks />
      <DashboardPreview />
      <Features />
      <CTA />
      <Footer />
    </main>
  );
}
