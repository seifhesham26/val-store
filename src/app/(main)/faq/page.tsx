import { LegalHero } from "@/components/legal/LegalDocument";
import { FAQAccordion } from "@/components/faq/FAQAccordion";
import { FAQSupport } from "@/components/faq/FAQSupport";
import { splitFaqSections } from "@/lib/faq-markdown";
import { resolveLegalPage } from "@/lib/cache";
import { formatStoreDate } from "@/lib/store-locale";

export const metadata = {
  title: "FAQ | Valkyrie",
  description: "Answers to the questions we are asked most often.",
};

export default async function FAQPage() {
  const page = await resolveLegalPage("faq");
  const sections = page ? splitFaqSections(page.bodyMarkdown) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <LegalHero
        eyebrow="Help"
        title={page?.title ?? "Frequently Asked Questions"}
        description="Answers to the questions we are asked most often. If yours is not here, contact us."
        updatedAt={page ? formatStoreDate(page.effectiveDate) : "—"}
      />
      <div className="pt-12">
        <FAQAccordion sections={sections} />
        <FAQSupport />
      </div>
    </div>
  );
}
