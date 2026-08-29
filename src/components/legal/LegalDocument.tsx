/**
 * Legal Document primitives
 *
 * Shared presentation for the Privacy Policy and Terms of Service pages: a
 * branded hero, a sticky table of contents, and numbered sections. Keeping the
 * chrome here means the two documents only have to supply their copy.
 *
 * Note: these are storefront pages, so they inherit the hard-coded dark theme
 * (`bg-black text-white`) rather than the shadcn light tokens.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, Mail } from "lucide-react";

export interface LegalSection {
  /** Anchor id, used by the table of contents. */
  id: string;
  title: string;
  content: ReactNode;
}

const pad = (n: number) => String(n).padStart(2, "0");

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

interface LegalHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  updatedAt: string;
}

export function LegalHero({
  eyebrow,
  title,
  description,
  updatedAt,
}: LegalHeroProps) {
  return (
    <header className="relative overflow-hidden border-b border-white/10 pb-12">
      {/* Soft steel glow behind the title */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-val-accent/10 blur-3xl"
      />

      <div className="relative">
        <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-val-accent">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-gray-400">
          {description}
        </p>
        <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-gray-400">
          <CalendarClock className="h-3.5 w-3.5 text-val-accent" />
          Last updated {updatedAt}
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Body                                                                        */
/* -------------------------------------------------------------------------- */

export function LegalBody({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="grid gap-12 pt-12 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-16">
      {/* Table of contents */}
      <aside className="hidden lg:block">
        <div className="sticky top-28">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.28em] text-gray-500">
            On this page
          </p>
          <nav className="border-l border-white/10">
            {sections.map((section, i) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="group -ml-px flex gap-3 border-l border-transparent py-1.5 pl-4 text-sm text-gray-500 transition-colors hover:border-val-accent hover:text-white"
              >
                <span className="font-mono text-[11px] leading-5 text-gray-600 transition-colors group-hover:text-val-accent">
                  {pad(i + 1)}
                </span>
                <span className="leading-5">{section.title}</span>
              </a>
            ))}
          </nav>
        </div>
      </aside>

      {/* Sections */}
      <div className="min-w-0">
        {sections.map((section, i) => (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-28 border-b border-white/5 py-8 first:pt-0 last:border-b-0 last:pb-0"
          >
            <div className="flex items-baseline gap-4">
              <span className="font-mono text-xs text-val-accent">
                {pad(i + 1)}
              </span>
              <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
                {section.title}
              </h2>
            </div>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-gray-400 md:pl-10">
              {section.content}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Content helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Bulleted list with a steel dash marker instead of a browser bullet. */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span
            aria-hidden="true"
            className="mt-2.5 h-px w-3 shrink-0 bg-val-accent/60"
          />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Callout for the things a reader most needs to notice. */
export function LegalNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-300">
      {children}
    </div>
  );
}

/** Two-column definition grid, e.g. retention periods or delivery windows. */
export function LegalTable({
  caption,
  rows,
}: {
  caption?: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      {caption && (
        <p className="border-b border-white/10 bg-white/[0.03] px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.2em] text-gray-500">
          {caption}
        </p>
      )}
      <dl className="divide-y divide-white/5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-6"
          >
            <dt className="text-sm text-white sm:w-52 sm:shrink-0">
              {row.label}
            </dt>
            <dd className="text-sm text-gray-400">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Footer CTA                                                                  */
/* -------------------------------------------------------------------------- */

interface LegalContactProps {
  title: string;
  description: string;
  email: string;
}

export function LegalContact({ title, description, email }: LegalContactProps) {
  return (
    <div className="mt-16 flex flex-col gap-5 rounded-xl border border-white/10 bg-white/[0.03] p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1.5 text-sm text-gray-400">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={`mailto:${email}`}
          className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-val-silver"
        >
          <Mail className="h-4 w-4" />
          {email}
        </a>
        <Link
          href="/contact"
          className="inline-flex items-center rounded-md border border-white/15 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/5"
        >
          Contact us
        </Link>
      </div>
    </div>
  );
}
