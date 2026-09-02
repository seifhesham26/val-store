import { Truck, RefreshCw, Award } from "lucide-react";

interface TrustIndicator {
  icon: React.ElementType;
  title: string;
  description: string;
}

const indicators: TrustIndicator[] = [
  {
    icon: Truck,
    title: "Free Shipping",
    description: "On every order, no minimum",
  },
  {
    icon: RefreshCw,
    title: "Easy Returns",
    description: "30-day return policy",
  },
  {
    icon: Award,
    title: "Premium Quality",
    description: "Crafted with care",
  },
];

export function TrustIndicators() {
  return (
    <section className="py-12 md:py-16 bg-black border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {indicators.map((item) => (
            <div key={item.title} className="flex flex-col items-center">
              <item.icon className="h-8 w-8 text-val-accent mb-4" />
              <h3 className="text-xl font-semibold text-white mb-1">
                {item.title}
              </h3>
              <p className="text-gray-400 text-sm">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
