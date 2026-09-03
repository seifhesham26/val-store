import Link from "next/link";
import Image from "next/image";
import {
  Instagram,
  Facebook,
  Twitter,
  Music2, // Music2 for TikTok
  Truck,
  ShieldCheck,
  Banknote,
} from "lucide-react";
import {
  getCachedSiteSettings,
  getCachedNavCategories,
  type NavCategory,
} from "@/lib/cache";

export async function Footer() {
  // Fetch site settings for social links and store name.
  //
  // Degrades to defaults on failure, matching the homepage server sections: the
  // footer renders on every page, so a transient database error must not take
  // the whole site down with it.
  //
  // Read through the cache for exactly that reason — it renders on every page,
  // and it was querying the database directly on each one. `getCachedSiteSettings`
  // already existed for this and had no callers; the announcement bar beside it
  // was using the cached path all along.
  let settings: Awaited<ReturnType<typeof getCachedSiteSettings>> = null;

  try {
    settings = await getCachedSiteSettings();
  } catch (error) {
    console.error("[Footer] Failed to fetch site settings:", error);
  }

  // Real categories, so an admin creating one gets a link and deleting one does
  // not leave a 404 behind. Degrades exactly like the settings above: the
  // footer is on every page, so a transient database error must not take the
  // site down — it falls back to the curated links only.
  let categories: NavCategory[] = [];

  try {
    categories = await getCachedNavCategories();
  } catch (error) {
    console.error("[Footer] Failed to fetch nav categories:", error);
  }

  const currentYear = new Date().getFullYear();
  const storeName = settings?.storeName || "Valkyrie";

  const footerLinks = {
    // Live categories first, then the curated views that are not categories
    // at all — "everything" and "discounted" cannot be expressed as a
    // `categories` row, which is why they stay hardcoded and are reserved.
    shop: [
      ...categories,
      { label: "New Arrivals", href: "/collections/new" },
      { label: "All Products", href: "/collections/all" },
      { label: "Sale", href: "/collections/sale" },
    ],
    customerCare: [
      { label: "Contact Us", href: "/contact" },
      { label: "Shipping Info", href: "/shipping" },
      { label: "Returns & Exchanges", href: "/returns" },
      { label: "Size Guide", href: "/size-guide" },
      { label: "FAQ", href: "/faq" },
    ],
    company: [
      { label: "About Us", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Sustainability", href: "/sustainability" },
      { label: "Press", href: "/press" },
      { label: "Blog", href: "/blog" },
    ],
  };

  const socialLinks = [
    {
      icon: Instagram,
      href: settings?.instagramUrl || "https://instagram.com",
      label: "Instagram",
      enabled: true,
    },
    {
      icon: Facebook,
      href: settings?.facebookUrl || "https://facebook.com",
      label: "Facebook",
      enabled: true,
    },
    {
      icon: Twitter,
      href: settings?.twitterUrl || "https://twitter.com",
      label: "Twitter",
      enabled: true,
    },
    {
      icon: Music2,
      href: settings?.tiktokUrl || "https://tiktok.com",
      label: "TikTok",
      enabled: true,
    },
  ];

  const trustSignals = [
    {
      icon: Truck,
      title: "Nationwide delivery",
      description: "Shipping across Egypt",
    },
    {
      icon: Banknote,
      title: "Cash on delivery",
      description: "Pay when it arrives",
    },
    {
      icon: ShieldCheck,
      title: "Secure payments",
      description: "Encrypted card checkout",
    },
  ];

  const legalLinks = [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Shipping Policy", href: "/shipping" },
    { label: "Returns Policy", href: "/returns" },
  ];

  const paymentMethods = ["Visa", "Mastercard", "Meeza", "Cash on Delivery"];

  return (
    <footer className="bg-black border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Main footer content */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Shop */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Shop
            </h3>
            <ul className="space-y-3">
              {footerLinks.shop.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 hover:text-val-accent transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Care */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Customer Care
            </h3>
            <ul className="space-y-3">
              {footerLinks.customerCare.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 hover:text-val-accent transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Company
            </h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 hover:text-val-accent transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Connect
            </h3>
            <div className="flex items-center gap-4 mb-6">
              {socialLinks
                .filter((s) => s.enabled)
                .map((social) => (
                  <a
                    key={social.label}
                    href={social.href || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-val-accent transition-colors"
                    aria-label={social.label}
                  >
                    <social.icon className="h-5 w-5" />
                  </a>
                ))}
            </div>
            <p className="text-sm text-gray-500">
              Follow us for the latest updates and exclusive offers.
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-white/10 pt-10">
          {/* Trust strip */}
          <div className="grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-3">
            {trustSignals.map((signal) => (
              <div
                key={signal.title}
                className="flex items-center gap-3 bg-black px-5 py-4"
              >
                <signal.icon className="h-4 w-4 shrink-0 text-val-accent" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white">
                    {signal.title}
                  </p>
                  <p className="truncate text-[11px] text-gray-500">
                    {signal.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Identity + legal */}
          <div className="mt-10 flex flex-col items-center gap-6 border-t border-white/10 pt-8 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col items-center gap-4 md:flex-row md:gap-5">
              <Link href="/" aria-label={`${storeName} home`}>
                <Image
                  src="/logo/VAL-LOGO.png"
                  alt={storeName}
                  width={140}
                  height={40}
                  className="h-9 w-auto object-contain"
                />
              </Link>
              <span
                aria-hidden="true"
                className="hidden h-8 w-px bg-white/10 md:block"
              />
              <p className="text-center text-xs text-gray-500 md:text-left">
                © {currentYear} {storeName}. All rights reserved.
              </p>
            </div>

            <nav
              aria-label="Legal"
              className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
            >
              {legalLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-xs text-gray-400 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Payment methods */}
          <div className="mt-8 flex flex-col items-center gap-3 border-t border-white/5 pt-6 sm:flex-row sm:justify-between">
            <p className="text-[10px] uppercase tracking-[0.28em] text-gray-600">
              Secure checkout
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {paymentMethods.map((method) => (
                <span
                  key={method}
                  className="rounded border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-gray-400"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
