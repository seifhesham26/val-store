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
  };
}

// Export singleton instance
export const container = createContainer();
