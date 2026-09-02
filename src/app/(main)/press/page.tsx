import { PressHeader } from "@/components/press/PressHeader";
import { PressKit } from "@/components/press/PressKit";
import { PressContact } from "@/components/press/PressContact";

export const metadata = {
  title: "Press | Valkyrie",
  description: "Press resources and media contact information for Valkyrie.",
};

export default function PressPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <PressHeader />
      <PressKit />
      <PressContact />
    </div>
  );
}
