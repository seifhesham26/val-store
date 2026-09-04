"use client";

/**
 * Appearance Settings Component
 *
 * Manage logo, social links, and visual branding.
 */

import { useState, useEffect } from "react";
import Image from "next/image";
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
import {
  Save,
  Loader2,
  Upload,
  Instagram,
  Facebook,
  Twitter,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function AppearanceSettings() {
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    logoUrl: "",
    faviconUrl: "",
    instagramUrl: "",
    facebookUrl: "",
    twitterUrl: "",
    tiktokUrl: "",
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
      toast.success("Appearance settings saved!");
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
        logoUrl: settings.logoUrl || "",
        faviconUrl: settings.faviconUrl || "",
        instagramUrl: settings.instagramUrl || "",
        facebookUrl: settings.facebookUrl || "",
        twitterUrl: settings.twitterUrl || "",
        tiktokUrl: settings.tiktokUrl || "",
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
      {/* Logo & Favicon */}
      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Your store logo and favicon</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Logo */}
            <div className="space-y-3">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                {form.logoUrl ? (
                  <div className="h-16 w-32 rounded border bg-muted flex items-center justify-center overflow-hidden relative">
                    <Image
                      src={form.logoUrl}
                      alt="Logo"
                      fill
                      // The box is a fixed 128px; without this the optimizer
                      // is told nothing and serves a full-viewport candidate.
                      sizes="128px"
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="h-16 w-32 rounded border border-dashed flex items-center justify-center text-muted-foreground">
                    No logo
                  </div>
                )}
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </div>
              <Input
                placeholder="https://... (or upload)"
                value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              />
            </div>

            {/* Favicon */}
            <div className="space-y-3">
              <Label>Favicon</Label>
              <div className="flex items-center gap-4">
                {form.faviconUrl ? (
                  <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center overflow-hidden relative">
                    <Image
                      src={form.faviconUrl}
                      alt="Favicon"
                      fill
                      sizes="40px"
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded border border-dashed flex items-center justify-center text-muted-foreground text-xs">
                    32x32
                  </div>
                )}
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </div>
              <Input
                placeholder="https://... (32x32 recommended)"
                value={form.faviconUrl}
                onChange={(e) =>
                  setForm({ ...form, faviconUrl: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card>
        <CardHeader>
          <CardTitle>Social Media</CardTitle>
          <CardDescription>Links to your social media profiles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Instagram className="h-4 w-4" />
                Instagram
              </Label>
              <Input
                placeholder="https://instagram.com/yourstore"
                value={form.instagramUrl}
                onChange={(e) =>
                  setForm({ ...form, instagramUrl: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Facebook className="h-4 w-4" />
                Facebook
              </Label>
              <Input
                placeholder="https://facebook.com/yourstore"
                value={form.facebookUrl}
                onChange={(e) =>
                  setForm({ ...form, facebookUrl: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Twitter className="h-4 w-4" />
                Twitter / X
              </Label>
              <Input
                placeholder="https://twitter.com/yourstore"
                value={form.twitterUrl}
                onChange={(e) =>
                  setForm({ ...form, twitterUrl: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
                TikTok
              </Label>
              <Input
                placeholder="https://tiktok.com/@yourstore"
                value={form.tiktokUrl}
                onChange={(e) =>
                  setForm({ ...form, tiktokUrl: e.target.value })
                }
              />
            </div>
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
          Save Changes
        </Button>
      </div>
    </div>
  );
}
