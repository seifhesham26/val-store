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
  ChevronRight,
  Instagram,
  Facebook,
  Twitter,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { useCartStore } from "@/lib/stores/cart-store";
import { cn } from "@/lib/utils";

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

/**
 * A group heading. Deliberately not a link, and deliberately nothing like one.
 *
 * This is the storefront's eyebrow style — the same one `CollectionBanner`
 * uses — because that is what it is.
 */
function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-0.5 pb-1 pt-5 text-[11px] font-medium uppercase tracking-[0.28em] text-gray-500">
      {children}
    </p>
  );
}

/**
 * Anything that navigates: a full-width row with a chevron and a pressed
 * state, so a tap target looks like a tap target.
 *
 * `emphasis` only changes weight and colour. It does not change whether the
 * row is a link — every row is.
 */
function MenuRow({
  href,
  onClick,
  emphasis = "sub",
  children,
}: {
  href: string;
  onClick: () => void;
  emphasis?: "sub" | "primary" | "sale";
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group -mx-2 flex items-center justify-between rounded-lg px-2 py-3 transition-colors active:bg-white/10",
        emphasis === "sale"
          ? "text-red-400 hover:text-red-300"
          : emphasis === "primary"
            ? "text-white hover:text-val-accent"
            : "text-gray-300 hover:text-white"
      )}
    >
      <span
        className={
          emphasis === "sub"
            ? "text-base"
            : "text-lg font-medium uppercase tracking-wider"
        }
      >
        {children}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-600 transition-transform group-hover:translate-x-0.5 group-hover:text-current" />
    </Link>
  );
}

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

      {/*
       * Menu panel.
       *
       * `h-[100dvh]` rather than `inset-y-0`: a fixed element is laid out
       * against the *layout* viewport, which on a phone is the tall one with
       * the URL bar retracted — so the last section of the panel sat behind the
       * browser's own chrome and read as content hidden under the block above
       * it. The dynamic unit tracks the visible viewport instead.
       *
       * Every section below is `shrink-0` for the other half of the same bug.
       * Flex children shrink by default, and these have fixed-height contents
       * that cannot shrink with them, so on a short viewport they overlapped
       * instead of yielding. The scrollable nav is the only thing that gives.
       */}
      <div className="absolute top-0 right-0 flex h-[100dvh] w-full max-w-sm flex-col border-l border-white/10 bg-black animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between p-4 border-b border-white/10">
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

        {/*
         * Navigation.
         *
         * Two kinds of thing, two visual languages. Before this, a group
         * heading and a destination were both `text-lg font-medium uppercase
         * tracking-wider`, so "Shop" (a link), "Collections" (a plain `span`,
         * not clickable at all) and "New" (a link) were indistinguishable —
         * and all three read as headings rather than as anything tappable.
         *
         * "Shop" and "Collections" are now headings and nothing else. That
         * costs no destination: "All Products" sits directly under the first
         * and "Browse All Collections" under the second, which is where those
         * two links already went.
         */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <MenuLabel>Shop</MenuLabel>
          {shopCategories.map((category) => (
            <MenuRow
              key={category.label}
              href={category.href}
              onClick={onClose}
            >
              {category.label}
            </MenuRow>
          ))}

          <div className="mt-4 h-px bg-white/10" />
          <MenuRow href="/collections/new" onClick={onClose} emphasis="primary">
            New
          </MenuRow>
          <div className="h-px bg-white/10" />

          <MenuLabel>Collections</MenuLabel>
          {collectionsLinks.map((collection) => (
            <MenuRow
              key={collection.label}
              href={collection.href}
              onClick={onClose}
            >
              {collection.label}
            </MenuRow>
          ))}

          <div className="mt-4 h-px bg-white/10" />
          <MenuRow href="/collections/sale" onClick={onClose} emphasis="sale">
            Sale
          </MenuRow>
        </nav>

        {/* User actions */}
        <div className="shrink-0 border-t border-white/10 p-4 space-y-4">
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
        {/*
         * The safe-area padding is why this is the section that was getting
         * lost: it is the last thing in the panel, so it is the one that ends
         * up under the home indicator on a notched phone.
         */}
        <div className="shrink-0 border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-center gap-8">
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
