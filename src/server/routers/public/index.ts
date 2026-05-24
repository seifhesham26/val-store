/**
 * Public Router
 *
 * Aggregates all public (no-auth) endpoints for the storefront.
 * Uses publicProcedure - no authentication required.
 * Cart, Checkout, and Orders use protectedProcedure (requires login).
 */

import { router } from "../../trpc";
import { publicProductsRouter } from "./products";
import { publicCategoriesRouter } from "./categories";
import { publicConfigRouter } from "./config";
import { cartRouter } from "./cart";
import { checkoutRouter } from "./checkout";
import { ordersRouter } from "./orders";
import { wishlistRouter } from "./wishlist";
import { addressRouter } from "./address";
import { userRouter } from "./user";
import { profileRouter } from "./profile";
import { publicCouponsRouter } from "./coupons";
import { publicReviewsRouter } from "./reviews";
import { publicNotificationsRouter } from "./notifications";
import { newsletterRouter } from "./newsletter";

export const publicRouter = router({
  products: publicProductsRouter,
  categories: publicCategoriesRouter,
  config: publicConfigRouter,
  cart: cartRouter,
  checkout: checkoutRouter,
  orders: ordersRouter,
  wishlist: wishlistRouter,
  address: addressRouter,
  user: userRouter,
  profile: profileRouter,
  coupons: publicCouponsRouter,
  reviews: publicReviewsRouter,
  notifications: publicNotificationsRouter,
  newsletter: newsletterRouter,
});
