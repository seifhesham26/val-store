import Link from "next/link";

/**
 * Preserves the friendly "no such collection" panel the page used to render
 * inline. It now arrives with a real 404 rather than a 200.
 */
export default function CollectionNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold text-white">Collection Not Found</h1>
      <p className="text-gray-400">
        The collection you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/collections"
        className="text-sm text-white underline underline-offset-4 hover:text-gray-300 transition-colors"
      >
        Browse all collections
      </Link>
    </div>
  );
}
