import { CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ReturnsContent() {
  return (
    <div className="prose-val max-w-none">
      <h2>Return Eligibility</h2>

      <div className="grid md:grid-cols-2 gap-8 not-prose mb-8">
        <Card className="border-green-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-500">
              <CheckCircle className="h-5 w-5" />
              Eligible for Return
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>• Unworn items with tags attached</li>
              <li>• Items in original packaging</li>
              <li>• Items returned within 30 days</li>
              <li>• Defective or damaged items</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <XCircle className="h-5 w-5" />
              Not Eligible
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>• Worn or washed items</li>
              <li>• Items without tags</li>
              <li>• Final sale items</li>
              <li>• Items returned after 30 days</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <h2>How to Start a Return</h2>
      <ol>
        <li>Log into your account and go to Order History</li>
        <li>Select the order and items you wish to return</li>
        <li>Choose return or exchange and select a reason</li>
        <li>Print the prepaid shipping label</li>
        <li>Drop off at any carrier location</li>
      </ol>

      <p>
        Refunds are processed within 5-7 business days after we receive your
        return.
      </p>
    </div>
  );
}
