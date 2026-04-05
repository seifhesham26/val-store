"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useCartStore } from "@/lib/stores/cart-store";
import { CheckoutOrderSummary } from "@/components/checkout/CheckoutOrderSummary";
import { CheckoutAddressSelection } from "@/components/checkout/CheckoutAddressSelection";
import {
  CheckoutPaymentMethod,
  PaymentMethod,
} from "@/components/checkout/CheckoutPaymentMethod";

import { AppRouter } from "@/server";
import { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type AddressList = RouterOutputs["public"]["address"]["list"];

export function CheckoutForm({ addresses }: { addresses: AddressList }) {
  const router = useRouter();

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash_on_delivery");

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    couponId: string;
    discountAmount: number;
    discountType: string;
    discountValue: string;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const subtotal = useCartStore((state) => state.getSubtotal());

  const validateCoupon = trpc.public.coupons.validate.useMutation({
    onSuccess: (result) => {
      if (result.valid && "code" in result) {
        setAppliedCoupon({
          code: result.code,
          couponId: result.couponId,
          discountAmount: result.discountAmount ?? 0,
          discountType: result.discountType,
          discountValue: result.discountValue,
        });
        setCouponCode("");
        setCouponError(null);
      } else if (!result.valid && "error" in result) {
        setCouponError(result.error ?? "Invalid coupon");
      }
    },
    onError: (err) => {
      setCouponError(err.message);
    },
  });

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    setCouponError(null);
    validateCoupon.mutate({ code: couponCode, subtotal });
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
  };

  const defaultAddressId = useMemo(() => {
    const def = addresses.find((a) => a.isDefault);
    return def?.id ?? addresses[0]?.id ?? "";
  }, [addresses]);

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null
  );

  const effectiveSelectedAddressId = selectedAddressId ?? defaultAddressId;

  // Checkout mutations
  const createStripeSession = trpc.public.checkout.createSession.useMutation({
    onError: (err) => {
      toast.error("Failed to start Stripe checkout", {
        description: err.message,
      });
    },
  });

  const createCodOrder = trpc.public.checkout.createCodOrder.useMutation({
    onError: (err) => {
      toast.error("Failed to place order", { description: err.message });
    },
  });

  const isPlacingOrder =
    createStripeSession.isPending || createCodOrder.isPending;

  const placeOrder = async () => {
    if (!effectiveSelectedAddressId) {
      toast.error("Please select an address");
      return;
    }

    if (paymentMethod === "stripe") {
      const res = await createStripeSession.mutateAsync({
        shippingAddressId: effectiveSelectedAddressId,
      });
      if (res?.url) {
        window.location.href = res.url;
      }
      return;
    }

    const res = await createCodOrder.mutateAsync({
      shippingAddressId: effectiveSelectedAddressId,
    });
    router.push(`/checkout/success?order_id=${res.orderId}`);
  };

  return (
    <div className="min-h-screen pt-12 pb-24 bg-[#0a0a0a]">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-8 border-b border-white/10 pb-6">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2">
            Checkout
          </h1>
          <p className="text-gray-400">
            Review your order clearly and select your preferred delivery and
            payment options.
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-12 lg:gap-x-12 lg:items-start">
          {/* Left Column: Address and Payment */}
          <div className="lg:col-span-7 space-y-8">
            <CheckoutAddressSelection
              addresses={addresses}
              selectedAddressId={effectiveSelectedAddressId}
              onAddressChange={setSelectedAddressId}
            />

            <CheckoutPaymentMethod
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
            />

            <div className="flex flex-col sm:flex-row gap-4 pt-6 mt-8 border-t border-white/10">
              <Button
                variant="outline"
                onClick={() => router.push("/cart")}
                className="h-14 sm:w-auto px-8 border-white/2 hover:bg-white/10 hover:text-white"
              >
                Return to Cart
              </Button>
              <Button
                onClick={placeOrder}
                disabled={isPlacingOrder}
                className="h-14 flex-1 bg-val-accent text-white hover:bg-val-accent/90 text-lg font-medium"
              >
                {isPlacingOrder ? "Processing..." : "Complete Order"}
              </Button>
            </div>
          </div>

          {/* Right Column: Order Summary sticky */}
          <div className="lg:col-span-5 mt-10 lg:mt-0">
            <div className="sticky top-24 lg:top-32 w-full">
              <CheckoutOrderSummary
                couponCode={couponCode}
                setCouponCode={setCouponCode}
                appliedCoupon={appliedCoupon}
                onApplyCoupon={handleApplyCoupon}
                onRemoveCoupon={handleRemoveCoupon}
                isValidating={validateCoupon.isPending}
                couponError={couponError}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
