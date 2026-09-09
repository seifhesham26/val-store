"use client";

/**
 * Legal Page History Dialog
 *
 * Every edit to a legal page writes a history row in the same transaction as
 * the update, so a policy's previous wording is always recoverable. This is the
 * panel that exposes it: a version list per page, each row restorable behind a
 * confirmation, because restoring overwrites whatever is published right now.
 *
 * Modelled on `ContentHistoryDialog` deliberately — it solves the same problem
 * for `content_sections`, and two shapes for one job is how they drift apart.
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
import { useAdminWriteAccess } from "@/hooks/use-admin-write-access";
import type { LegalSlug } from "@/domain/legal/legal-slugs";

interface LegalHistoryDialogProps {
  slug: LegalSlug;
  pageLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LegalHistoryDialog({
  slug,
  pageLabel,
  open,
  onOpenChange,
}: LegalHistoryDialogProps) {
  const { canWrite } = useAdminWriteAccess();
  const [pendingVersion, setPendingVersion] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: history, isLoading } = trpc.admin.legal.history.useQuery(
    { slug },
    { enabled: open }
  );

  const revert = trpc.admin.legal.revert.useMutation({
    onSuccess: () => {
      toast.success(`${pageLabel} restored`);
      utils.admin.legal.get.invalidate({ slug });
      utils.admin.legal.history.invalidate({ slug });
      utils.admin.legal.list.invalidate();
      setPendingVersion(null);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setPendingVersion(null);
    },
  });

  // Newest first: the most recent previous version is what someone reaching for
  // history almost always wants.
  const versions = [...(history ?? [])].sort((a, b) => b.version - a.version);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{pageLabel} history</DialogTitle>
            <DialogDescription>
              Every saved edit is kept. Restoring a version replaces what is
              published now, and is itself recorded as a new version.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : versions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No previous versions yet. The first edit will create one.
            </p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {versions.map((entry) => (
                <li
                  key={entry.version}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">v{entry.version}</Badge>
                      <span className="truncate text-sm font-medium">
                        {entry.title}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Saved{" "}
                      {format(new Date(entry.createdAt), "d MMM yyyy, HH:mm")}
                    </p>
                  </div>
                  {canWrite && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="bg-transparent"
                      onClick={() => setPendingVersion(entry.version)}
                    >
                      <RotateCcw className="mr-1 size-3.5" />
                      Restore
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingVersion !== null}
        onOpenChange={(o) => !o && setPendingVersion(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Restore version {pendingVersion} of {pageLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This replaces the published text with that version. The current
              wording is kept in history, so this can be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                pendingVersion !== null &&
                revert.mutate({ slug, version: pendingVersion })
              }
              disabled={revert.isPending}
            >
              {revert.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
