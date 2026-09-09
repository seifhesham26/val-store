import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = {
  title: "Privacy Policy | Valkyrie",
  description:
    "What personal data we hold, why we hold it, and what you can ask us to do with it.",
};

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <LegalPage slug="privacy" />
    </div>
  );
}
