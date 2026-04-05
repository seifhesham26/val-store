import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AppRouter } from "@/server";
import { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type AddressList = RouterOutputs["public"]["address"]["list"];

export function CheckoutAddressSelection({
  addresses,
  selectedAddressId,
  onAddressChange,
}: {
  addresses: AddressList;
  selectedAddressId: string;
  onAddressChange: (val: string) => void;
}) {
  return (
    <Card className="bg-[#111] border-white/10 shadow-2xl rounded-xl overflow-hidden">
      <CardHeader>
        <CardTitle className="text-white">Delivery Address</CardTitle>
        <CardDescription className="text-gray-400">
          Default address is preselected.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedAddressId}
          onValueChange={onAddressChange}
          className="space-y-3"
        >
          {addresses.map((a) => (
            <div
              key={a.id}
              className={`flex items-start gap-3 rounded-lg border p-4 transition-all duration-200 cursor-pointer ${
                selectedAddressId === a.id
                  ? "border-val-accent bg-val-accent/5"
                  : "border-white/10 hover:border-white/30 hover:bg-[#1a1a1a]"
              }`}
              onClick={() => onAddressChange(a.id)}
            >
              <RadioGroupItem
                value={a.id}
                id={`addr-${a.id}`}
                className="mt-1"
              />
              <div className="flex-1">
                <Label
                  htmlFor={`addr-${a.id}`}
                  className="font-medium text-white"
                >
                  {a.name} {a.isDefault ? "(Default)" : ""}
                </Label>
                <div className="text-sm text-gray-400 mt-1">
                  <div>{a.street}</div>
                  <div>
                    {a.city}
                    {a.state ? `, ${a.state}` : ""}
                    {a.zipCode ? ` ${a.zipCode}` : ""}
                  </div>
                  {a.country ? <div>{a.country}</div> : null}
                  <div>{a.phone}</div>
                </div>
              </div>
            </div>
          ))}
        </RadioGroup>

        <div className="mt-6">
          <Button variant="outline" asChild>
            <Link href="/account/addresses">Manage addresses</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
