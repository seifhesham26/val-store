/**
 * Egypt's 27 governorates, and the delivery zone each belongs to.
 *
 * The address form previously asked for a "State/Province" and a "ZIP code",
 * which are American concepts — Egypt is divided into governorates and postal
 * codes are not universally used. `addresses.state` stays free text in the
 * database so addresses saved before this existed keep working; this list is
 * what the form offers and what shipping rates key off.
 *
 * Zones follow geography, not price: `delta` is the eight Nile Delta
 * governorates, `cairo_giza` is the capital pair couriers usually price
 * separately, and everything else — Upper Egypt, Sinai, the Red Sea coast, the
 * frontier governorates — is `other`.
 */

export type ShippingZone = "cairo_giza" | "delta" | "other";

export interface Governorate {
  /** Stable key. Never rendered; `en` is what a customer sees. */
  code: string;
  en: string;
  ar: string;
  zone: ShippingZone;
}

export const EGYPT_GOVERNORATES: readonly Governorate[] = [
  { code: "cairo", en: "Cairo", ar: "القاهرة", zone: "cairo_giza" },
  { code: "giza", en: "Giza", ar: "الجيزة", zone: "cairo_giza" },
  { code: "alexandria", en: "Alexandria", ar: "الإسكندرية", zone: "other" },
  { code: "dakahlia", en: "Dakahlia", ar: "الدقهلية", zone: "delta" },
  { code: "damietta", en: "Damietta", ar: "دمياط", zone: "delta" },
  { code: "gharbia", en: "Gharbia", ar: "الغربية", zone: "delta" },
  {
    code: "kafr-el-sheikh",
    en: "Kafr El Sheikh",
    ar: "كفر الشيخ",
    zone: "delta",
  },
  { code: "menofia", en: "Menofia", ar: "المنوفية", zone: "delta" },
  { code: "qalyubia", en: "Qalyubia", ar: "القليوبية", zone: "delta" },
  { code: "sharqia", en: "Sharqia", ar: "الشرقية", zone: "delta" },
  { code: "beheira", en: "Beheira", ar: "البحيرة", zone: "delta" },
  { code: "port-said", en: "Port Said", ar: "بورسعيد", zone: "other" },
  { code: "ismailia", en: "Ismailia", ar: "الإسماعيلية", zone: "other" },
  { code: "suez", en: "Suez", ar: "السويس", zone: "other" },
  { code: "north-sinai", en: "North Sinai", ar: "شمال سيناء", zone: "other" },
  { code: "south-sinai", en: "South Sinai", ar: "جنوب سيناء", zone: "other" },
  { code: "beni-suef", en: "Beni Suef", ar: "بني سويف", zone: "other" },
  { code: "fayoum", en: "Fayoum", ar: "الفيوم", zone: "other" },
  { code: "minya", en: "Minya", ar: "المنيا", zone: "other" },
  { code: "assiut", en: "Assiut", ar: "أسيوط", zone: "other" },
  { code: "sohag", en: "Sohag", ar: "سوهاج", zone: "other" },
  { code: "qena", en: "Qena", ar: "قنا", zone: "other" },
  { code: "luxor", en: "Luxor", ar: "الأقصر", zone: "other" },
  { code: "aswan", en: "Aswan", ar: "أسوان", zone: "other" },
  { code: "red-sea", en: "Red Sea", ar: "البحر الأحمر", zone: "other" },
  { code: "new-valley", en: "New Valley", ar: "الوادي الجديد", zone: "other" },
  { code: "matrouh", en: "Matrouh", ar: "مطروح", zone: "other" },
] as const;

/**
 * The zone for a stored `addresses.state` value.
 *
 * Tolerant on purpose: the column is free text and holds values typed before
 * the dropdown existed. An unrecognised value resolves to `other` rather than
 * throwing — refusing to price an order because a governorate was spelled
 * unusually would block a checkout over a formatting difference.
 */
export function resolveShippingZone(
  state: string | null | undefined
): ShippingZone {
  if (!state) return "other";
  const trimmed = state.trim();
  const needle = trimmed.toLowerCase();
  const match = EGYPT_GOVERNORATES.find(
    (g) =>
      g.en.toLowerCase() === needle || g.code === needle || g.ar === trimmed
  );
  return match?.zone ?? "other";
}

export function isEgyptGovernorate(value: string): boolean {
  const needle = value.trim().toLowerCase();
  return EGYPT_GOVERNORATES.some(
    (g) => g.en.toLowerCase() === needle || g.code === needle
  );
}
