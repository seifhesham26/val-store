import { Truck, Clock, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * What the store actually charges for shipping.
 *
 * This page advertised $5.99 / $14.99 / $24.99+ tiers and free delivery over
 * $100. None of that was true in two separate ways: `CreateOrderUseCase`
 * hardcodes `shippingCost = 0`, so every order ships free and the checkout
 * summary has always rendered "Free" — and the amounts were denominated in
 * dollars on a store whose entire currency layer resolves to EGP.
 *
 * Everything *computed* goes through `formatCurrency`; this was hand-written
 * copy that neither the currency sweep nor the pricing work ever looked at.
 * It now says what the system does. If paid shipping is wanted later,
 * `shippingCost` is already a first-class field on the order and
 * `OrderEntity.validateTotal()` will hold the implementation to it — but the
 * copy should follow that change, not lead it.
 */
export function ShippingOptions() {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Standard Delivery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold mb-2">Free</p>
          <p className="text-muted-foreground">5-7 business days</p>
          <p className="text-sm text-muted-foreground mt-2">
            On every order, with no minimum
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Processing Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold mb-2">1-2 days</p>
          <p className="text-muted-foreground">Before your order ships</p>
          <p className="text-sm text-muted-foreground mt-2">
            You will be notified when it is on its way
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Cash on Delivery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold mb-2">Available</p>
          <p className="text-muted-foreground">Pay when your order arrives</p>
          <p className="text-sm text-muted-foreground mt-2">
            Card payment is also available at checkout
          </p>
        </CardContent>
      </Card>
    </>
  );
}
