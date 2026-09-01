/**
 * Admin routes are light-themed via their own ThemeProvider, so this uses
 * token colours rather than the storefront's hardcoded white-on-black.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        <div className="h-4 w-96 max-w-full rounded bg-muted animate-pulse" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
      <div className="h-80 rounded-lg bg-muted animate-pulse" />
    </div>
  );
}
