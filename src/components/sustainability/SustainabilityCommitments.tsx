import { Leaf, Package, Recycle, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const commitments = [
  {
    icon: Leaf,
    title: "Materials",
    description:
      "We choose fabrics with durability in mind, so pieces are made to be worn for years, not seasons.",
  },
  {
    icon: Package,
    title: "Packaging",
    description:
      "We're working to reduce single-use packaging across orders as we scale.",
  },
  {
    icon: Recycle,
    title: "Longevity",
    description:
      "Our size guide exists to help you get the right fit the first time, so fewer pieces get returned or replaced.",
  },
  {
    icon: MapPin,
    title: "Local",
    description:
      "We ship within Egypt, which keeps our supply chain shorter than a global one.",
  },
];

export function SustainabilityCommitments() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
      {commitments.map((commitment) => (
        <Card key={commitment.title}>
          <CardHeader>
            <commitment.icon className="h-8 w-8 text-primary mb-2" />
            <CardTitle>{commitment.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{commitment.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
