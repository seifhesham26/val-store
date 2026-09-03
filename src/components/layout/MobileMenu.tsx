"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  X,
  Search,
  User,
  LogIn,
  LogOut,
  Instagram,
  Facebook,
  Twitter,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { useCartStore } from "@/lib/stores/cart-store";

interface NavLink {
  label: string;
  href: string;
  hasDropdown?: boolean;
}

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  navLinks?: NavLink[];
  isLoggedIn?: boolean;
  /**
   * Live top-level categories, resolved on the server.
   *
   * Hardcoded before, which is how "Men's", "Women's" and "Accessories" could
   * keep pointing at pages whose contents no longer matched them, and how three
   * links to categories that never existed survived as 404s.
   */
  categories?: NavLink[];
}

/**
 * Every href here has to resolve to something that exists.
 *
 * These were "Summer 2025", "Essentials" and "Best Sellers" — three
 * collections that have never existed in any seed. `/collections/[slug]` calls
 * `notFound()` on an unknown slug, so all three were hard 404s served to
 * anyone who opened the mobile menu.
 *
 * Replaced with destinations that are real: two live categories and the
 * collections index. If a curated collection is wanted later it needs a
 * `categories` row first — a link is not a collection.
 */
const collectionsLinks = [
  { label: "New Arrivals", href: "/collections/new" },
  { label: "Sale", href: "/collections/sale" },
  { label: "Browse All Collections", href: "/collections" },
];

const socialLinks = [
  {
    icon: Instagram,
    href: "https://instagram.com/valkyrie",
    label: "Instagram",
  },
  { icon: Facebook, href: "https://facebook.com/valkyrie", label: "Facebook" },
  { icon: Twitter, href: "https://twitter.com/valkyrie", label: "Twitter" },
];

export function MobileMenu({
  isOpen,
  onClose,
  isLoggedIn = false,
  categories = [],
}: Omit<MobileMenuProps, "navLinks">) {
  // Live categories, then the curated views that no `categories` row can
  // express. Empty categories degrade to the curated links alone rather than
  // to an empty menu.
  const shopCategories = [
    ...categories,
    { label: "All Products", href: "/collections/all" },
  ];

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Menu panel */}
      <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-black border-l border-white/10 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <Image
            src="/logo/VAL-LOGO.png"
            alt="Valkyrie"
            width={120}
            height={35}
            className="h-7 w-auto object-contain"
          />
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="space-y-1 px-4">
            {/* Shop with subcategories */}
            <div className="py-3">
              <Link
                href="/collections/all"
                className="text-lg font-medium text-white hover:text-val-accent transition-colors uppercase tracking-wider"
                onClick={onClose}
              >
                Shop
              </Link>
              <div className="mt-2 ml-4 space-y-2">
                {shopCategories.map((category) => (
                  <Link
                    key={category.label}
                    href={category.href}
                    className="block text-sm text-gray-400 hover:text-val-accent transition-colors"
                    onClick={onClose}
                  >
                    {category.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* New */}
            <Link
              href="/collections/new"
              className="block py-3 text-lg font-medium text-white hover:text-val-accent transition-colors uppercase tracking-wider"
              onClick={onClose}
            >
              New
            </Link>

            {/* Collections with subcategories */}
            <div className="py-3">
              <span className="text-lg font-medium text-white uppercase tracking-wider">
                Collections
              </span>
              <div className="mt-2 ml-4 space-y-2">
                {collectionsLinks.map((collection) => (
                  <Link
                    key={collection.label}
                    href={collection.href}
                    className="block text-sm text-gray-400 hover:text-val-accent transition-colors"
                    onClick={onClose}
                  >
                    {collection.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Sale */}
            <Link
              href="/collections/sale"
              className="block py-3 text-lg font-medium text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider"
              onClick={onClose}
            >
              Sale
            </Link>
          </div>
        </nav>

        {/* User actions */}
        <div className="border-t border-white/10 p-4 space-y-4">
          <Link
            href="/search"
            className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors"
            onClick={onClose}
          >
            <Search className="h-5 w-5" />
            <span>Search</span>
          </Link>
          {isLoggedIn ? (
            <>
              <Link
                href="/account"
                className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors"
                onClick={onClose}
              >
                <User className="h-5 w-5" />
                <span>My Account</span>
              </Link>
              <button
                onClick={async () => {
                  await signOut({
                    fetchOptions: {
                      onSuccess: () => {
                        // See AccountSidebar: the redirect is a full page load
                        // and would otherwise rehydrate this account's cart
                        // for whoever uses the browser next.
                        useCartStore.getState().clearCart();
                        onClose();
                        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate full page load: sign-out has to reset the Better Auth client session store
                        window.location.href = "/login";
                      },
                    },
                  });
                }}
                className="flex items-center gap-3 text-gray-400 hover:text-red-400 transition-colors w-full"
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-3 text-gray-400 hover:text-val-accent transition-colors"
              onClick={onClose}
            >
              <LogIn className="h-5 w-5" />
              <span>Sign In</span>
            </Link>
          )}
        </div>

        {/* Social links */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-6">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-val-accent transition-colors"
                aria-label={social.label}
              >
                <social.icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
