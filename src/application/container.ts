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
import { createNotificationModule } from "./notifications";
import { NextTaskScheduler } from "@/infrastructure/services/next-task-scheduler.service";

function createContainer() {
  // Stateless, so one instance for the process rather than a module of its
  // own. It is how a use case defers work past the response without knowing
  // that "the response" is a Next concept — see the interface for why a bare
  // `void` is not a substitute.
  const taskScheduler = new NextTaskScheduler();

  const products = createProductModule();
  // Inventory and notifications need each other: the notifier reads variant
  // SKUs to say what ran low, and stock adjustments emit notifications. The
  // cycle is broken by passing getters rather than instances — both arrows run
  // on first use, by which time both modules exist.
  const inventory = createInventoryModule({
    getNotificationService: () => notifications.getNotificationService(),
  });
  const notifications = createNotificationModule({
    getInventoryRepository: inventory.getInventoryRepository,
  });
  // `services` is created below; the arrow defers the property access until
  // first use, by which time it exists — the same deferral inventory and
  // notifications use for their cycle.
  const orders = createOrderModule({
    getNotificationService: notifications.getNotificationService,
    getEmailService: () => services.getEmailService(),
  });
  const categories = createCategoryModule();
  const dashboard = createDashboardModule();
  const cart = createCartModule({
    getProductVariantRepository: products.getProductVariantRepository,
  });
  const couponsModule = createCouponModule();
  const checkout = createCheckoutModule({
    getOrderRepository: orders.getOrderRepository,
    getCartRepository: cart.getCartRepository,
    getValidateCouponUseCase: couponsModule.getValidateCouponUseCase,
    getNotificationService: notifications.getNotificationService,
    getSendOrderConfirmationUseCase: orders.getSendOrderConfirmationUseCase,
    // Arrow, not a direct reference: `address` is declared below this call, so
    // reading the property eagerly would hit the temporal dead zone. Same
    // deferral the inventory/notifications cycle uses.
    getAddressRepository: () => address.getAddressRepository(),
    getTaskScheduler: () => taskScheduler,
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
    // Coupons
    ...couponsModule,
    // Inventory
    ...inventory,
    // Notifications
    ...notifications,
  };
}

// Export singleton instance
export const container = createContainer();
