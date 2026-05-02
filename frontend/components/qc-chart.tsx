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

export default function QCChart({ data }: { data: Station[] }) {
  const chartData = data.map((s) => ({
    name: s.name.includes(" ") ? s.name.split(" ")[0] : s.name,
    failures: s.qcFailures,
    isBottleneck: s.isBottleneck,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900">QC Failures by Station</h3>
        <p className="text-xs text-gray-400 mt-0.5">Total defects detected today</p>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fontFamily: "IBM Plex Mono", fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [value, "Failures"]}
            contentStyle={{ fontSize: 12, fontFamily: "IBM Plex Mono", borderRadius: 8 }}
          />
          <Bar dataKey="failures" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isBottleneck ? "#DC2626" : "#E5E7EB"}
                stroke={entry.isBottleneck ? "#DC2626" : "#D1D5DB"}
                strokeWidth={1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
