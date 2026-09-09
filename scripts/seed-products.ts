/**
 * Catalogue Seed — uploads local images and creates the products that use them.
 *
 * Reads `content/products.json`, uploads each product's images from
 * `temp/products/<slug>/` to UploadThing, and writes categories, products,
 * variants and image rows.
 *
 * **Image order comes from the filenames, not from the manifest.** Files are
 * uploaded in sorted order, so `1-on-model-female.jpg` becomes the primary and
 * `2-on-model-male.jpg` becomes the second frame the product card crossfades
 * to. Keeping the order in one place means the manifest and the filesystem
 * cannot disagree about which photo a customer sees first.
 *
 * Idempotent by slug: run it again and it updates rather than duplicating.
 * Re-running does re-upload the images, though — see `--skip-images`.
 *
 *   pnpm seed:products              upload images and seed
 *   pnpm seed:products --dry-run    report what it would do, touch nothing
 *   pnpm seed:products --skip-images seed rows only, keep existing image URLs
 */

import "dotenv/config";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { UTApi, UTFile } from "uploadthing/server";
import { db } from "../src/db";
import {
  categories,
  productImages,
  productVariants,
  products,
} from "../src/db/schema";

const MANIFEST = join(process.cwd(), "content", "products.json");
const IMAGE_ROOT = join(process.cwd(), "temp");

/** UploadThing's `productImage` route caps at 4MB; fail loudly rather than mid-batch. */
const MAX_BYTES = 4 * 1024 * 1024;

interface CategorySeed {
  slug: string;
  name: string;
  description: string;
  image: string;
  displayOrder: number;
}

interface ProductSeed {
  slug: string;
  name: string;
  description: string;
  category: string;
  sku: string;
  price: number;
  color: string;
  sizes: string[];
  stockPerSize: number;
  material: string;
  careInstructions: string;
  featured: boolean;
  gender: "men" | "women" | "unisex" | "kids";
}

interface Manifest {
  categories: CategorySeed[];
  products: ProductSeed[];
}

const dryRun = process.argv.includes("--dry-run");
const skipImages = process.argv.includes("--skip-images");

/**
 * Remove products the manifest no longer lists.
 *
 * Off by default and deliberately so: a product created through the admin is
 * not in this file, and a seed that silently deleted it would be a nasty
 * surprise. Pass it only when the manifest really is the whole catalogue.
 */
const prune = process.argv.includes("--prune");

function imagesFor(slug: string): string[] {
  const dir = join(IMAGE_ROOT, "products", slug);
  if (!existsSync(dir)) return [];
  // Sorted, so the numeric filename prefix is the display order.
  return readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();
}

async function uploadOne(api: UTApi, absolutePath: string, name: string) {
  const bytes = readFileSync(absolutePath);
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error(
      `${name} is ${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB — over the ` +
        `4MB route limit. Re-export it smaller before seeding.`
    );
  }
  const file = new UTFile([new Uint8Array(bytes)], name, {
    type: name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
  });
  const res = await api.uploadFiles(file);
  if (res.error) throw new Error(`${name}: ${res.error.message}`);
  return res.data.ufsUrl;
}

