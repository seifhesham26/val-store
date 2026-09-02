import { Award, Target, MessageCircle, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const values = [
  {
    icon: Award,
    title: "Craft",
    description:
      "We care about the details in the product, and in the work behind it.",
  },
  {
    icon: Target,
    title: "Ownership",
    description:
      "Small team, real responsibility. People here own outcomes, not just tasks.",
  },
  {
    icon: MessageCircle,
    title: "Directness",
    description:
      "We'd rather have a short, honest conversation than a long, vague one.",
  },
  {
    icon: Users,
    title: "Customer-first",
    description:
      "Every decision gets weighed against what it means for the person wearing the clothes.",
  },
];

export function CareersValues() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
      {values.map((value) => (
        <Card key={value.title}>
          <CardHeader>
            <value.icon className="h-8 w-8 text-primary mb-2" />
            <CardTitle>{value.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{value.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
