"use client";

/**
 * Content Section History Dialog
 *
 * `content_sections_history`, `getContentHistory` and `revertToVersion` were
 * fully implemented with no UI calling them at all (ISSUES.md #29) — every
 * edit was already being versioned and nothing let an admin see or use it.
 * This is the panel: a version list per section, each row revertable behind
 * a confirmation, since reverting overwrites whatever is live right now.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";

interface ContentHistoryDialogProps {
  sectionType: "hero" | "announcement";
  sectionLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContentHistoryDialog({
  sectionType,
  sectionLabel,
  open,
  onOpenChange,
}: ContentHistoryDialogProps) {
  const utils = trpc.useUtils();
  const [confirmVersion, setConfirmVersion] = useState<number | null>(null);

  const { data: history, isLoading } =
    trpc.admin.settings.getContentHistory.useQuery(
      { sectionType },
      { enabled: open }
    );

  const revert = trpc.admin.settings.revertToVersion.useMutation({
    onSuccess: (_, variables) => {
      toast.success(`Reverted ${sectionLabel} to version ${variables.version}`);
      // The section itself changed, and the revert wrote a new history row
      // recording the version it replaced — both queries are stale.
      utils.admin.settings.getContentSection.invalidate({ sectionType });
      utils.admin.settings.getContentHistory.invalidate({ sectionType });
      setConfirmVersion(null);
    },
    onError: (err) => {
      toast.error(`Revert failed: ${err.message}`);
      setConfirmVersion(null);
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{sectionLabel} history</DialogTitle>
            <DialogDescription>
              Every save creates a version. Revert to replace the live content
              with an older one.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !history || history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No saved versions yet — this section hasn&apos;t been edited since
              it was created.
            </p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {history.map((entry, index) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">v{entry.version}</Badge>
                      {index === 0 && (
                        <span className="text-xs text-muted-foreground">
                          most recent
                        </span>
                      )}
                    </div>
                    <span className="text-sm">
                      {format(new Date(entry.createdAt), "MMM d, yyyy HH:mm")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {entry.createdByName ?? "Unknown admin"}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={revert.isPending}
                    onClick={() => setConfirmVersion(entry.version)}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Revert
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Separate from the list dialog so closing this one never dismisses
          the history behind it. */}
      <AlertDialog
        open={confirmVersion !== null}
        onOpenChange={(next) => {
          if (!next) setConfirmVersion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert {sectionLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces the live {sectionLabel.toLowerCase()} content with
              version {confirmVersion}. The current content is saved as a new
              version first, so this can be undone, but visitors will see the
              reverted content immediately once the storefront cache clears.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revert.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={revert.isPending}
              onClick={() => {
                if (confirmVersion === null) return;
                revert.mutate({ sectionType, version: confirmVersion });
              }}
            >
              {revert.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Revert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
