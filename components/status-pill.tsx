import type { WorkOrderStatus } from "@/lib/types";

const config: Record<WorkOrderStatus, { bg: string; text: string; dot: string; label: string }> = {
  planned: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", label: "Planned" },
  wip: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "In Progress" },
  qc: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500", label: "At QC" },
  done: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500", label: "Complete" },
  delayed: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Delayed" },
};

export default function StatusPill({ status }: { status: WorkOrderStatus }) {
  const { bg, text, dot, label } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
