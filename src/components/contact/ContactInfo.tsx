import { Mail, Phone, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCachedSiteSettings } from "@/lib/cache";

/**
 * Contact details, read from site settings.
 *
 * `contactEmail` and `contactPhone` have been settable in the admin all along
 * and were read by nothing — this card hardcoded `support@valstore.com` and
 * `+1 (555) 123-4567`, a US number on a store that ships in Egypt and charges
 * in EGP. It also printed a New York street address that does not exist.
 *
 * The address card is gone rather than translated: inventing a plausible
 * Egyptian address would be worse than showing none. Add a real one to site
 * settings and it can come back.
 *
 * Falls back to the previous hardcoded email if the settings read fails, the
 * same way `Footer` does — a database hiccup should degrade this card, not
 * take down the contact page.
 */
export async function ContactInfo() {
  let settings: Awaited<ReturnType<typeof getCachedSiteSettings>> = null;

  try {
    settings = await getCachedSiteSettings();
  } catch {
    settings = null;
  }

  const email = settings?.contactEmail || "support@valstore.com";
  const phone = settings?.contactPhone || null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <a href={`mailto:${email}`} className="text-primary hover:underline">
            {email}
          </a>
        </CardContent>
      </Card>

      {phone && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Phone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <a href={`tel:${phone}`} className="text-primary hover:underline">
              {phone}
            </a>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Business Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Sunday - Thursday: 10am - 6pm</p>
          <p>Friday - Saturday: Closed</p>
          <p className="text-sm text-muted-foreground mt-2">
            Egypt local time (EET)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
