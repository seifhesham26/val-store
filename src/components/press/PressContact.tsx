import { Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PressContact() {
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Media Enquiries
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-2">
          For interviews, product images, or any other press request, reach out
          and we&apos;ll get back to you.
        </p>
        <a
          href="mailto:support@valstore.com"
          className="text-primary hover:underline"
        >
          support@valstore.com
        </a>
      </CardContent>
    </Card>
  );
}
