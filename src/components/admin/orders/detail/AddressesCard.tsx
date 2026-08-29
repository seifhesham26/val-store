import { OrderData } from "./types";
import { MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderAddress } from "@/domain/orders/entities/order.entity";

function AddressBlock({ address }: { address: OrderAddress | null }) {
  if (!address) {
    return <p className="text-sm text-muted-foreground">No address on file</p>;
  }

  return (
    <address className="text-sm not-italic leading-relaxed">
      <span className="font-medium">{address.fullName}</span>
      <br />
      {address.addressLine1}
      <br />
      {address.addressLine2 && (
        <>
          {address.addressLine2}
          <br />
        </>
      )}
      {[address.city, address.state].filter(Boolean).join(", ")}{" "}
      {address.postalCode}
      <br />
      {address.country}
      <br />
      <a
        href={`tel:${address.phone}`}
        className="mt-1 inline-block text-muted-foreground hover:text-foreground"
      >
        {address.phone}
      </a>
    </address>
  );
}

export function AddressesCard({ order }: { order: OrderData }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <MapPin className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Shipping Address</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <AddressBlock address={order.shippingAddress} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <MapPin className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Billing Address</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <AddressBlock address={order.billingAddress} />
        </CardContent>
      </Card>
    </div>
  );
}
