/**
 * One legal page, rendered from the database.
 *
 * The five legal documents used to be hardcoded JSX — 970 lines of prose that
 * needed a deploy to correct a policy. They now live in `legal_pages`, seeded
 * from `content/legal/*.md`.
 *
 * The presentation is unchanged: `LegalHero` and `LegalBody` are the existing
 * design (branded hero, sticky table of contents, numbered sections), and this
 * derives the `LegalSection[]` they want by splitting the markdown on its `## `
 * headings. Replacing that design with a flat markdown dump would have thrown
 * away the table of contents and the section numbering for no gain.
 */

import { LegalBody, LegalHero, type LegalSection } from "./LegalDocument";
import { LegalMarkdown } from "./LegalMarkdown";
import { splitMarkdownDocument } from "@/lib/markdown-sections";
import { resolveLegalPage } from "@/lib/cache";
import { formatStoreDate } from "@/lib/store-locale";
import type { LegalSlug } from "@/domain/legal/legal-slugs";

export async function LegalPage({
  slug,
  eyebrow = "Legal",
}: {
  slug: LegalSlug;
  eyebrow?: string;
}) {
  const page = await resolveLegalPage(slug);

  // Both the database and the repo copy are unreachable. Say so plainly rather
  // than rendering an empty policy, which would read as "we have no terms".
  if (!page) {
    return (
      <LegalHero
        eyebrow={eyebrow}
        title="Temporarily unavailable"
        description="We could not load this document just now. Please try again shortly, or contact us and we will send it to you directly."
        updatedAt="—"
      />
    );
  }

  const { preamble, sections } = splitMarkdownDocument(page.bodyMarkdown);

  // The document's own opening paragraph is the hero description, so the lead-in
  // is authored once in the markdown rather than duplicated in every route.
  const [lead, ...restOfPreamble] = preamble
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const legalSections: LegalSection[] = sections.map((section) => ({
    id: section.id,
    title: section.title,
    content: <LegalMarkdown markdown={section.body} />,
  }));

  return (
    <>
      <LegalHero
        eyebrow={eyebrow}
        title={page.title}
        description={lead ?? ""}
        updatedAt={formatStoreDate(page.effectiveDate)}
      />
      {restOfPreamble.length > 0 && (
        <div className="pt-10 text-sm leading-relaxed text-gray-400">
          <LegalMarkdown markdown={restOfPreamble.join("\n\n")} />
        </div>
      )}
      <LegalBody sections={legalSections} />
    </>
  );
}
