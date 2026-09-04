"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useCartStock } from "@/components/providers/cart-stock-provider";
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

  const { hasProblems, revalidate, openDialog } = useCartStock();
  const [isVerifyingStock, setIsVerifyingStock] = useState(false);

  const defaultAddressId = useMemo(() => {
    const def = addresses.find((a) => a.isDefault);
    return def?.id ?? addresses[0]?.id ?? "";
  }, [addresses]);

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null
  );

  const effectiveSelectedAddressId = selectedAddressId ?? defaultAddressId;

  // Billing address. Defaults to "same as shipping" — the checkbox starts
  // checked — so the common case needs no extra input from the customer.
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [selectedBillingAddressId, setSelectedBillingAddressId] = useState<
    string | null
  >(null);

  const defaultBillingAddressId = useMemo(() => {
    // Prefer an address the customer has already tagged "billing"; fall back
    // to the same default the shipping picker uses.
    const billingTagged = addresses.find((a) => a.addressType === "billing");
    return billingTagged?.id ?? defaultAddressId;
  }, [addresses, defaultAddressId]);

  const effectiveBillingAddressId = billingSameAsShipping
    ? effectiveSelectedAddressId
    : (selectedBillingAddressId ?? defaultBillingAddressId);

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
    createStripeSession.isPending ||
    createCodOrder.isPending ||
    isVerifyingStock;

  const placeOrder = async () => {
    if (!effectiveSelectedAddressId) {
      toast.error("Please select an address");
      return;
    }

    if (!billingSameAsShipping && !effectiveBillingAddressId) {
      toast.error("Please select a billing address");
      return;
    }

    // Last checkpoint before money moves. The order transaction still holds the
    // authoritative lock, but reaching it with a cart we already know is
    // unfillable means the customer gets an error instead of a choice.
    setIsVerifyingStock(true);
    try {
      const problems = await revalidate();
      if (problems.length > 0) {
        openDialog();
        return;
      }
    } catch {
      // A failed check must not block a valid order — the transaction below is
      // still authoritative.
    } finally {
      setIsVerifyingStock(false);
    }

    // No coupon is sent. The cart holds the applied code and the server reads
    // it from there, so there is one source of truth and the client is not it.
    if (paymentMethod === "stripe") {
      const res = await createStripeSession.mutateAsync({
        shippingAddressId: effectiveSelectedAddressId,
        billingAddressId: effectiveBillingAddressId,
      });
      if (res?.url) {
        window.location.href = res.url;
      }
      return;
    }

    const res = await createCodOrder.mutateAsync({
      shippingAddressId: effectiveSelectedAddressId,
      billingAddressId: effectiveBillingAddressId,
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

            <div className="flex items-center gap-2">
              <Checkbox
                id="billing-same-as-shipping"
                checked={billingSameAsShipping}
                onCheckedChange={(checked) =>
                  setBillingSameAsShipping(checked === true)
                }
              />
              <Label
                htmlFor="billing-same-as-shipping"
                className="text-white cursor-pointer"
              >
                Billing address same as shipping
              </Label>
            </div>

            {!billingSameAsShipping && (
              <CheckoutAddressSelection
                addresses={addresses}
                selectedAddressId={effectiveBillingAddressId}
                onAddressChange={setSelectedBillingAddressId}
                title="Billing Address"
                description="Used to verify your payment method."
              />
            )}

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
              {hasProblems ? (
                <Button
                  onClick={openDialog}
                  className="h-14 flex-1 bg-amber-500 text-black hover:bg-amber-500/90 text-lg font-medium"
                >
                  Review stock changes
                </Button>
              ) : (
                <Button
                  onClick={placeOrder}
                  disabled={isPlacingOrder}
                  className="h-14 flex-1 bg-val-accent text-white hover:bg-val-accent/90 text-lg font-medium"
                >
                  {isVerifyingStock
                    ? "Checking stock..."
                    : isPlacingOrder
                      ? "Processing..."
                      : "Complete Order"}
                </Button>
              )}
            </div>
          </div>

          {/* Right Column: Order Summary sticky */}
          <div className="lg:col-span-5 mt-10 lg:mt-0">
            <div className="sticky top-24 lg:top-32 w-full">
              <CheckoutOrderSummary />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
