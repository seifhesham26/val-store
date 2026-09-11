/**
 * Search Page
 *
 * Client-side search results with infinite scroll.
 * Redirects to search prompt if no query.
 */

import { Suspense } from "react";
import { SearchContent } from "@/components/search/SearchContent";
import { ValkyrieLoader } from "@/components/ui/valkyrie-loader";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <ValkyrieLoader size="md" label="Loading" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
