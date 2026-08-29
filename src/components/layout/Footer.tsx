import Link from "next/link";
import Image from "next/image";
import { Instagram, Facebook, Twitter, Music2 } from "lucide-react"; // Music2 for TikTok
import { container } from "@/application/container";

export async function Footer() {
  // Fetch site settings for social links and store name.
  //
  // Degrades to defaults on failure, matching the homepage server sections: the
  // footer renders on every page, so a transient database error must not take
  // the whole site down with it.
  let settings: Awaited<
    ReturnType<
      ReturnType<typeof container.getSiteConfigRepository>["getSiteSettings"]
    >
  > = null;

  try {
    const siteConfigRepo = container.getSiteConfigRepository();
    settings = await siteConfigRepo.getSiteSettings();
  } catch (error) {
    console.error("[Footer] Failed to fetch site settings:", error);
  }

  const currentYear = new Date().getFullYear();
  const storeName = settings?.storeName || "Valkyrie";

  const footerLinks = {
    shop: [
      { label: "Men's", href: "/collections/men" },
      { label: "Women's", href: "/collections/women" },
      { label: "Accessories", href: "/collections/accessories" },
      { label: "New Arrivals", href: "/collections/new" },
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
        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/">
              <Image
                src="/logo/VAL-LOGO.png"
                alt="Valkyrie"
                width={120}
                height={35}
                className="h-8 w-auto object-contain"
              />
            </Link>

            {/* Copyright */}
            <p className="text-sm text-gray-500">
              © {currentYear} {storeName}. All rights reserved.
            </p>

            {/* Legal links */}
            <div className="flex items-center gap-6">
              <Link
                href="/privacy"
                className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
