import { LegalHero } from "@/components/legal/LegalDocument";

export const PRIVACY_UPDATED_AT = "29 August 2026";

export function PrivacyHeader() {
  return (
    <LegalHero
      eyebrow="Legal"
      title="Privacy Policy"
      description="How Valkyrie collects, uses, and protects your personal information when you shop with us. Written to be read, not skimmed past."
      updatedAt={PRIVACY_UPDATED_AT}
    />
  );
}
