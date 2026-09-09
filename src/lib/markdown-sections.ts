/**
 * Splits a markdown document into `## ` sections.
 *
 * Two consumers need exactly this operation and it would otherwise be written
 * twice: the FAQ accordion turns each heading into a question, and the legal
 * pages turn each heading into a `LegalSection` for `LegalBody`'s numbered
 * layout and sticky table of contents. Both are "split on h2 into titled
 * chunks", so both read this.
 *
 * Line-based rather than regex-over-the-whole-string, because a `##` inside a
 * fenced code block is not a heading and a document-wide regex cannot tell the
 * difference.
 */

export interface MarkdownSection {
  /** Anchor id, derived from the title and unique within the document. */
  id: string;
  title: string;
  /** The prose under the heading, trimmed. */
  body: string;
}

/** Heading text to an anchor-safe id. */
export function slugifyHeading(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "section";
}

export function splitMarkdownSections(markdown: string): MarkdownSection[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  const sections: { title: string; body: string[] }[] = [];
  let current: { title: string; body: string[] } | null = null;
  let fenced = false;

  for (const line of lines) {
    // A fence toggles code mode. Headings inside it are content, not structure.
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
    } else if (!fenced) {
      const heading = /^##\s+(.+)$/.exec(line);
      if (heading) {
        current = { title: heading[1].trim(), body: [] };
        sections.push(current);
        continue;
      }
    }
    // Prose before the first heading belongs to no section and is dropped.
    if (current) current.body.push(line);
  }

  // Two headings can slugify identically ("Your rights" in two documents, or
  // repeated within one). Anchors must stay unique or the table of contents
  // sends both links to the same place.
  const used = new Map<string, number>();

  return sections.map(({ title, body }) => {
    const base = slugifyHeading(title);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    return {
      id: seen === 0 ? base : `${base}-${seen + 1}`,
      title,
      body: body.join("\n").trim(),
    };
  });
}

/**
 * A whole document: the prose before the first heading, plus its sections.
 *
 * `splitMarkdownSections` deliberately drops anything above the first `## `,
 * which is right for the FAQ (nothing sits above the first question) and wrong
 * for a policy, where the opening paragraphs explain what the document is.
 * This keeps both halves so a caller can render the lead-in.
 */
export function splitMarkdownDocument(markdown: string): {
  preamble: string;
  sections: MarkdownSection[];
} {
  const normalised = markdown.replace(/\r\n/g, "\n");
  const lines = normalised.split("\n");

  let fenced = false;
  let firstHeading = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) {
      fenced = !fenced;
      continue;
    }
    if (!fenced && /^##\s+.+$/.test(lines[i])) {
      firstHeading = i;
      break;
    }
  }

  return {
    preamble: lines.slice(0, firstHeading).join("\n").trim(),
    sections: splitMarkdownSections(normalised),
  };
}
