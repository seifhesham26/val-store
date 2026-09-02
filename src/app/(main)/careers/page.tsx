import { CareersHeader } from "@/components/careers/CareersHeader";
import { CareersValues } from "@/components/careers/CareersValues";
import { CareersOpenRoles } from "@/components/careers/CareersOpenRoles";

export const metadata = {
  title: "Careers | Valkyrie",
  description: "Careers at Valkyrie — who we are and how to reach us.",
};

export default function CareersPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <CareersHeader />
      <CareersValues />
      <CareersOpenRoles />
    </div>
  );
}
