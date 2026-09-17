import { Loader2, MapPin, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderAddress } from "@/domain/orders/entities/order.entity";
import { Button } from "@/components/ui/button";

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

export function AddressesCard({
  hasShippingAddress,
  address,
  isRevealing,
  onReveal,
}: {
  hasShippingAddress: boolean;
  address: OrderAddress | null | undefined;
  isRevealing: boolean;
  onReveal: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <MapPin className="h-5 w-5 text-primary" />
        <CardTitle>Delivery details</CardTitle>
      </CardHeader>
      <CardContent>
        {address !== undefined ? (
          <AddressBlock address={address} />
        ) : hasShippingAddress ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Address and phone are hidden. Revealing them is recorded in your
                access history.
              </p>
            </div>
            <Button onClick={onReveal} disabled={isRevealing}>
              {isRevealing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Show delivery details
            </Button>
          </div>
        ) : (
          <AddressBlock address={null} />
        )}
      </CardContent>
    </Card>
  );
}
