import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = {
  title: "Terms of Sale | Valkyrie",
  description: "The terms that apply when you place an order with us.",
};

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <LegalPage slug="terms" />
    </div>
  );
}
