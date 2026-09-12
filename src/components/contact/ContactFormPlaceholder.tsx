import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ContactFormPlaceholder() {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Send us a Message</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Contact form coming soon. In the meantime, please email us at{" "}
          <a
            href="mailto:support@valkyrie-eg.com"
            className="text-primary hover:underline"
          >
            support@valkyrie-eg.com
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
