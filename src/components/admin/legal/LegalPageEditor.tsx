"use client";

/**
 * Legal Page Editor
 *
 * The five legal documents used to be hardcoded JSX, so correcting a policy
 * needed a deploy. They now live in `legal_pages`, seeded from
 * `content/legal/*.md`, and this is where they are edited.
 *
 * The canonical copy stays in the repo: `pnpm seed:legal` re-asserts it. So an
 * edit here is the fast path for a correction, not a replacement for reviewing
 * legal text in a diff.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, History, Save } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { LegalMarkdown } from "@/components/legal/LegalMarkdown";
import { LegalHistoryDialog } from "./LegalHistoryDialog";
import { useAdminWriteAccess } from "@/hooks/use-admin-write-access";
import { LEGAL_SLUGS, type LegalSlug } from "@/domain/legal/legal-slugs";
import { formatStoreDate } from "@/lib/store-locale";

const PAGE_LABELS: Record<LegalSlug, string> = {
  returns: "Returns & Exchanges",
  terms: "Terms of Sale",
  privacy: "Privacy Policy",
  shipping: "Shipping",
  faq: "FAQ",
};

interface LoadedPage {
  slug: string;
  title: string;
  bodyMarkdown: string;
  effectiveDate: string;
  version: number;
}

export function LegalPageEditor() {
  const [slug, setSlug] = useState<LegalSlug>("returns");
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: page, isLoading } = trpc.admin.legal.get.useQuery({ slug });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {LEGAL_SLUGS.map((s) => (
          <Button
            key={s}
            type="button"
            variant={s === slug ? "default" : "outline"}
            size="sm"
            className={s === slug ? undefined : "bg-transparent"}
            onClick={() => setSlug(s)}
          >
            {PAGE_LABELS[s]}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !page ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            This page has not been seeded yet. Run{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              pnpm seed:legal
            </code>{" "}
            to load it from{" "}
            <code className="font-mono text-xs">content/legal/</code>.
          </p>
        </div>
      ) : (
        /*
         * Keyed on slug + version so React remounts the form whenever a
         * different document is selected or a save bumps the version. That is
         * what resets the textarea to the saved content — deriving it in an
         * effect would be a setState inside useEffect, which React 19 flags and
         * which renders once with stale content before correcting itself.
         */
        <LegalEditorForm
          key={`${page.slug}:${page.version}`}
          page={page}
          label={PAGE_LABELS[slug]}
          onOpenHistory={() => setHistoryOpen(true)}
        />
      )}

      <LegalHistoryDialog
        slug={slug}
        pageLabel={PAGE_LABELS[slug]}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </div>
  );
}

function LegalEditorForm({
  page,
  label,
  onOpenHistory,
}: {
  page: LoadedPage;
  label: string;
  onOpenHistory: () => void;
}) {
  const { canWrite } = useAdminWriteAccess();
  const [draft, setDraft] = useState(page.bodyMarkdown);
  const utils = trpc.useUtils();

  const update = trpc.admin.legal.update.useMutation({
    onSuccess: () => {
      toast.success(`${label} saved`);
      utils.admin.legal.get.invalidate({ slug: page.slug as LegalSlug });
      utils.admin.legal.list.invalidate();
      utils.admin.legal.history.invalidate({ slug: page.slug as LegalSlug });
    },
    onError: (error) => toast.error(error.message),
  });

  const isDirty = draft !== page.bodyMarkdown;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">v{page.version}</Badge>
          <span>Effective {formatStoreDate(page.effectiveDate)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-transparent"
            onClick={onOpenHistory}
          >
            <History className="mr-1 size-3.5" />
            History
          </Button>
          {canWrite && (
            <Button
              type="button"
              size="sm"
              disabled={!isDirty || update.isPending}
              onClick={() =>
                update.mutate({
                  slug: page.slug as LegalSlug,
                  title: page.title,
                  bodyMarkdown: draft,
                  effectiveDate: page.effectiveDate,
                })
              }
            >
              {update.isPending ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : (
                <Save className="mr-1 size-3.5" />
              )}
              Save
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="legal-markdown"
            className="text-sm font-medium text-muted-foreground"
          >
            Markdown
          </label>
          <textarea
            id="legal-markdown"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            readOnly={!canWrite}
            spellCheck={false}
            className="h-[32rem] w-full resize-y rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed text-foreground focus:ring-ring focus:outline-none focus:ring-2"
          />
          <p className="text-xs text-muted-foreground">
            Each <code className="font-mono">## heading</code> becomes a
            numbered section on the page, and an entry in its table of contents.
          </p>
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium text-muted-foreground">
            Preview
          </span>
          {/*
           * The storefront is dark and this admin screen is light, so the
           * preview is wrapped in the storefront's own colours. Rendering it on
           * the admin background would show the editor a document that looks
           * nothing like the published page.
           */}
          <div className="h-[32rem] overflow-y-auto rounded-lg border bg-black p-5 text-sm leading-relaxed text-gray-400">
            <LegalMarkdown markdown={draft} />
          </div>
        </div>
      </div>
    </>
  );
}
