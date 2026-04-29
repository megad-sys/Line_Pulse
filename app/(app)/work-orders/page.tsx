import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { mockWorkOrders } from "@/lib/mock-data";
import DemoBanner from "@/components/demo-banner";
import WorkOrdersClient from "./work-orders-client";
import type { WorkOrder } from "@/lib/types";

const priorityStyles: Record<string, string> = {
  low: "bg-gray-100 text-gray-500",
  medium: "bg-blue-50 text-blue-600",
  high: "bg-orange-50 text-orange-600",
  urgent: "bg-red-50 text-red-600",
};

const priorityLabel: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export default async function WorkOrdersPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("work_orders")
    .select("*")
    .order("created_at", { ascending: false });

  const isDemo = !data || data.length === 0;
  const workOrders: WorkOrder[] = isDemo ? mockWorkOrders : (data as WorkOrder[]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F7F5F0" }}>
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Work Orders</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {workOrders.length} total ·{" "}
              {workOrders.filter((w) => w.status !== "done" && w.status !== "planned").length} active
            </p>
          </div>
          <Link
            href="/work-orders/new"
            className="flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus size={16} />
            New Work Order
          </Link>
        </div>

        {isDemo && <DemoBanner />}

        <WorkOrdersClient
          workOrders={workOrders}
          priorityStyles={priorityStyles}
          priorityLabel={priorityLabel}
        />
      </div>
    </div>
  );
}
