export interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: "blue" | "red" | "amber" | "green" | "gray";
  progress?: number;
}

const colorMap = {
  blue: { accent: "text-blue-600", bar: "bg-blue-500" },
  red: { accent: "text-red-600", bar: "bg-red-500" },
  amber: { accent: "text-amber-600", bar: "bg-amber-500" },
  green: { accent: "text-green-600", bar: "bg-green-500" },
  gray: { accent: "text-gray-700", bar: "bg-gray-400" },
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
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-2 shadow-sm">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold font-mono ${accent}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
      {progress !== undefined && (
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
