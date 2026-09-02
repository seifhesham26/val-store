"use client";

/**
 * Homepage Settings Component
 *
 * Manage hero section, announcements, and other homepage content.
 */

import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Save, Loader2, RefreshCw, History, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ContentHistoryDialog } from "./ContentHistoryDialog";

export function HomepageSettings() {
  const [isSaving, setIsSaving] = useState(false);
  const [historySection, setHistorySection] = useState<
    "hero" | "announcement" | null
  >(null);

  // Fetch hero section content
  const {
    data: heroSection,
    isLoading: heroLoading,
    refetch: refetchHero,
  } = trpc.admin.settings.getContentSection.useQuery(
    { sectionType: "hero" },
    { staleTime: 1000 * 60 }
  );

  // Fetch announcement content
  const {
    data: announcementSection,
    isLoading: announcementLoading,
    refetch: refetchAnnouncement,
  } = trpc.admin.settings.getContentSection.useQuery(
    { sectionType: "announcement" },
    { staleTime: 1000 * 60 }
  );

  // Update mutation
  const updateSection = trpc.admin.settings.updateContentSection.useMutation({
    onSuccess: () => {
      toast.success("Settings saved successfully!");
      refetchHero();
      refetchAnnouncement();
    },
    onError: (err: { message: string }) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  // Toggle status mutation
  const toggleStatus = trpc.admin.settings.toggleSectionStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated!");
      refetchAnnouncement();
    },
    onError: (err: { message: string }) => {
      toast.error(`Failed to update: ${err.message}`);
    },
  });

  // Hero form state
  const [heroForm, setHeroForm] = useState({
    title: "",
    subtitle: "",
    backgroundImage: "",
    overlayOpacity: 40,
    ctaText: "Shop Now",
    ctaLink: "/collections",
    textAlignment: "center" as "left" | "center" | "right",
  });

  // Re-sync whenever the server copy changes — not just on mount. A `useState`
  // initializer here only ever ran once, so Refresh (and now Revert) updated
  // `heroSection` while the form kept showing the pre-revert values until a
  // full page reload. That defeated the point of a revert button.
  useEffect(() => {
    if (heroSection?.content) {
      setHeroForm({
        title: heroSection.content.title || "",
        subtitle: heroSection.content.subtitle || "",
        backgroundImage: heroSection.content.backgroundImage || "",
        overlayOpacity: heroSection.content.overlayOpacity || 40,
        ctaText: heroSection.content.ctaText || "Shop Now",
        ctaLink: heroSection.content.ctaLink || "/collections",
        textAlignment: heroSection.content.textAlignment || "center",
      });
    }
  }, [heroSection]);

  /**
   * Announcement form state.
   *
   * The whole announcement editor was decorative: uncontrolled `defaultValue`
   * inputs, an "Add" button with no handler, and a Save button with no
   * `onClick` at all — an admin could type a new message, press Save, and get
   * no error and no change. Only the on/off Switch ever did anything.
   *
   * `announcement` is one of the two section types CLAUDE.md describes as
   * wired end to end. Its *rendering* was; its editing was not.
   */
  const [announcementMessages, setAnnouncementMessages] = useState<
    { text: string; link: string }[]
  >([{ text: "", link: "" }]);

  useEffect(() => {
    const stored = announcementSection?.content?.messages;
    setAnnouncementMessages(
      stored?.length
        ? stored.map((m: { text: string; link?: string }) => ({
            text: m.text,
            link: m.link ?? "",
          }))
        : [{ text: "", link: "" }]
    );
  }, [announcementSection]);

  const setMessageField = (
    index: number,
    field: "text" | "link",
    value: string
  ) => {
    setAnnouncementMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const handleSaveAnnouncement = async () => {
    setIsSaving(true);
    try {
      // Blank rows are a UI affordance, not content — the schema requires at
      // least one message, and the bar would otherwise rotate through empties.
      const messages = announcementMessages
        .map((m) => ({
          text: m.text.trim(),
          link: m.link.trim() || undefined,
        }))
        .filter((m) => m.text);

      if (messages.length === 0) {
        toast.error("Add at least one message before saving");
        return;
      }

      await updateSection.mutateAsync({
        sectionType: "announcement",
        content: { messages },
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveHero = async () => {
    setIsSaving(true);
    try {
      await updateSection.mutateAsync({
        sectionType: "hero",
        content: heroForm,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (heroLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Hero Section</CardTitle>
              <CardDescription>
                Configure the main banner on your homepage
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchHero()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Title & Subtitle */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hero-title">Title</Label>
              <Input
                id="hero-title"
                placeholder="Elevate Your Style"
                value={heroForm.title}
                onChange={(e) =>
                  setHeroForm({ ...heroForm, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hero-subtitle">Subtitle</Label>
              <Input
                id="hero-subtitle"
                placeholder="Discover the new collection"
                value={heroForm.subtitle}
                onChange={(e) =>
                  setHeroForm({ ...heroForm, subtitle: e.target.value })
                }
              />
            </div>
          </div>

          {/* Background Image */}
          <div className="space-y-2">
            <Label htmlFor="hero-bg">Background Image URL</Label>
            <Input
              id="hero-bg"
              placeholder="https://..."
              value={heroForm.backgroundImage}
              onChange={(e) =>
                setHeroForm({ ...heroForm, backgroundImage: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Recommended size: 1920x1080 or larger
            </p>
          </div>

          {/* Overlay Opacity */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Overlay Opacity</Label>
              <span className="text-sm text-muted-foreground">
                {heroForm.overlayOpacity}%
              </span>
            </div>
            <Slider
              value={[heroForm.overlayOpacity]}
              onValueChange={([value]) =>
                setHeroForm({ ...heroForm, overlayOpacity: value })
              }
              min={0}
              max={100}
              step={5}
            />
          </div>

          {/* CTA & Alignment */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="hero-cta-text">Button Text</Label>
              <Input
                id="hero-cta-text"
                placeholder="Shop Now"
                value={heroForm.ctaText}
                onChange={(e) =>
                  setHeroForm({ ...heroForm, ctaText: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hero-cta-link">Button Link</Label>
              <Input
                id="hero-cta-link"
                placeholder="/collections"
                value={heroForm.ctaLink}
                onChange={(e) =>
                  setHeroForm({ ...heroForm, ctaLink: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Text Alignment</Label>
              <Select
                value={heroForm.textAlignment}
                onValueChange={(value: "left" | "center" | "right") =>
                  setHeroForm({ ...heroForm, textAlignment: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistorySection("hero")}
            >
              <History className="h-4 w-4 mr-2" />
              View History
            </Button>
            <Button onClick={handleSaveHero} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Announcement Bar Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Announcement Bar</CardTitle>
              <CardDescription>
                Show rotating messages at the top of your store
              </CardDescription>
            </div>
            <Switch
              checked={announcementSection?.isActive ?? false}
              onCheckedChange={() => {
                // Toggle announcement status
                toggleStatus.mutate({ sectionType: "announcement" });
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {announcementLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Message Input */}
              <div className="space-y-2">
                <Label htmlFor="announcement-message">Message</Label>
                <Textarea
                  id="announcement-message"
                  placeholder="Free shipping on orders over EGP 2,000"
                  rows={2}
                  value={announcementMessages[0]?.text ?? ""}
                  onChange={(e) => setMessageField(0, "text", e.target.value)}
                />
              </div>

              {/* Additional Messages */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Additional Messages (rotate)</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setAnnouncementMessages((prev) => [
                        ...prev,
                        { text: "", link: "" },
                      ])
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                {announcementMessages.slice(1).map((message, index) => (
                  <div key={index + 1} className="flex items-center gap-2">
                    <Input
                      value={message.text}
                      placeholder="Another message"
                      onChange={(e) =>
                        setMessageField(index + 1, "text", e.target.value)
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setAnnouncementMessages((prev) =>
                          prev.filter((_, i) => i !== index + 1)
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <div className="text-xs text-muted-foreground">
                  Add multiple messages to rotate in the announcement bar
                </div>
              </div>

              {/* Link */}
              <div className="space-y-2">
                <Label htmlFor="announcement-link">Link URL (optional)</Label>
                <Input
                  id="announcement-link"
                  placeholder="/collections/sale"
                  value={announcementMessages[0]?.link ?? ""}
                  onChange={(e) => setMessageField(0, "link", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Makes the first message clickable. There was a &quot;Link
                  Text&quot; field here too; the schema has no home for it — a
                  message is its own link text — so it has been removed rather
                  than left looking editable.
                </p>
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHistorySection("announcement")}
                >
                  <History className="h-4 w-4 mr-2" />
                  View History
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveAnnouncement}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Announcement
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ContentHistoryDialog
        sectionType={historySection ?? "hero"}
        sectionLabel={
          historySection === "announcement" ? "Announcement" : "Hero"
        }
        open={historySection !== null}
        onOpenChange={(open) => {
          if (!open) setHistorySection(null);
        }}
      />
    </div>
  );
}
