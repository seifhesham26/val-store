import { LegalHero } from "@/components/legal/LegalDocument";

export const TERMS_UPDATED_AT = "29 August 2026";

export function TermsHeader() {
  return (
    <LegalHero
      eyebrow="Legal"
      title="Terms of Service"
      description="The agreement between you and Valkyrie when you use this website or place an order. Plain language, no surprises."
      updatedAt={TERMS_UPDATED_AT}
    />
  );
}
