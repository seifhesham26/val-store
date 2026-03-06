import { OrderData } from "./types";
import { MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
          <p className="text-sm whitespace-pre-line">
            {order.shippingAddress || "No shipping address provided"}
          </p>
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
          <p className="text-sm whitespace-pre-line">
            {order.billingAddress || "No billing address provided"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
