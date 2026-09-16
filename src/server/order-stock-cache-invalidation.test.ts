import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("order-side stock cache invalidation", () => {
  it("invalidates after successful checkout, cancellation, and returns", () => {
    const checkout = read("src/server/routers/public/checkout.ts");
    const adminOrders = read("src/server/routers/admin/orders.ts");

    expect(checkout.match(/revalidateCatalogue\(\)/g)).toHaveLength(2);
    expect(adminOrders.match(/revalidateCatalogue\(\)/g)).toHaveLength(2);
  });

  it("settles every lazy expiry sweep through the shared invalidation helper", () => {
    for (const path of [
      "src/server/routers/public/cart.ts",
      "src/server/routers/public/orders.ts",
      "src/server/routers/admin/orders.ts",
    ]) {
      expect(read(path)).toContain("revalidateAfterExpiredCheckoutSweep(");
    }
  });

  it("invalidates after Stripe expiry cancellation", () => {
    const webhook = read("src/app/api/webhook/stripe/route.ts");
    expect(webhook).toMatch(
      /checkout\.session\.expired[\s\S]*revalidateCatalogue\(\)/
    );
  });
});

describe("shipping quarantine presentation", () => {
  it("maps the repository error only in the admin route", () => {
    const adminOrders = read("src/server/routers/admin/orders.ts");
    const publicOrders = read("src/server/routers/public/orders.ts");
    expect(adminOrders).toContain("InventoryQuarantineError");
    expect(adminOrders).toContain('code: "CONFLICT"');
    expect(publicOrders).not.toContain("InventoryQuarantineError");
  });

  it("renders the operational shipping block in the order detail", () => {
    const detail = read("src/components/admin/orders/OrderDetail.tsx");
    const card = read(
      "src/components/admin/orders/detail/UpdateStatusCard.tsx"
    );
    expect(detail).toContain("shippingBlockMessage");
    expect(card).toContain(
      "We're confirming inventory before this order ships"
    );
  });
});
