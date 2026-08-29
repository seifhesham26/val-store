import { TermsHeader } from "@/components/terms/TermsHeader";
import { TermsContent } from "@/components/terms/TermsContent";

export const metadata = {
  title: "Terms of Service | Valkyrie",
  description:
    "The terms that apply when you use the Valkyrie store or place an order.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <TermsHeader />
      <TermsContent />
    </div>
  );
}
