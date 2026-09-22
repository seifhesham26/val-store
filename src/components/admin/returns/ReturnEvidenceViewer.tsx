"use client";

import { ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Private storage keys are never rendered as public media URLs. */
export function ReturnEvidenceViewer({
  isSuperAdmin,
}: {
  isSuperAdmin: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          Private evidence
        </CardTitle>
        <CardDescription>
          {isSuperAdmin
            ? "Open media only through an audited, short-lived signed link."
            : "Media is restricted to super admins. Review the structured intake findings and report any missing or corrupt media."}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Evidence metadata is retained with the request; public UploadThing URLs
        are never exposed in this queue.
      </CardContent>
    </Card>
  );
}
