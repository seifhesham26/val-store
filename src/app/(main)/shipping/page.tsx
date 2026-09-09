import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = {
  title: "Shipping | Valkyrie",
  description: "Delivery times, charges and tracking for orders within Egypt.",
};

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <LegalPage slug="shipping" />
    </div>
  );
}
