import { router } from "../../trpc";
import { productsRouter } from "./products";
import { dashboardRouter } from "./dashboard";
import { ordersRouter } from "./orders";
import { variantsRouter } from "./variants";
import { imagesRouter } from "./images";
import { settingsRouter } from "./settings";
import { adminCouponsRouter } from "./coupons";
import { adminReviewsRouter } from "./reviews";
import { adminInventoryRouter } from "./inventory";
import { adminCustomersRouter } from "./customers";
import { adminNotificationsRouter } from "./notifications";
import { categoriesRouter } from "./categories";
import { legalRouter } from "./legal";

export const adminRouter = router({
  products: productsRouter,
  dashboard: dashboardRouter,
  orders: ordersRouter,
  variants: variantsRouter,
  images: imagesRouter,
  settings: settingsRouter,
  coupons: adminCouponsRouter,
  reviews: adminReviewsRouter,
  inventory: adminInventoryRouter,
  customers: adminCustomersRouter,
  notifications: adminNotificationsRouter,
  categories: categoriesRouter,
  legal: legalRouter,
});
