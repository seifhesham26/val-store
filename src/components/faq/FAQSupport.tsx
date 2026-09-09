import Link from "next/link";

export function FAQSupport() {
  return (
    <div className="mt-12 max-w-3xl rounded-xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-lg font-semibold text-white">
        Still have questions?
      </h2>
      <p className="mt-1.5 text-sm text-gray-400">
        If you cannot find what you are looking for, our team is here to help.
      </p>
      <Link
        href="/contact"
        className="mt-4 inline-flex items-center rounded-md border border-white/15 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/5"
      >
        Contact us
      </Link>
    </div>
  );
}
