/**
 * Renders one legal document's markdown into the storefront's legal styling.
 *
 * The element overrides below exist so a database-authored document looks the
 * same as the hand-built JSX it replaced: `LegalBody` supplies the section
 * chrome and base typography, and this fills in the inline elements markdown
 * produces — lists with the steel dash marker `LegalList` uses, tables framed
 * like `LegalTable`, and emphasis in white against the grey body text.
 *
 * Raw HTML stays disabled. react-markdown ignores it by default, and that
 * default is exactly what stops admin-authored content from becoming an
 * injection vector — do not add `rehype-raw` here.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";

export function LegalMarkdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p>{children}</p>,
        strong: ({ children }) => (
          <span className="text-white">{children}</span>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        h3: ({ children }) => (
          <h3 className="mt-6 text-base font-semibold text-white">
            {children}
          </h3>
        ),
        ul: ({ children }) => <ul className="space-y-2">{children}</ul>,
        ol: ({ children }) => (
          <ol className="list-decimal space-y-2 pl-5">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-2.5 h-px w-3 shrink-0 bg-val-accent/60"
            />
            <span className="min-w-0">{children}</span>
          </li>
        ),
        a: ({ href, children }) => {
          const to = href ?? "#";
          // Internal links go through next/link so a policy cross-reference
          // does not cost a full page load.
          return to.startsWith("/") ? (
            <Link href={to} className="text-val-accent hover:underline">
              {children}
            </Link>
          ) : (
            <a
              href={to}
              className="text-val-accent hover:underline"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        },
        table: ({ children }) => (
          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="w-full text-left text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-white/[0.03] text-[11px] uppercase tracking-[0.2em] text-gray-500">
            {children}
          </thead>
        ),
        th: ({ children }) => (
          <th className="px-4 py-2.5 font-medium">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border-t border-white/5 px-4 py-3">{children}</td>
        ),
        code: ({ children }) => (
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.85em] text-white">
            {children}
          </code>
        ),
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
