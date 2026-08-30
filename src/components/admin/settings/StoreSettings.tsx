"use client";

/**
 * Store Settings Component
 *
 * Manage store identity, contact info, and SEO defaults.
 */

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { STORE_CURRENCY, formatCurrency } from "@/lib/currency";

export function StoreSettings() {
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    storeName: "",
    storeTagline: "",
    contactEmail: "",
    contactPhone: "",
    defaultMetaTitle: "",
    defaultMetaDescription: "",
  });

  // Fetch site settings
  const {
    data: settings,
    isLoading,
    refetch,
  } = trpc.admin.settings.getSiteSettings.useQuery(undefined, {
    staleTime: 1000 * 60,
  });

  // Update mutation
  const updateSettings = trpc.admin.settings.updateSiteSettings.useMutation({
    onSuccess: () => {
      toast.success("Store settings saved!");
      refetch();
    },
    onError: (err: { message: string }) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  // Initialize form when data loads
  useEffect(() => {
    if (settings) {
      setForm({
        storeName: settings.storeName || "",
        storeTagline: settings.storeTagline || "",
        contactEmail: settings.contactEmail || "",
        contactPhone: settings.contactPhone || "",
        defaultMetaTitle: settings.defaultMetaTitle || "",
        defaultMetaDescription: settings.defaultMetaDescription || "",
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings.mutateAsync(form);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Store Identity */}
      <Card>
        <CardHeader>
          <CardTitle>Store Identity</CardTitle>
          <CardDescription>Basic information about your store</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="store-name">Store Name</Label>
              <Input
                id="store-name"
                placeholder="Valkyrie"
                value={form.storeName}
                onChange={(e) =>
                  setForm({ ...form, storeName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-tagline">Tagline</Label>
              <Input
                id="store-tagline"
                placeholder="Elevate Your Style"
                value={form.storeTagline}
                onChange={(e) =>
                  setForm({ ...form, storeTagline: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>How customers can reach you</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact-email">Contact Email</Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="hello@valkyrie.com"
                value={form.contactEmail}
                onChange={(e) =>
                  setForm({ ...form, contactEmail: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Contact Phone</Label>
              <Input
                id="contact-phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={form.contactPhone}
                onChange={(e) =>
                  setForm({ ...form, contactPhone: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Currency */}
      <Card>
        <CardHeader>
          <CardTitle>Currency</CardTitle>
          <CardDescription>
            What the store charges, stores and displays
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-2">
            <Label>Currency</Label>
            <div className="rounded-md border bg-muted/40 px-3 py-2 font-medium">
              {STORE_CURRENCY} — {formatCurrency(1234.5)}
            </div>
            {/* This was a dropdown that changed nothing: Stripe charged EGP, the
                order rows recorded EGP, and every price rendered a dollar sign
                regardless of what was picked. It is one value now, and it is
                deployment configuration rather than a setting, because a Stripe
                account is bound to the currency it charges in and every stored
                price is already denominated in it. */}
            <p className="text-xs text-muted-foreground">
              Set at deploy time with{" "}
              <code className="font-mono">NEXT_PUBLIC_STORE_CURRENCY</code>.
              Changing it is a migration, not a setting: existing prices and
              orders are stored in this currency, and your Stripe account
              charges in it.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* SEO Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>SEO Defaults</CardTitle>
          <CardDescription>
            Default meta tags for pages without custom SEO
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meta-title">Default Meta Title</Label>
            <Input
              id="meta-title"
              placeholder="Valkyrie - Premium Fashion"
              value={form.defaultMetaTitle}
              onChange={(e) =>
                setForm({ ...form, defaultMetaTitle: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Recommended: 50-60 characters
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="meta-description">Default Meta Description</Label>
            <Textarea
              id="meta-description"
              placeholder="Discover premium fashion at Valkyrie..."
              value={form.defaultMetaDescription}
              onChange={(e) =>
                setForm({ ...form, defaultMetaDescription: e.target.value })
              }
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Recommended: 150-160 characters
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save All Changes
        </Button>
      </div>
    </div>
  );
}
