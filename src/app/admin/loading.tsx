/** Shown at once while a dashboard page loads, so a click never leaves an empty screen. */
export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-lg bg-slate-200" />
        <div className="h-4 w-80 max-w-full rounded bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-white border border-slate-200" />
        ))}
      </div>
      <div className="h-72 rounded-2xl bg-white border border-slate-200" />
    </div>
  );
}
