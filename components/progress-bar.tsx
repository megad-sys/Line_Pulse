export default function ProgressBar({
  value,
  max = 100,
  color = "bg-blue-500",
}: {
  value: number;
  max?: number;
  color?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-gray-400 w-8 text-right">{pct}%</span>
    </div>
  );
}