async function main() {
  const manifest: Manifest = JSON.parse(readFileSync(MANIFEST, "utf-8"));

  console.log(
    `\n📦 ${manifest.categories.length} categories, ${manifest.products.length} products` +
      (dryRun ? "  (DRY RUN — nothing will be written)" : "") +
      (skipImages ? "  (skipping image upload)" : "")
  );

  // Fail before uploading anything if the manifest and the filesystem disagree.
  const problems: string[] = [];
  for (const p of manifest.products) {
    if (!manifest.categories.some((c) => c.slug === p.category)) {
      problems.push(`${p.slug}: unknown category "${p.category}"`);
    }
    if (!skipImages && imagesFor(p.slug).length === 0) {
      problems.push(`${p.slug}: no images in temp/products/${p.slug}/`);
    }
  }
  if (problems.length > 0) {
    console.error("\n❌ Manifest problems:");
    for (const p of problems) console.error("  -", p);
    process.exit(1);
  }

  if (dryRun) {
    for (const p of manifest.products) {
      const imgs = imagesFor(p.slug);
      console.log(
        `\n  ${p.name}  [${p.category}]  ${p.price} EGP  ${p.sizes.length} sizes`
      );
      imgs.forEach((f, i) =>
        console.log(`    ${i === 0 ? "primary " : `order ${i} `} ${f}`)
      );
    }
    console.log("\n✅ Dry run complete — nothing written.\n");
    process.exit(0);
  }

  const api = new UTApi();

  // ---------------------------------------------------------------- categories
  const categoryIds = new Map<string, string>();
  for (const c of manifest.categories) {
    let imageUrl: string | null = null;
    if (!skipImages) {
      const abs = join(IMAGE_ROOT, c.image);
      if (existsSync(abs)) {
        imageUrl = await uploadOne(api, abs, `${c.slug}.jpg`);
        console.log(`  ⬆️  category ${c.slug}`);
      }
    }

    const [row] = await db
      .insert(categories)
      .values({
        slug: c.slug,
        name: c.name,
        description: c.description,
        imageUrl,
        displayOrder: c.displayOrder,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: categories.slug,
        set: {
          name: c.name,
          description: c.description,
          displayOrder: c.displayOrder,
          // Keep the existing image when re-running without uploads, rather
          // than blanking a category that already had one.
          ...(imageUrl ? { imageUrl } : {}),
        },
      })
      .returning();
    categoryIds.set(c.slug, row.id);
  }
  console.log(`  ✅ ${manifest.categories.length} categories`);

  // ------------------------------------------------------------------ products
  for (const p of manifest.products) {
    const [product] = await db
      .insert(products)
      .values({
        slug: p.slug,
        name: p.name,
        description: p.description,
        categoryId: categoryIds.get(p.category)!,
        sku: p.sku,
        basePrice: String(p.price),
        isActive: true,
        isFeatured: p.featured,
        gender: p.gender,
        material: p.material,
        careInstructions: p.careInstructions,
        // Derived rather than stored in the manifest, so the page title cannot
        // drift from the product name when the copy is edited.
        metaTitle: `${p.name} | Valkyrie`,
        metaDescription: p.description.slice(0, 160),
      })
      .onConflictDoUpdate({
        target: products.slug,
        set: {
          name: p.name,
          description: p.description,
          categoryId: categoryIds.get(p.category)!,
          basePrice: String(p.price),
          isActive: true,
          isFeatured: p.featured,
          gender: p.gender,
          material: p.material,
          careInstructions: p.careInstructions,
          metaTitle: `${p.name} | Valkyrie`,
          metaDescription: p.description.slice(0, 160),
        },
      })
      .returning();

    // Variants and images are replaced wholesale. Merging them would need a
    // stable identity per row that the manifest does not carry, and a stale
    // variant left behind is a size customers can order and we cannot ship.
    await db
      .delete(productVariants)
      .where(eq(productVariants.productId, product.id));
    await db.insert(productVariants).values(
      p.sizes.map((size) => ({
        productId: product.id,
        sku: `${p.sku}-${size.replace(/\s+/g, "").toUpperCase()}`,
        size,
        color: p.color,
        stockQuantity: p.stockPerSize,
        isAvailable: true,
      }))
    );

    if (!skipImages) {
      const files = imagesFor(p.slug);
      await db
        .delete(productImages)
        .where(eq(productImages.productId, product.id));

      for (const [i, f] of files.entries()) {
        const url = await uploadOne(
          api,
          join(IMAGE_ROOT, "products", p.slug, f),
          `${p.slug}-${f}`
        );
        await db.insert(productImages).values({
          productId: product.id,
          imageUrl: url,
          altText: p.name,
          displayOrder: i,
          // Exactly one primary. The card reads the first two by display
          // order, so image 0 leads and image 1 is what it crossfades to.
          isPrimary: i === 0,
        });
      }
      console.log(`  ⬆️  ${p.name} — ${files.length} images`);
    } else {
      console.log(`  ✅ ${p.name} (rows only)`);
    }
  }

  if (prune) {
    const keep = new Set(manifest.products.map((p) => p.slug));
    const stale = (await db.select().from(products)).filter(
      (row) => !keep.has(row.slug)
    );
    for (const row of stale) {
      await db.delete(products).where(eq(products.id, row.id));
      console.log(`  🗑️  removed ${row.slug} (not in manifest)`);
    }
    if (stale.length === 0) console.log("  ✅ nothing to prune");
  }

  console.log(`\n✨ Catalogue seeded.\n`);
  console.log("📋 Summary:");
  console.log(`  - ${manifest.categories.length} categories`);
  console.log(`  - ${manifest.products.length} products`);
  console.log(
    `  - ${manifest.products.reduce((n, p) => n + p.sizes.length, 0)} variants\n`
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("\n❌ Catalogue seed failed:", error);
  process.exit(1);
});
