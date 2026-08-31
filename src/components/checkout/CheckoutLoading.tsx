/**
 * Checkout Loading Skeleton
 *
 * Mirrors CheckoutForm's page chrome and two-column grid so the real form
 * lands where the skeleton was instead of shifting the page. The previous
 * version was two `bg-muted` bars in a differently-padded container: `:root`
 * holds the light palette and the storefront only overrides `<body>`, so
 * `bg-muted` resolved to near-white and flashed two bright blocks on black.
 * `val-skeleton` is the storefront's steel shimmer, as used by
 * ProductCardSkeleton.
 */

/** One card block: header lines plus `rows` body lines. */
function SkeletonCard({ rows }: { rows: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#111] p-6 shadow-2xl">
      <div className="val-skeleton h-5 w-40 rounded" />
      <div className="val-skeleton mt-2 h-3.5 w-64 max-w-full rounded" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg border border-white/10 p-4"
          >
            <div className="val-skeleton mt-0.5 h-4 w-4 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="val-skeleton h-3.5 w-1/3 rounded" />
              <div className="val-skeleton h-3 w-2/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-12 pb-24">
      <div className="container mx-auto max-w-6xl px-4">
        {/* Header — same rhythm as the real <h1> and its subtitle. */}
        <div className="mb-8 border-b border-white/10 pb-6">
          <div className="val-skeleton h-9 w-56 rounded md:h-10" />
          <div className="val-skeleton mt-3 h-4 w-full max-w-md rounded" />
        </div>

        <div className="lg:grid lg:grid-cols-12 lg:gap-x-12 lg:items-start">
          {/* Left: delivery address, payment method, action row. */}
          <div className="space-y-8 lg:col-span-7">
            <SkeletonCard rows={2} />
            <SkeletonCard rows={2} />

            <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row">
              <div className="val-skeleton h-14 rounded-md sm:w-44" />
              <div className="val-skeleton h-14 flex-1 rounded-md" />
            </div>
          </div>

          {/* Right: order summary, sticky like the real one. */}
          <div className="mt-10 lg:col-span-5 lg:mt-0">
            <div className="sticky top-24 w-full rounded-xl border border-white/10 bg-[#111] p-6 shadow-2xl lg:top-32">
              <div className="val-skeleton h-5 w-36 rounded" />
              <div className="val-skeleton mt-2 h-3.5 w-48 rounded" />

              {/* Line items. */}
              <div className="mt-6 space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="val-skeleton h-16 w-16 shrink-0 rounded-md" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="val-skeleton h-3.5 w-3/4 rounded" />
                      <div className="val-skeleton h-3 w-1/3 rounded" />
                    </div>
                    <div className="val-skeleton h-3.5 w-14 rounded" />
                  </div>
                ))}
              </div>

              {/* Coupon row. */}
              <div className="mt-6 flex gap-2">
                <div className="val-skeleton h-9 flex-1 rounded-md" />
                <div className="val-skeleton h-9 w-20 rounded-md" />
              </div>

              {/* Subtotal / shipping / total. */}
              <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                <div className="flex justify-between">
                  <div className="val-skeleton h-3.5 w-20 rounded" />
                  <div className="val-skeleton h-3.5 w-16 rounded" />
                </div>
                <div className="flex justify-between">
                  <div className="val-skeleton h-3.5 w-20 rounded" />
                  <div className="val-skeleton h-3.5 w-16 rounded" />
                </div>
                <div className="flex justify-between">
                  <div className="val-skeleton h-5 w-16 rounded" />
                  <div className="val-skeleton h-5 w-24 rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
