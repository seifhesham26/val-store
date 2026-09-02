import { SustainabilityHeader } from "@/components/sustainability/SustainabilityHeader";
import { SustainabilityCommitments } from "@/components/sustainability/SustainabilityCommitments";
import { SustainabilityContent } from "@/components/sustainability/SustainabilityContent";

export const metadata = {
  title: "Sustainability | Valkyrie",
  description: "Valkyrie's approach to materials, packaging, and longevity.",
};

export default function SustainabilityPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <SustainabilityHeader />
      <SustainabilityCommitments />
      <SustainabilityContent />
    </div>
  );
}
