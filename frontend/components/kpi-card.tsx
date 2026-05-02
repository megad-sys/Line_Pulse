export interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: "blue" | "red" | "amber" | "green" | "gray";
  progress?: number;
}

const colorMap = {
  blue:  { accent: "text-[#60a5fa]", bar: "bg-[#60a5fa]" },
  red:   { accent: "text-[#f87171]", bar: "bg-[#f87171]" },
  amber: { accent: "text-[#fbbf24]", bar: "bg-[#fbbf24]" },
  green: { accent: "text-[#4ade80]", bar: "bg-[#4ade80]" },
  gray:  { accent: "text-[#7a7870]", bar: "bg-[#7a7870]" },
};

export default function KpiCard({
  label,
  value,
  sub,
  color = "blue",
  progress,
}: KpiCardProps) {
  const { accent, bar } = colorMap[color];
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-2"
      style={{ backgroundColor: "#1a1916", borderColor: "#2e2e2b" }}
    >
      <div className="text-xs font-medium uppercase tracking-wider" style={{ color: "#7a7870" }}>
        {label}
      </div>
      <div className={`text-2xl font-bold font-mono ${accent}`}>{value}</div>
      {sub && <div className="text-xs" style={{ color: "#7a7870" }}>{sub}</div>}
      {progress !== undefined && (
        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "#2e2e2b" }}>
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
