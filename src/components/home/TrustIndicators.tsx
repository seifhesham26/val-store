/**
 * Homepage trust badges.
 *
 * These are commercial claims on the store's most-visited page, so they must
 * agree with `content/legal/returns.md` and `shipping.md`. They previously did
 * not: the returns badge advertised a "30-day return policy" (the statutory
 * change-of-mind window is 14 days; 30 days is the separate defect window), and
 * the shipping badge promised free delivery "on every order, no minimum" while
 * the shipping policy sets per-zone charges above a threshold. Both were
 * misleading commercial claims, not just stale copy.
 */

import { Truck, RefreshCw, Award } from "lucide-react";

interface TrustIndicator {
  icon: React.ElementType;
  title: string;
  description: string;
}

const indicators: TrustIndicator[] = [
  {
    icon: Truck,
    title: "Delivery Across Egypt",
    description: "To every governorate",
  },
  {
    icon: RefreshCw,
    title: "Easy Returns",
    description: "14 days to change your mind",
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
