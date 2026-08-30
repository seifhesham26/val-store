import { PrivacyHeader } from "@/components/privacy/PrivacyHeader";
import { PrivacyContent } from "@/components/privacy/PrivacyContent";

export const metadata = {
  title: "Privacy Policy | Valkyrie",
  description:
    "How Valkyrie collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <PrivacyHeader />
      <PrivacyContent />
    </div>
  );
}
