/**
 * Parser for the frontmatter format used by content/legal/*.md documents.
 *
 * Hand-rolled rather than gray-matter: the format is a handful of key/value
 * lines between two `---` fences, a dependency is not worth the supply-chain
 * surface, and keeping it pure keeps it unit-testable in this repo's
 * established style (src/lib/variant-stock-registry.ts is the precedent).
 */

export interface LegalDocument {
  title: string;
  effectiveDate: string;
  body: string;
}

const FENCE = "---";
const ALLOWED_KEYS = ["title", "effectiveDate"] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseLegalDocument(raw: string): LegalDocument {
  // CRLF first: content files can arrive with either line ending.
  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  if (lines[0] !== FENCE) {
    throw new Error("Legal document must start with a frontmatter fence (---)");
  }

  const closingFence = lines.indexOf(FENCE, 1);
  if (closingFence === -1) {
    throw new Error("Legal document frontmatter is not terminated (---)");
  }

  const frontmatterLines = lines.slice(1, closingFence);
  const entries = new Map<string, string>();
  for (const line of frontmatterLines) {
    if (line.trim() === "") continue;
    const colon = line.indexOf(":");
    if (colon === -1) {
      throw new Error(
        `Frontmatter line is not a key/value pair: "${line}" (missing colon)`
      );
    }
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (!(ALLOWED_KEYS as readonly string[]).includes(key)) {
      throw new Error(`Unknown frontmatter key "${key}"`);
    }
    entries.set(key, value);
  }

  const title = entries.get("title");
  if (title === undefined || title === "") {
    throw new Error(
      "Legal document frontmatter is missing required key: title"
    );
  }

  const effectiveDate = entries.get("effectiveDate");
  if (effectiveDate === undefined || effectiveDate === "") {
    throw new Error(
      "Legal document frontmatter is missing required key: effectiveDate"
    );
  }
  if (!DATE_PATTERN.test(effectiveDate)) {
    throw new Error(
      `Frontmatter effectiveDate "${effectiveDate}" must be formatted YYYY-MM-DD`
    );
  }

  // Only the first fence pair is frontmatter; a `---` later in the document is
  // a horizontal rule and stays in the body.
  const body = lines
    .slice(closingFence + 1)
    .join("\n")
    .trim();
  if (body === "") {
    throw new Error("Legal document has an empty body");
  }

  return { title, effectiveDate, body };
}
