/**
 * Coupon Domain Container
 */

import { DrizzleCouponRepository } from "@/infrastructure/database/repositories/coupons/coupon.repository";
import { ValidateCouponUseCase } from "./use-cases/validate-coupon.use-case";

export function createCouponModule() {
  let repo: DrizzleCouponRepository | undefined;
  const getCouponRepository = () =>
    (repo ??= new DrizzleCouponRepository());

  let validate: ValidateCouponUseCase | undefined;

  return {
    getCouponRepository,
    getValidateCouponUseCase: () =>
      (validate ??= new ValidateCouponUseCase(getCouponRepository())),
  };
}

export type CouponModule = ReturnType<typeof createCouponModule>;
