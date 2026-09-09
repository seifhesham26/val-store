/**
 * Database Seed — pre-launch store
 *
 * Wipes every trace of the demo catalogue and leaves a store that is honest
 * about being pre-launch: one placeholder product, no fake orders, no invented
 * coupons, no revenue that never happened.
 *
 * What it deliberately does NOT touch:
 *   - `legal_pages` / `legal_pages_history` — real content, seeded from
 *     `content/legal/*.md` by `seed-legal.ts`, which this calls at the end.
 *   - `shipping_rates` — operator-owned delivery prices. `seed-shipping.ts`
 *     only inserts governorates that are missing and never overwrites a fee.
 *
 * It creates NO users. Sign up through the storefront, then promote yourself:
 *   npx tsx scripts/set-admin.ts <your-email>
 *
 * Run with: pnpm seed
 */

import "dotenv/config";
import { db } from "../src/db";
import {
  account,
  addresses,
  adminNotifications,
  carts,
  cartItems,
  categories,
  contentSections,
  contentSectionsHistory,
  couponUsages,
  coupons,
  customers,
  featuredItems,
  inventoryLogs,
  newsletterSubscribers,
  orderItems,
  orders,
  payments,
  productImages,
  productVariants,
  products,
  reviews,
  session,
  siteSettings,
  user,
  userNotifications,
  userProfiles,
  verification,
  wishlist,
} from "../src/db/schema";
import { STORE_CURRENCY } from "../src/lib/currency";
import { STORE_LOCALE, STORE_TIMEZONE } from "../src/lib/store-locale";
import { upsertLegalPages } from "./seed-legal";
import { seedShippingRates } from "./seed-shipping";

/**
 * Deleted parents-last, so a row is never orphaned mid-wipe.
 *
 * Several of these would cascade anyway, but relying on cascade means the order
 * of this list silently decides whether the wipe succeeds — being explicit
 * makes a missing table a visible omission rather than a foreign-key error at
 * three in the morning.
 */
async function wipeDemoData() {
  await db.delete(orderItems);
  await db.delete(payments);
  await db.delete(orders);

  await db.delete(cartItems);
  await db.delete(carts);
  await db.delete(wishlist);
  await db.delete(reviews);

  await db.delete(couponUsages);
  await db.delete(coupons);

  await db.delete(inventoryLogs);
  await db.delete(productImages);
  await db.delete(productVariants);
  await db.delete(featuredItems);
  await db.delete(products);
  await db.delete(categories);

  await db.delete(adminNotifications);
  await db.delete(userNotifications);
  await db.delete(newsletterSubscribers);
  await db.delete(addresses);
  await db.delete(customers);

  await db.delete(contentSectionsHistory);
  await db.delete(contentSections);
  await db.delete(siteSettings);

  // Auth last: everything above references a user id.
  await db.delete(userProfiles);
  await db.delete(session);
  await db.delete(account);
  await db.delete(verification);
  await db.delete(user);
}

