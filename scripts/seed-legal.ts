/**
 * Legal Pages Seed Script
 *
 * Seeds the legal_pages table from content/legal/*.md. Idempotent: each run
 * upserts by slug, so re-seeding refreshes the canonical text.
 *
 * Run with: npm run seed:legal
 */

import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/db";
import { legalPages } from "../src/db/schema";
import { isLegalSlug } from "../src/domain/legal/legal-slugs";
import { parseLegalDocument } from "../src/lib/legal-frontmatter";

const CONTENT_DIR = join(process.cwd(), "content", "legal");

/**
 * Writes NO history row: seeding asserts the canonical text, it is not an
 * editorial change — only the admin editor's update path records history.
 */
export async function upsertLegalPages(): Promise<number> {
  const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));

  const rows = files.map((file) => {
    const slug = file.replace(/\.md$/, "");
    if (!isLegalSlug(slug)) {
      throw new Error(
        `Unrecognized legal document "${file}": slug "${slug}" is not in LEGAL_SLUGS`
      );
    }
    const { title, effectiveDate, body } = parseLegalDocument(
      readFileSync(join(CONTENT_DIR, file), "utf-8")
    );
    return { slug, title, body, effectiveDate };
  });

  for (const { slug, title, body, effectiveDate } of rows) {
    await db
      .insert(legalPages)
      .values({ slug, title, bodyMarkdown: body, effectiveDate })
      .onConflictDoUpdate({
        target: legalPages.slug,
        set: {
          title,
          bodyMarkdown: body,
          effectiveDate,
          updatedAt: new Date(),
        },
      });
  }

  return rows.length;
}

async function main() {
  try {
    const count = await upsertLegalPages();
    console.log(`\n✨ Legal seed completed successfully!\n`);
    console.log("📋 Summary:");
    console.log(`  - ${count} legal pages\n`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Legal seed failed:", error);
    process.exit(1);
  }
}

// Run only when executed directly — importing this module (e.g. from
// scripts/seed.ts) must not trigger the seed.
if (require.main === module) {
  main();
}
