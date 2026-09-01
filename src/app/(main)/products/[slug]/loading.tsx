/** Mirrors the ProductDetail two-column layout so nothing jumps on handover. */
export default function ProductLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        <div className="val-skeleton aspect-3/4 w-full rounded-lg" />
        <div className="space-y-4">
          <div className="val-skeleton h-9 w-3/4 rounded" />
          <div className="val-skeleton h-6 w-32 rounded" />
          <div className="val-skeleton h-px w-full" />
          <div className="val-skeleton h-4 w-full rounded" />
          <div className="val-skeleton h-4 w-5/6 rounded" />
          <div className="val-skeleton h-4 w-2/3 rounded" />
          <div className="pt-4 flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="val-skeleton h-11 w-14 rounded" />
            ))}
          </div>
          <div className="val-skeleton h-12 w-full rounded mt-4" />
        </div>
      </div>
    </div>
  );
}
