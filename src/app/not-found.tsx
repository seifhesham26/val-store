import Link from "next/link";

/**
 * Root 404.
 *
 * Sits above the route groups, so it renders inside the root layout only —
 * no navbar, no footer. Before this, a bad URL got Next's default page with
 * none of the store's chrome or palette.
 *
 * Styled with explicit storefront colours rather than tokens: this file is
 * outside `(main)`, and a 404 is exactly the surface that should not depend on
 * a provider having mounted.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center">
      <p className="text-sm font-medium tracking-[0.3em] text-val-accent">
        404
      </p>
      <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-3 max-w-md text-gray-400">
        The link may be broken, or the page may have been moved.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-md bg-val-accent px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-val-accent/90"
        >
          Back to home
        </Link>
        <Link
          href="/collections/all"
          className="rounded-md border border-white/10 bg-transparent px-5 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          Browse products
        </Link>
      </div>
    </div>
  );
}