async function seed() {
  console.log("🌱 Seeding a pre-launch store...\n");

  try {
    console.log("🧹 Removing all demo data (users included)...");
    await wipeDemoData();
    console.log("  ✅ Wiped");

    // ---------------------------------------------------------------- settings
    console.log("\n⚙️  Site settings...");
    await db.insert(siteSettings).values({
      storeName: "Valkyrie",
      storeTagline: "Premium streetwear",
      // Read from the same constants the app uses, so the settings row cannot
      // disagree with what customers are actually charged. The old seed wrote
      // "USD" while Stripe charged in EGP.
      currency: STORE_CURRENCY,
      locale: STORE_LOCALE,
      timezone: STORE_TIMEZONE,
      freeShippingThreshold: "0",
    });
    console.log(`  ✅ Currency ${STORE_CURRENCY}, locale ${STORE_LOCALE}`);

    // ------------------------------------------------------------ CMS sections
    console.log("\n📄 Homepage content...");
    await db.insert(contentSections).values([
      {
        sectionType: "hero",
        content: JSON.stringify({
          title: "Something is coming",
          subtitle: "Premium streetwear, made for Egypt. Launching soon.",
          backgroundImage: "/brand/hero.jpg",
          overlayOpacity: 40,
          ctaText: "See the first drop",
          ctaLink: "/collections/all",
          ctaStyle: "primary",
          textAlignment: "center",
        }),
        displayOrder: 1,
        isActive: true,
        version: 1,
      },
      {
        sectionType: "announcement",
        content: JSON.stringify({
          // Every message here is a claim a customer can hold us to, so none of
          // them promise anything the store cannot currently do. The old seed
          // advertised "Free shipping on orders over $200" — dollars on an EGP
          // store, and a threshold nothing enforced — and a discount code that
          // only existed because the same seed invented it.
          messages: [
            { text: "Launching soon — delivery across Egypt" },
            { text: "14-day returns, as Egyptian law provides" },
          ],
          rotateInterval: 5000,
          backgroundColor: "#1a1a1a",
          textColor: "#ffffff",
          dismissible: true,
        }),
        displayOrder: 0,
        isActive: true,
        version: 1,
      },
      {
        // Art lives in `public/brand/`, not in the upload store, because it is
        // shipped with the build rather than merchandised. `urlOrAssetPath`
        // accepts either, so the admin can replace these with uploads without
        // a code change.
        sectionType: "brand_story",
        content: JSON.stringify({
          preHeadline: "Our Story",
          headline: "Crafted for the Bold",
          paragraphs: [
            "Valkyrie was born from a simple idea: fashion should empower. Every piece in our collection is designed for those who refuse to blend in, who see clothing as a form of self-expression.",
            "From sustainable sourcing to ethical manufacturing, we're committed to creating fashion that looks good and does good.",
          ],
          ctaText: "Learn More",
          ctaLink: "/about",
          backgroundImage: "/brand/brand-story.jpg",
        }),
        displayOrder: 2,
        isActive: true,
        version: 1,
      },
      {
        sectionType: "promo_banner",
        content: JSON.stringify({
          preHeadline: "Limited Time",
          headline: "Sale",
          description: "Selected styles at reduced prices, while stocks last.",
          ctaText: "Shop Sale",
          ctaLink: "/collections/sale",
          backgroundImage: "/brand/promo.jpg",
        }),
        displayOrder: 3,
        isActive: true,
        version: 1,
      },
    ]);
    console.log("  ✅ Hero + announcement + brand story + promo banner");

    // ------------------------------------------------------- placeholder product
    console.log("\n👕 Placeholder product...");
    const [comingSoon] = await db
      .insert(products)
      .values({
        name: "Coming Soon",
        slug: "coming-soon",
        description:
          "Our first drop is on its way. Check back shortly — or follow us to hear the moment it lands.",
        // No category: the demo category tree is gone and this product is a
        // placeholder, not merchandise to be browsed by type.
        categoryId: null,
        sku: "VLK-COMING-SOON",
        basePrice: "0.00",
        isActive: true,
        isFeatured: false,
      })
      .returning();

    // One variant, zero stock, unavailable. A product with no variants at all
    // is an untested shape in the storefront; an out-of-stock variant is the
    // well-trodden path, and it is also the truthful one — this cannot be
    // bought yet.
    await db.insert(productVariants).values({
      productId: comingSoon.id,
      sku: "VLK-COMING-SOON-OS",
      size: "One Size",
      stockQuantity: 0,
      isAvailable: false,
    });

    // The local brand asset, not a random stock photo. It is 2040x528 — far
    // wider than the 3:4 frames the storefront uses — which is exactly the case
    // `ProductImage` was built for: it renders whole against a blurred copy of
    // itself instead of being cropped to an unreadable strip.
    await db.insert(productImages).values({
      productId: comingSoon.id,
      imageUrl: "/brand/coming-soon.png",
      altText: "Coming soon",
      displayOrder: 0,
      isPrimary: true,
    });
    console.log("  ✅ 1 product, 1 variant (out of stock), 1 image");

    // ------------------------------------------------------------------ content
    console.log("\n📜 Legal pages and shipping rates...");
    const legalPageCount = await upsertLegalPages();
    const shippingRateCount = await seedShippingRates();
    console.log(`  ✅ ${legalPageCount} legal pages`);
    console.log(
      `  ✅ ${shippingRateCount} shipping rates ensured (existing fees untouched)`
    );

    console.log("\n✨ Seed complete.\n");
    console.log("📋 Summary:");
    console.log(
      "  - 0 users — sign up, then: npx tsx scripts/set-admin.ts <email>"
    );
    console.log("  - 0 categories, 0 orders, 0 coupons");
    console.log("  - 1 placeholder product (Coming Soon, out of stock)");
    console.log(
      `  - ${legalPageCount} legal pages, ${shippingRateCount} shipping rates`
    );
    console.log(
      "\n⚠️  Storefront navigation is built from categories, so the menus will\n" +
        "   be empty until you create one in Admin → Categories.\n"
    );
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  }

  process.exit(0);
}

seed();
