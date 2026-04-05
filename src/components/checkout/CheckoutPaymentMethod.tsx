import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type PaymentMethod = "stripe" | "cash_on_delivery";

export function CheckoutPaymentMethod({
  paymentMethod,
  onPaymentMethodChange,
}: {
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (val: PaymentMethod) => void;
}) {
  return (
    <Card className="bg-[#111] border-white/10 shadow-2xl rounded-xl overflow-hidden">
      <CardHeader>
        <CardTitle className="text-white">Payment Method</CardTitle>
        <CardDescription className="text-gray-400">
          Shipping is paid on delivery. Online payments are via Stripe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={paymentMethod}
          onValueChange={(v) => onPaymentMethodChange(v as PaymentMethod)}
          className="space-y-3"
        >
          <div
            className={`flex items-start gap-3 rounded-lg border p-4 transition-all duration-200 cursor-pointer ${
              paymentMethod === "cash_on_delivery"
                ? "border-val-accent bg-val-accent/5"
                : "border-white/10 hover:border-white/30 hover:bg-[#1a1a1a]"
            }`}
            onClick={() => onPaymentMethodChange("cash_on_delivery")}
          >
            <RadioGroupItem
              value="cash_on_delivery"
              id="pm-cod"
              className="mt-1"
            />
            <div>
              <Label
                htmlFor="pm-cod"
                className="font-medium cursor-pointer text-white"
              >
                Cash on Delivery
              </Label>
              <div className="text-sm text-gray-400 mt-1">
                Pay the delivery person when your order arrives.
              </div>
            </div>
          </div>

          <div
            className={`flex items-start gap-3 rounded-lg border p-4 transition-all duration-200 cursor-pointer ${
              paymentMethod === "stripe"
                ? "border-val-accent bg-val-accent/5"
                : "border-white/10 hover:border-white/30 hover:bg-[#1a1a1a]"
            }`}
            onClick={() => onPaymentMethodChange("stripe")}
          >
            <RadioGroupItem value="stripe" id="pm-stripe" className="mt-1" />
            <div>
              <Label
                htmlFor="pm-stripe"
                className="font-medium cursor-pointer text-white"
              >
                Card
              </Label>
              <div className="text-sm text-gray-400 mt-1">
                You will be redirected to the payment gateway to complete
                payment.
              </div>
            </div>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
