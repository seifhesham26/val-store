import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = {
  title: "Returns & Exchanges | Valkyrie",
  description:
    "Your rights when you return an item, under Egyptian consumer protection law.",
};

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <LegalPage slug="returns" />
    </div>
  );
}
