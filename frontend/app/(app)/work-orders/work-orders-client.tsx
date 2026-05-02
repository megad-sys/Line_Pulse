"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import StatusPill from "@/components/status-pill";
import ProgressBar from "@/components/progress-bar";
import { woProgress } from "@/lib/utils";
import type { WorkOrder, WorkOrderStatus } from "@/lib/types";

const STATUS_OPTIONS: WorkOrderStatus[] = ["planned", "wip", "qc", "done", "delayed"];

export default function WorkOrdersClient({
  workOrders,
  priorityStyles,
  priorityLabel,
}: {
  workOrders: WorkOrder[];
  priorityStyles: Record<string, string>;
  priorityLabel: Record<string, string>;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | "all">("all");

  const filtered = workOrders.filter((wo) => {
    const q = search.toLowerCase();
    const matchSearch =
      wo.wo_number.toLowerCase().includes(q) ||
      wo.customer_name.toLowerCase().includes(q) ||
      wo.part_number.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || wo.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by ID, customer, part..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:border-gray-400 w-72 placeholder:text-gray-400 text-gray-700"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as WorkOrderStatus | "all")}
          className="text-sm border border-gray-200 rounded-lg bg-white px-3 py-2 outline-none focus:border-gray-400 text-gray-600"
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "wip" ? "In Progress" : s === "qc" ? "At QC" : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              {["WO ID", "Customer", "Part", "Priority", "Progress", "Status", "Station", "Due"].map((h) => (
                <th
                  key={h}
                  className="text-left text-xs font-medium text-gray-400 px-4 py-3 uppercase tracking-wide first:pl-5"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-gray-400 text-sm">
                  No work orders match your filters
                </td>
              </tr>
            ) : (
              filtered.map((wo, i) => (
                <tr
                  key={wo.id}
                  className={`hover:bg-gray-50/50 transition-colors ${
                    i < filtered.length - 1 ? "border-b border-gray-50" : ""
                  }`}
                >
                  <td className="pl-5 pr-4 py-3.5 font-mono text-xs text-gray-500">{wo.wo_number}</td>
                  <td className="px-4 py-3.5 text-gray-800 font-medium">{wo.customer_name}</td>
                  <td className="px-4 py-3.5 text-gray-500 text-xs">{wo.part_number}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        priorityStyles[wo.priority] ?? "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {priorityLabel[wo.priority] ?? wo.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 w-40">
                    <ProgressBar
                      value={woProgress(wo.actual_qty, wo.planned_qty)}
                      color={
                        wo.status === "delayed"
                          ? "bg-red-500"
                          : wo.status === "done"
                          ? "bg-green-500"
                          : "bg-blue-500"
                      }
                    />
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusPill status={wo.status} />
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">
                    {wo.stations?.[wo.stations.length - 1] ?? "—"}
                  </td>
                  <td className="px-4 py-3.5 text-xs font-mono text-gray-400">{wo.due_date}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
