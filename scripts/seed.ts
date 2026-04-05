/**
 * Comprehensive Database Seed Script
 *
 * Seeds extensive data for development/testing:
 * - Admin and regular users
 * - 12 categories with hierarchy
 * - 35+ products with variants and images
 * - 25+ orders with items
 * - Reviews, coupons, site settings, content sections
 *
 * Run with: npm run seed
 */

import "dotenv/config";
import { db } from "../src/db";
import {
  user,
  userProfiles,
  categories,
  products,
  productVariants,
  productImages,
  orders,
  orderItems,
  reviews,
  coupons,
  siteSettings,
  contentSections,
} from "../src/db/schema";
import { sql } from "drizzle-orm";

// Helper functions
const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const randomPrice = (min: number, max: number) =>
  (Math.random() * (max - min) + min).toFixed(2);
const randomDate = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

// Data arrays for variety
const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
const colors = [
  "Black",
  "White",
  "Navy",
  "Gray",
  "Beige",
  "Olive",
  "Burgundy",
  "Brown",
];
const orderStatuses = [
  "pending",
  "processing",
  "paid",
  "shipped",
  "delivered",
] as const;

async function seed() {
  console.log("🌱 Starting comprehensive seed...\n");

  try {
    // Clean existing data (order matters for FK constraints)
    console.log("🧹 Cleaning existing data...");
    await db.delete(orderItems);
    await db.delete(reviews);
    await db.delete(orders);
    await db.delete(productImages);
    await db.delete(productVariants);
    await db.delete(products);
    await db.delete(categories);
    await db.delete(coupons);
    await db.delete(contentSections);
    await db.delete(siteSettings);

    // 1. Create users
    console.log("\n👤 Creating users...");
    const [existingAdmin] = await db
      .select()
      .from(user)
      .where(sql`${user.email} = 'admin@valkyrie.com'`)
      .limit(1);

    let adminUserId: string;
    if (!existingAdmin) {
      const [newAdmin] = await db
        .insert(user)
        .values({
          id: crypto.randomUUID(),
          name: "Admin User",
          email: "admin@valkyrie.com",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      adminUserId = newAdmin.id;
    } else {
      adminUserId = existingAdmin.id;
    }

    await db
      .insert(userProfiles)
      .values({
        userId: adminUserId,
        role: "super_admin",
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: { role: "super_admin" },
      });
    console.log("  ✅ Admin user ready");

    // 2. Create categories with hierarchy
    console.log("\n📁 Creating categories...");
    const categoryData = [
      // Parent categories
      {
        name: "Men",
        slug: "men",
        description: "Men's collection",
        displayOrder: 1,
      },
      {
        name: "Women",
        slug: "women",
        description: "Women's collection",
        displayOrder: 2,
      },
      {
        name: "Accessories",
        slug: "accessories",
        description: "Fashion accessories",
        displayOrder: 3,
      },
      {
        name: "New Arrivals",
        slug: "new",
        description: "Latest products",
        displayOrder: 4,
      },
      {
        name: "Sale",
        slug: "sale",
        description: "Discounted items",
        displayOrder: 5,
      },
    ];

    const createdCategories = await db
      .insert(categories)
      .values(categoryData.map((c) => ({ ...c, isActive: true })))
      .returning();

    // Subcategories
    const subCategoryData = [
      {
        name: "T-Shirts",
        slug: "men-tshirts",
        parentId: createdCategories[0].id,
        displayOrder: 1,
      },
      {
        name: "Shirts",
        slug: "men-shirts",
        parentId: createdCategories[0].id,
        displayOrder: 2,
      },
      {
        name: "Pants",
        slug: "men-pants",
        parentId: createdCategories[0].id,
        displayOrder: 3,
      },
      {
        name: "Dresses",
        slug: "women-dresses",
        parentId: createdCategories[1].id,
        displayOrder: 1,
      },
      {
        name: "Tops",
        slug: "women-tops",
        parentId: createdCategories[1].id,
        displayOrder: 2,
      },
      {
        name: "Skirts",
        slug: "women-skirts",
        parentId: createdCategories[1].id,
        displayOrder: 3,
      },
      {
        name: "Bags",
        slug: "bags",
        parentId: createdCategories[2].id,
        displayOrder: 1,
      },
    ];

    const createdSubCategories = await db
      .insert(categories)
      .values(
        subCategoryData.map((c) => ({
          ...c,
          isActive: true,
          description: `${c.name} collection`,
        }))
      )
      .returning();

    const allCategories = [...createdCategories, ...createdSubCategories];
    console.log(`  ✅ Created ${allCategories.length} categories`);

    // 3. Create products
    console.log("\n👕 Creating products...");
    const productTemplates = [
      // Men's T-Shirts
      { name: "Essential Cotton Tee", base: 29.99, cat: "men-tshirts" },
      { name: "Graphic Print T-Shirt", base: 34.99, cat: "men-tshirts" },
      { name: "V-Neck Basic Tee", base: 27.99, cat: "men-tshirts" },
      { name: "Oversized Streetwear Tee", base: 39.99, cat: "men-tshirts" },
      { name: "Henley Long Sleeve", base: 44.99, cat: "men-tshirts" },
      // Men's Shirts
      { name: "Oxford Button-Down", base: 69.99, cat: "men-shirts" },
      { name: "Linen Summer Shirt", base: 59.99, cat: "men-shirts" },
      { name: "Flannel Check Shirt", base: 54.99, cat: "men-shirts" },
      { name: "Denim Western Shirt", base: 74.99, cat: "men-shirts" },
      // Men's Pants
      { name: "Slim Fit Chinos", base: 79.99, cat: "men-pants" },
      { name: "Classic Denim Jeans", base: 89.99, cat: "men-pants" },
      { name: "Jogger Sweatpants", base: 54.99, cat: "men-pants" },
      { name: "Tailored Dress Pants", base: 99.99, cat: "men-pants" },
      // Women's Dresses
      { name: "Floral Midi Dress", base: 89.99, cat: "women-dresses" },
      { name: "Little Black Dress", base: 79.99, cat: "women-dresses" },
      { name: "Maxi Summer Dress", base: 99.99, cat: "women-dresses" },
      { name: "Wrap Cocktail Dress", base: 109.99, cat: "women-dresses" },
      { name: "Casual Shirt Dress", base: 69.99, cat: "women-dresses" },
      // Women's Tops
      { name: "Silk Blouse", base: 79.99, cat: "women-tops" },
      { name: "Cropped Tank Top", base: 29.99, cat: "women-tops" },
      { name: "Off-Shoulder Top", base: 44.99, cat: "women-tops" },
      { name: "Knit Sweater", base: 69.99, cat: "women-tops" },
      { name: "Peplum Blouse", base: 54.99, cat: "women-tops" },
      // Women's Skirts
      { name: "Pleated Midi Skirt", base: 59.99, cat: "women-skirts" },
      { name: "Denim Mini Skirt", base: 49.99, cat: "women-skirts" },
      { name: "A-Line Maxi Skirt", base: 69.99, cat: "women-skirts" },
      // Bags
      { name: "Leather Tote Bag", base: 149.99, cat: "bags" },
      { name: "Canvas Crossbody", base: 59.99, cat: "bags" },
      { name: "Mini Backpack", base: 79.99, cat: "bags" },
      { name: "Clutch Evening Bag", base: 89.99, cat: "bags" },
      // Accessories (parent)
      { name: "Leather Belt", base: 45.0, cat: "accessories" },
      { name: "Silk Scarf", base: 39.99, cat: "accessories" },
      { name: "Wool Beanie", base: 29.99, cat: "accessories" },
      { name: "Aviator Sunglasses", base: 89.99, cat: "accessories" },
      { name: "Classic Watch", base: 199.99, cat: "accessories" },
    ];

    const productValues = productTemplates.map((p, i) => {
      const category =
        allCategories.find((c) => c.slug === p.cat) || allCategories[0];
      const hasSale = Math.random() > 0.7;
      return {
        name: p.name,
        slug: p.name.toLowerCase().replace(/\s+/g, "-"),
        description: `Premium quality ${p.name.toLowerCase()} from Valkyrie's exclusive collection.`,
        sku: `VLK-${String(i + 100).padStart(3, "0")}`,
        basePrice: p.base.toFixed(2),
        salePrice: hasSale ? (p.base * 0.8).toFixed(2) : null,
        categoryId: category.id,
        isActive: true,
        isFeatured: Math.random() > 0.7,
      };
    });

    const createdProducts = await db
      .insert(products)
      .values(productValues)
      .returning();
    console.log(`  ✅ Created ${createdProducts.length} products`);

    // 4. Create variants for each product
    console.log("\n📦 Creating variants...");
    const variantValues = createdProducts.flatMap((product) => {
      const productColors = colors.slice(0, randomInt(2, 4));
      const productSizes = sizes.slice(0, randomInt(4, 6));
      return productColors.flatMap((color) =>
        productSizes.map((size) => ({
          productId: product.id,
          sku: `${product.sku}-${size}-${color.slice(0, 3).toUpperCase()}`,
          size,
          color,
          stockQuantity: randomInt(0, 50),
          priceAdjustment: size === "XXL" ? "5.00" : "0.00",
          isAvailable: Math.random() > 0.1,
        }))
      );
    });

    await db.insert(productVariants).values(variantValues);
    console.log(`  ✅ Created ${variantValues.length} variants`);

    // 5. Create product images
    console.log("\n🖼️  Creating product images...");
    const imageValues = createdProducts.flatMap((product) => [
      {
        productId: product.id,
        imageUrl: `https://picsum.photos/seed/${product.id}-1/800/1000`,
        altText: `${product.name} - Main`,
        displayOrder: 0,
        isPrimary: true,
      },
      {
        productId: product.id,
        imageUrl: `https://picsum.photos/seed/${product.id}-2/800/1000`,
        altText: `${product.name} - Back`,
        displayOrder: 1,
        isPrimary: false,
      },
    ]);

    await db.insert(productImages).values(imageValues);
    console.log(`  ✅ Created ${imageValues.length} product images`);

    // 6. Create orders
    console.log("\n🛒 Creating orders...");
    const orderValues = Array.from({ length: 25 }, (_, i) => ({
      orderNumber: `VLK-${new Date().getFullYear()}-${String(i + 1).padStart(4, "0")}`,
      userId: adminUserId,
      status: orderStatuses[randomInt(0, orderStatuses.length - 1)],
      subtotal: randomPrice(50, 300),
      taxAmount: randomPrice(5, 30),
      shippingAmount: "9.99",
      totalAmount: randomPrice(60, 340),
      shippingAddress: `${randomInt(100, 999)} ${["Main", "Oak", "Pine", "Elm"][randomInt(0, 3)]} St, City, Country`,
      billingAddress: `${randomInt(100, 999)} ${["Main", "Oak", "Pine", "Elm"][randomInt(0, 3)]} St, City, Country`,
      createdAt: randomDate(randomInt(0, 30)),
    }));

    const createdOrders = await db
      .insert(orders)
      .values(orderValues)
      .returning();
    console.log(`  ✅ Created ${createdOrders.length} orders`);

    // 7. Create order items
    console.log("\n📝 Creating order items...");
    const orderItemValues = createdOrders.flatMap((order) => {
      const itemCount = randomInt(1, 4);
      const selectedProducts = createdProducts
        .sort(() => Math.random() - 0.5)
        .slice(0, itemCount);

      return selectedProducts.map((product) => ({
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        quantity: randomInt(1, 3),
        unitPrice: product.basePrice,
        totalPrice: (parseFloat(product.basePrice) * randomInt(1, 3)).toFixed(
          2
        ),
      }));
    });

    await db.insert(orderItems).values(orderItemValues);
    console.log(`  ✅ Created ${orderItemValues.length} order items`);

    // 8. Create reviews
    console.log("\n⭐ Creating reviews...");
    const reviewTitles = [
      "Great quality!",
      "Love it!",
      "Perfect fit",
      "Exceeded expectations",
      "Very comfortable",
      "Stylish and well-made",
      "Good value for money",
      "Will buy again",
      "Runs a bit small",
      "Decent for the price",
    ];
    const reviewComments = [
      "Absolutely love this piece. The material is high quality and the fit is perfect.",
      "Really happy with my purchase. Arrived quickly and looks even better in person.",
      "Great addition to my wardrobe. Gets compliments every time I wear it.",
      "The quality is outstanding for this price point. Highly recommend.",
      "Comfortable to wear all day. The fabric is soft and breathable.",
      "Nice design and good stitching. You can tell it's well-made.",
      "Ordered a second one in a different color. That's how much I like it.",
      "Fits true to size. Very pleased with the purchase.",
      "Slightly smaller than expected, but still looks great. Size up if in doubt.",
      "Solid quality. Not the softest material but very durable.",
    ];

    // Pick ~15 random products to review
    const productsToReview = createdProducts
      .sort(() => Math.random() - 0.5)
      .slice(0, 15);

    const reviewValues = productsToReview.map((product, i) => ({
      productId: product.id,
      userId: adminUserId,
      rating: randomInt(3, 5),
      title: reviewTitles[i % reviewTitles.length],
      comment: reviewComments[i % reviewComments.length],
      isVerifiedPurchase: Math.random() > 0.3,
      isApproved: true,
    }));

    await db.insert(reviews).values(reviewValues);
    console.log(`  ✅ Created ${reviewValues.length} reviews`);

    // 9. Create coupons
    console.log("\n🏷️  Creating coupons...");
    const couponValues = [
      {
        code: "WELCOME10",
        description: "10% off your first order",
        discountType: "percentage" as const,
        discountValue: "10.00",
        minPurchaseAmount: "50.00",
        usageLimit: 1000,
        perUserLimit: 1,
        isActive: true,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      },
      {
        code: "SUMMER25",
        description: "25% off summer collection",
        discountType: "percentage" as const,
        discountValue: "25.00",
        minPurchaseAmount: "100.00",
        maxDiscountAmount: "75.00",
        usageLimit: 500,
        perUserLimit: 2,
        isActive: true,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      },
      {
        code: "FLAT20",
        description: "$20 off orders over $150",
        discountType: "fixed" as const,
        discountValue: "20.00",
        minPurchaseAmount: "150.00",
        usageLimit: 200,
        perUserLimit: 1,
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      {
        code: "VIP50",
        description: "50% off for VIP members",
        discountType: "percentage" as const,
        discountValue: "50.00",
        minPurchaseAmount: "200.00",
        maxDiscountAmount: "150.00",
        usageLimit: 50,
        perUserLimit: 1,
        isActive: true,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      },
      {
        code: "FREESHIP",
        description: "Free shipping on any order",
        discountType: "fixed" as const,
        discountValue: "9.99",
        usageLimit: 300,
        perUserLimit: 3,
        isActive: true,
        expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days
      },
    ];

    await db.insert(coupons).values(couponValues);
    console.log(`  ✅ Created ${couponValues.length} coupons`);

    // 10. Create site settings
    console.log("\n⚙️  Creating site settings...");
    await db.insert(siteSettings).values({
      storeName: "Valkyrie",
      storeTagline: "Premium Streetwear for the Bold",
      logoUrl: "/logo/VAL-LOGO.png",
      contactEmail: "support@valkyrie.com",
      contactPhone: "+1 (555) 123-4567",
      instagramUrl: "https://instagram.com/valkyrie",
      facebookUrl: "https://facebook.com/valkyrie",
      twitterUrl: "https://twitter.com/valkyrie",
      tiktokUrl: "https://tiktok.com/@valkyrie",
      currency: "USD",
      locale: "en-US",
      timezone: "UTC",
      defaultMetaTitle: "Valkyrie - Premium Streetwear",
      defaultMetaDescription:
        "Discover premium streetwear at Valkyrie. Shop the latest in men's and women's fashion, accessories, and more.",
    });
    console.log("  ✅ Created site settings");

    // 11. Create content sections
    console.log("\n📄 Creating content sections...");
    const contentSectionValues = [
      {
        sectionType: "hero",
        content: JSON.stringify({
          title: "Redefine Your Style",
          subtitle:
            "Premium streetwear crafted for those who dare to stand out",
          overlayOpacity: 40,
          ctaText: "Shop Now",
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
          messages: [
            { text: "Free shipping on orders over $200" },
            { text: "New arrivals dropping every week" },
            { text: "Use code WELCOME10 for 10% off your first order" },
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
        sectionType: "newsletter",
        content: JSON.stringify({
          title: "Join the Valkyrie Community",
          subtitle: "Subscribe for exclusive offers and updates",
          incentive: "Get 10% off your first order",
          buttonText: "Subscribe",
          privacyText: "By subscribing, you agree to our Privacy Policy.",
        }),
        displayOrder: 5,
        isActive: true,
        version: 1,
      },
      {
        sectionType: "instagram",
        content: JSON.stringify({
          handle: "@valkyrie",
          profileUrl: "https://instagram.com/valkyrie",
          images: [],
        }),
        displayOrder: 6,
        isActive: true,
        version: 1,
      },
      {
        sectionType: "brand_story",
        content: JSON.stringify({
          preheading: "Our Story",
          title: "Built for the Bold",
          paragraphs: [
            "Valkyrie was founded with a simple mission: to make premium streetwear accessible to everyone.",
            "What started as a small online boutique has grown into a destination for fashion-forward individuals seeking quality, style, and authenticity.",
          ],
          imagePosition: "left",
          ctaText: "Learn More",
          ctaLink: "/about",
        }),
        displayOrder: 4,
        isActive: true,
        version: 1,
      },
    ];

    await db.insert(contentSections).values(contentSectionValues);
    console.log(`  ✅ Created ${contentSectionValues.length} content sections`);

    // Summary
    console.log("\n✨ Seed completed successfully!\n");
    console.log("📋 Summary:");
    console.log(`  - 1 admin user (admin@valkyrie.com)`);
    console.log(`  - ${allCategories.length} categories`);
    console.log(`  - ${createdProducts.length} products`);
    console.log(`  - ${variantValues.length} variants`);
    console.log(`  - ${imageValues.length} images`);
    console.log(`  - ${createdOrders.length} orders`);
    console.log(`  - ${orderItemValues.length} order items`);
    console.log(`  - ${reviewValues.length} reviews`);
    console.log(`  - ${couponValues.length} coupons`);
    console.log(`  - 1 site settings (Valkyrie)`);
    console.log(`  - ${contentSectionValues.length} content sections`);
    console.log("\n🔑 Admin: admin@valkyrie.com\n");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  }

  process.exit(0);
}

seed();
