"use client";

/**
 * Admin Legal Pages
 *
 * Edits the five customer-facing legal documents. A read-only `worker` sees the
 * screen and the content but no Save button; the server rejects the mutation
 * regardless, and `AdminReadOnlyBanner` explains why rather than leaving the
 * page looking broken.
 */

import { Scale } from "lucide-react";
import { AdminReadOnlyBanner } from "@/components/admin/AdminReadOnlyBanner";
import { LegalPageEditor } from "@/components/admin/legal/LegalPageEditor";

export default function AdminLegalPage() {
  return (
    <div className="space-y-6">
      <AdminReadOnlyBanner />

      <div className="flex items-center gap-3">
        <Scale className="size-6 text-muted-foreground" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold">Legal pages</h1>
          <p className="text-sm text-muted-foreground">
            Returns, terms, privacy, shipping and the FAQ. Edits publish
            immediately; every version is kept.
          </p>
        </div>
      </div>

      <LegalPageEditor />
    </div>
  );
}
