/**
 * Dependency Injection Container
 *
 * Slim root container that composes domain modules.
 * Each domain manages its own repositories and use cases.
 */

import { createProductModule } from "./products";
import { createOrderModule } from "./orders";
import { createCategoryModule } from "./categories";
import { createDashboardModule } from "./dashboard";
import { createCartModule } from "./cart";
import { createCheckoutModule } from "./checkout";
import { createWishlistModule } from "./wishlist";
import { createAddressModule } from "./address";
import { createCustomerModule } from "./customers";
import { createServicesModule } from "./services";
import { createCouponModule } from "./coupons";
import { createInventoryModule } from "./inventory";

function createContainer() {
  const products = createProductModule();
  const orders = createOrderModule();
  const categories = createCategoryModule();
  const dashboard = createDashboardModule();
  const cart = createCartModule();
  const checkout = createCheckoutModule({
    getOrderRepository: orders.getOrderRepository,
    getCartRepository: cart.getCartRepository,
  });
  const wishlist = createWishlistModule();
  const address = createAddressModule();
  const customers = createCustomerModule();
  const services = createServicesModule();
  const couponsModule = createCouponModule();
  const inventory = createInventoryModule();

  return {
    // Products
    ...products,
    // Orders
    ...orders,
    // Categories
    ...categories,
    // Dashboard
    ...dashboard,
    // Cart
    ...cart,
    // Checkout
    ...checkout,
    // Wishlist
    ...wishlist,
    // Address
    ...address,
    // Customers
    ...customers,
    // Services
    ...services,
    // Coupons
    ...couponsModule,
    // Inventory
    ...inventory,
  };
}

// Export singleton instance
export const container = createContainer();
