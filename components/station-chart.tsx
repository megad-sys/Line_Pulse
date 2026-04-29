"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { Station } from "@/lib/types";

export default function StationChart({ data }: { data: Station[] }) {
  const hasBottleneck = data.some((s) => s.isBottleneck);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Station Cycle Times</h3>
          <p className="text-xs text-gray-400 mt-0.5">Avg minutes per unit</p>
        </div>
        {hasBottleneck && (
          <span className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full font-medium">
            Bottleneck detected
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart
          data={data.map((s) => ({ name: s.name, cycleTime: s.cycleTime, isBottleneck: s.isBottleneck }))}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis
            type="number"
            domain={[0, Math.max(18, ...data.map((s) => s.cycleTime + 2))]}
            tickCount={7}
            tick={{ fontSize: 11, fontFamily: "IBM Plex Mono", fill: "#9ca3af" }}
            tickFormatter={(v: number) => `${v}m`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 12, fill: "#374151" }}
          />
          <Tooltip
            formatter={(value) => [`${value} min`, "Cycle Time"]}
            contentStyle={{ fontSize: 12, fontFamily: "IBM Plex Mono", borderRadius: 8 }}
          />
          <Bar dataKey="cycleTime" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isBottleneck ? "#DC2626" : "#3B82F6"}
                opacity={entry.isBottleneck ? 1 : 0.65}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
