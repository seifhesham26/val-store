import { SizeGuideHeader } from "@/components/size-guide/SizeGuideHeader";
import { SizeGuideTables } from "@/components/size-guide/SizeGuideTables";
import { SizeGuideMeasuring } from "@/components/size-guide/SizeGuideMeasuring";

export const metadata = {
  title: "Size Guide | Valkyrie",
  description:
    "Find your size with Valkyrie's measurement charts for tops, pants, dresses, and skirts.",
};

export default function SizeGuidePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <SizeGuideHeader />
      <SizeGuideTables />
      <SizeGuideMeasuring />
    </div>
  );
}
