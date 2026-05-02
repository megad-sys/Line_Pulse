import { FlaskConical } from "lucide-react";

export default function DemoBanner() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 mb-5 bg-amber-50 border border-amber-200 rounded-xl">
      <FlaskConical size={16} className="text-amber-600 shrink-0" />
      <div>
        <span className="text-sm font-semibold text-amber-800">Demo mode</span>
        <span className="text-sm text-amber-700 ml-2">
          This is sample data. Yours will populate automatically as workers scan QR codes at each station.
        </span>
      </div>
    </div>
  );
}
