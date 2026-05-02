export default function KpiSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-2 shadow-sm animate-pulse"
        >
          <div className="h-3 w-24 bg-gray-100 rounded" />
          <div className="h-8 w-16 bg-gray-200 rounded" />
          <div className="h-2.5 w-20 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}
