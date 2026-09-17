/**
 * Basic Database Seed Script
 *
 * Seeds essential data for development/testing:
 * - Admin user with super_admin role
 * - Sample categories
 * - Sample products
 * - Sample orders
 *
 * Run with: npx tsx scripts/seed-basic.ts
 */

import { db } from "../src/db";
import {
  user,
  userProfiles,
  categories,
  products,
  productVariants,
  orders,
  orderItems,
} from "../src/db/schema";
import { sql } from "drizzle-orm";
import { DEVELOPMENT_SEED_STOCK_QUANTITY } from "../src/lib/seed-inventory";

async function seed() {
  console.log("🌱 Starting basic seed...\n");

  try {
    // Clean existing data (in reverse order of dependencies)
    console.log("🧹 Cleaning existing data...");
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(productVariants);
    await db.delete(products);
    await db.delete(categories);
    await db.delete(userProfiles);
    // Note: Don't delete users - Better Auth manages them

    // 1. Create admin user profile (assumes admin@valkyrie.com exists in Better Auth)
    console.log("👤 Creating admin user profile...");

    // First, check if admin user exists in Better Auth users table
    const [existingAdmin] = await db
      .select()
      .from(user)
      .where(sql`${user.email} = 'admin@valkyrie.com'`)
      .limit(1);

    let adminUserId: string;

    if (!existingAdmin) {
      // Create admin user in Better Auth users table
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
      console.log("  ✅ Created admin user in auth table");
    } else {
      adminUserId = existingAdmin.id;
      console.log("  ✅ Admin user already exists in auth table");
    }

    // Create user profile with super_admin role
    await db.insert(userProfiles).values({
      userId: adminUserId,
      role: "super_admin",
    });
    console.log("  ✅ Created admin profile with super_admin role");

    // 2. Create categories
    console.log("\n📁 Creating categories...");
    const [menCategory] = await db
      .insert(categories)
      .values({
        name: "Men",
        slug: "men",
        description: "Men's clothing collection",
        isActive: true,
        displayOrder: 1,
      })
      .returning();

    const [womenCategory] = await db
      .insert(categories)
      .values({
        name: "Women",
        slug: "women",
        description: "Women's clothing collection",
        isActive: true,
        displayOrder: 2,
      })
      .returning();

    const [accessoriesCategory] = await db
      .insert(categories)
      .values({
        name: "Accessories",
        slug: "accessories",
        description: "Fashion accessories",
        isActive: true,
        displayOrder: 3,
      })
      .returning();

    console.log(`  ✅ Created ${3} categories`);

    // 3. Create products
    console.log("\n👕 Creating products...");
    const productData = [
      {
        name: "Classic Cotton T-Shirt",
        slug: "classic-cotton-tshirt",
        description: "Premium cotton t-shirt for everyday comfort",
        sku: "TSH-001",
        basePrice: "29.99",
        categoryId: menCategory.id,
        isActive: true,
        isFeatured: true,
      },
      {
        name: "Slim Fit Jeans",
        slug: "slim-fit-jeans",
        description: "Modern slim fit denim jeans",
        sku: "JNS-001",
        basePrice: "89.99",
        salePrice: "69.99",
        categoryId: menCategory.id,
        isActive: true,
        isFeatured: true,
      },
      {
        name: "Summer Floral Dress",
        slug: "summer-floral-dress",
        description: "Light and breezy floral print dress",
        sku: "DRS-001",
        basePrice: "79.99",
        categoryId: womenCategory.id,
        isActive: true,
        isFeatured: true,
      },
      {
        name: "Leather Belt",
        slug: "leather-belt",
        description: "Genuine leather belt with brass buckle",
        sku: "ACC-001",
        basePrice: "45.00",
        categoryId: accessoriesCategory.id,
        isActive: true,
        isFeatured: false,
      },
      {
        name: "Wool Blend Sweater",
        slug: "wool-blend-sweater",
        description: "Cozy wool blend sweater for cold days",
        sku: "SWT-001",
        basePrice: "99.99",
        salePrice: "79.99",
        categoryId: menCategory.id,
        isActive: true,
        isFeatured: false,
      },
    ];

    const createdProducts = await db
      .insert(products)
      .values(productData)
      .returning();

    console.log(`  ✅ Created ${createdProducts.length} products`);

    // 4. Create product variants
    console.log("\n📦 Creating product variants...");
    const variantData = createdProducts.flatMap((product) => [
      {
        productId: product.id,
        sku: `${product.sku}-S`,
        size: "S",
        color: "Black",
        stockQuantity: DEVELOPMENT_SEED_STOCK_QUANTITY,
        isAvailable: true,
      },
      {
        productId: product.id,
        sku: `${product.sku}-M`,
        size: "M",
        color: "Black",
        stockQuantity: DEVELOPMENT_SEED_STOCK_QUANTITY,
        isAvailable: true,
      },
      {
        productId: product.id,
        sku: `${product.sku}-L`,
        size: "L",
        color: "Black",
        stockQuantity: DEVELOPMENT_SEED_STOCK_QUANTITY,
        isAvailable: true,
      },
      {
        productId: product.id,
        sku: `${product.sku}-LOW`,
        size: "XL",
        color: "Black",
        stockQuantity: DEVELOPMENT_SEED_STOCK_QUANTITY,
        isAvailable: true,
      },
    ]);

    await db.insert(productVariants).values(variantData);
    console.log(`  ✅ Created ${variantData.length} product variants`);

    // 5. Create sample orders
    console.log("\n🛒 Creating sample orders...");
    const orderData = [
      {
        orderNumber: "ORD-2025-001",
        userId: adminUserId,
        status: "delivered" as const,
        subtotal: "119.98",
        taxAmount: "9.60",
        shippingAmount: "5.00",
        totalAmount: "134.58",
        shippingAddress: "123 Main St, City, Country",
        billingAddress: "123 Main St, City, Country",
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      },
      {
        orderNumber: "ORD-2025-002",
        userId: adminUserId,
        status: "shipped" as const,
        subtotal: "79.99",
        taxAmount: "6.40",
        shippingAmount: "5.00",
        totalAmount: "91.39",
        shippingAddress: "456 Oak Ave, Town, Country",
        billingAddress: "456 Oak Ave, Town, Country",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },
      {
        orderNumber: "ORD-2025-003",
        userId: adminUserId,
        status: "pending" as const,
        subtotal: "45.00",
        taxAmount: "3.60",
        shippingAmount: "5.00",
        totalAmount: "53.60",
        shippingAddress: "789 Pine Rd, Village, Country",
        billingAddress: "789 Pine Rd, Village, Country",
        createdAt: new Date(), // Today
      },
    ];

    const createdOrders = await db.insert(orders).values(orderData).returning();
    console.log(`  ✅ Created ${createdOrders.length} orders`);

    // 6. Create order items
    console.log("\n📝 Creating order items...");
    const orderItemsData = [
      {
        orderId: createdOrders[0].id,
        productId: createdProducts[0].id,
        productName: createdProducts[0].name,
        quantity: 2,
        unitPrice: "29.99",
        totalPrice: "59.98",
      },
      {
        orderId: createdOrders[0].id,
        productId: createdProducts[1].id,
        productName: createdProducts[1].name,
        quantity: 1,
        unitPrice: "59.99",
        totalPrice: "59.99",
      },
      {
        orderId: createdOrders[1].id,
        productId: createdProducts[2].id,
        productName: createdProducts[2].name,
        quantity: 1,
        unitPrice: "79.99",
        totalPrice: "79.99",
      },
      {
        orderId: createdOrders[2].id,
        productId: createdProducts[3].id,
        productName: createdProducts[3].name,
        quantity: 1,
        unitPrice: "45.00",
        totalPrice: "45.00",
      },
    ];

    await db.insert(orderItems).values(orderItemsData);
    console.log(`  ✅ Created ${orderItemsData.length} order items`);

    console.log("\n✨ Seed completed successfully!\n");
    console.log("📋 Summary:");
    console.log("  - 1 admin user (admin@valkyrie.com)");
    console.log("  - 3 categories");
    console.log("  - 5 products");
    console.log("  - 20 product variants (zero recorded stock)");
    console.log("  - 3 orders with items");
    console.log("\n🔑 Admin Login:");
    console.log("  Email: admin@valkyrie.com");
    console.log("  Note: You'll need to set a password via Better Auth\n");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  }

  process.exit(0);
}

seed();
