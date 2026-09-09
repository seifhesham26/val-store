"use client";

/**
 * Editor for the two homepage sections that share one shape: a pre-headline,
 * a headline, body copy, a CTA and an image.
 *
 * One component rather than two near-identical forms. `brand_story` and
 * `promo_banner` differ in exactly one way — the brand story stores an array
 * of paragraphs, the promo banner a single description — and that difference
 * is handled by branching on `sectionType` in two places: loading the body
 * field, and building the payload to save. Everything else is identical.
 * `HomepageSettings` is already 500 lines carrying the hero and announcement
 * editors; duplicating a 150-line form into it twice more is how that file
 * becomes unreadable.
 *
 * The hero is deliberately not folded in here. It has an overlay slider, a
 * text-alignment select and a CTA style that these two do not, so generalising
 * far enough to cover it would cost more in conditionals than the duplication
 * saves.
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
import { Save, Loader2, RefreshCw, History } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { joinParagraphs, splitParagraphs } from "@/lib/paragraph-text";
import { ContentHistoryDialog } from "./ContentHistoryDialog";

type SimpleSectionType = "brand_story" | "promo_banner";

interface SimpleSectionEditorProps {
  sectionType: SimpleSectionType;
  /** Card heading, e.g. "Brand Story". */
  title: string;
  description: string;
  bodyLabel: string;
  bodyHelp: string;
  /** Guidance for the image field — the aspect ratio differs per section. */
  imageHelp: string;
  /** Placeholder copy, so an empty form still shows what belongs where. */
  placeholders: {
    preHeadline: string;
    headline: string;
    ctaText: string;
    ctaLink: string;
  };
}

type FormState = {
  preHeadline: string;
  headline: string;
  body: string;
  ctaText: string;
  ctaLink: string;
  backgroundImage: string;
};

const EMPTY_FORM: FormState = {
  preHeadline: "",
  headline: "",
  body: "",
  ctaText: "",
  ctaLink: "",
  backgroundImage: "",
};

export function SimpleSectionEditor({
  sectionType,
  title,
  description,
  bodyLabel,
  bodyHelp,
  imageHelp,
  placeholders,
}: SimpleSectionEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const {
    data: section,
    isLoading,
    refetch,
  } = trpc.admin.settings.getContentSection.useQuery(
    { sectionType },
    { staleTime: 1000 * 60 }
  );

  // Re-sync whenever the server copy changes, not only on mount — the same
  // reason the hero editor does: reverting to an earlier version updates the
  // query data, and a mount-only effect would leave the form showing the
  // pre-revert values until a reload.
  useEffect(() => {
    const content = section?.content;
    if (!content || typeof content !== "object") return;

    // `getContentSection` returns a validated union, so narrow on the field
    // that identifies this shape rather than casting.
    if (!("headline" in content)) return;

    setForm({
      preHeadline: content.preHeadline ?? "",
      headline: content.headline ?? "",
      body:
        "paragraphs" in content
          ? joinParagraphs(content.paragraphs ?? [])
          : ((content as { description?: string }).description ?? ""),
      ctaText: content.ctaText ?? "",
      ctaLink: content.ctaLink ?? "",
      backgroundImage: content.backgroundImage ?? "",
    });
  }, [section]);

  const updateSection = trpc.admin.settings.updateContentSection.useMutation({
    onSuccess: () => {
      toast.success(`${title} saved`);
      refetch();
    },
    onError: (err: { message: string }) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  const handleSave = async () => {
    if (!form.headline.trim()) {
      // The one required field. Caught here so the admin gets a sentence
      // rather than a Zod error surfaced through a toast.
      toast.error("A headline is required.");
      return;
    }

    setIsSaving(true);
    try {
      // Blank optional fields are omitted, not sent as "". `urlOrAssetPath`
      // rejects an empty string, so sending one would fail validation on a
      // field the admin simply left alone — and the defaults in the schema
      // only apply when the key is absent.
      const shared = {
        preHeadline: form.preHeadline.trim() || undefined,
        headline: form.headline.trim(),
        ctaText: form.ctaText.trim() || undefined,
        ctaLink: form.ctaLink.trim() || undefined,
        backgroundImage: form.backgroundImage.trim() || undefined,
      };

      // Branched rather than built dynamically: `updateContentSectionSchema`
      // is a discriminated union, so the literal has to be visible to the
      // type checker alongside the matching content shape.
      if (sectionType === "brand_story") {
        await updateSection.mutateAsync({
          sectionType: "brand_story",
          content: { ...shared, paragraphs: splitParagraphs(form.body) },
        });
      } else {
        await updateSection.mutateAsync({
          sectionType: "promo_banner",
          content: { ...shared, description: form.body.trim() || undefined },
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const fieldId = (name: string) => `${sectionType}-${name}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="h-4 w-4 mr-2" />
              History
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={fieldId("pre")}>Pre-headline</Label>
            <Input
              id={fieldId("pre")}
              placeholder={placeholders.preHeadline}
              value={form.preHeadline}
              onChange={(e) =>
                setForm({ ...form, preHeadline: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={fieldId("headline")}>Headline</Label>
            <Input
              id={fieldId("headline")}
              placeholder={placeholders.headline}
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldId("body")}>{bodyLabel}</Label>
          <Textarea
            id={fieldId("body")}
            rows={6}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">{bodyHelp}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldId("image")}>Image</Label>
          <Input
            id={fieldId("image")}
            placeholder="/brand/example.jpg or https://..."
            value={form.backgroundImage}
            onChange={(e) =>
              setForm({ ...form, backgroundImage: e.target.value })
            }
          />
          <p className="text-xs text-muted-foreground">{imageHelp}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={fieldId("cta-text")}>Button text</Label>
            <Input
              id={fieldId("cta-text")}
              placeholder={placeholders.ctaText}
              value={form.ctaText}
              onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={fieldId("cta-link")}>Button link</Label>
            <Input
              id={fieldId("cta-link")}
              placeholder={placeholders.ctaLink}
              value={form.ctaLink}
              onChange={(e) => setForm({ ...form, ctaLink: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </CardContent>

      <ContentHistoryDialog
        sectionType={sectionType}
        sectionLabel={title}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </Card>
  );
}
