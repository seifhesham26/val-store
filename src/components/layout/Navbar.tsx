"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingCart,
  User,
  Search,
  Menu,
  LogIn,
  Shield,
  Heart,
} from "lucide-react";
import { MobileMenu } from "./MobileMenu";
import { trpc } from "@/lib/trpc";
import { useCartStore } from "@/lib/stores/cart-store";
import { UserNotificationsBell } from "@/components/UserNotificationsBell";
import { SearchDialog, useSearchShortcut } from "@/components/SearchDialog";

// Detect client-side rendering without useEffect+setState (React-endorsed)
const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

const navLinks = [
  { label: "Shop", href: "/collections/all" },
  { label: "New", href: "/collections/new" },
  { label: "Collections", href: "/collections" },
  { label: "Sale", href: "/collections/sale" },
];

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const isClient = useIsClient();
  const { data: user, isLoading } = trpc.public.user.getSession.useQuery();
  const { openCart, getItemCount } = useCartStore();

  const isLoggedIn = !!user;
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  // Defer to 0 during SSR to prevent hydration mismatch from Zustand localStorage rehydration
  const itemCount = isClient ? getItemCount() : 0;
  const { data: wishlistCountData } = trpc.public.wishlist.getCount.useQuery(
    undefined,
    {
      enabled: isLoggedIn,
      initialData: { count: 0 },
    }
  );

  const wishlistCount = isClient ? (wishlistCountData?.count ?? 0) : 0;

  // Cmd/Ctrl+K shortcut for search
  useSearchShortcut(() => setIsSearchOpen(true));

  return (
    <>
      <nav className="sticky top-0 z-50 bg-black border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Left: Nav Links (Desktop) */}
            <div className="hidden md:flex items-center gap-6 flex-1">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-xs sm:text-sm text-gray-300 hover:text-val-accent transition-colors uppercase tracking-wide"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Center: Logo */}
            <Link href="/" className="shrink-0">
              <Image
                src="/logo/VAL-LOGO.png"
                alt="Valkyrie"
                width={140}
                height={40}
                className="h-8 sm:h-9 md:h-10 w-auto object-contain"
                priority
              />
            </Link>

            {/* Right: Icons (Desktop) */}
            <div className="hidden md:flex items-center gap-5 flex-1 justify-end">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="text-gray-300 hover:text-val-accent transition-colors flex items-center gap-1.5"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
                <span className="hidden lg:flex items-center gap-1 text-xs text-gray-500">
                  <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-[10px]">
                    ⌘K
                  </kbd>
                </span>
              </button>

              {/* Auth state */}
              {isLoading ? (
                <div className="w-5 h-5 rounded-full bg-gray-700 animate-pulse" />
              ) : isLoggedIn ? (
                <Link
                  href="/account"
                  className="text-gray-300 hover:text-val-accent transition-colors"
                  title={user?.email}
                >
                  <User className="h-5 w-5" />
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="text-gray-300 hover:text-val-accent transition-colors flex items-center gap-1 text-sm"
                >
                  <LogIn className="h-4 w-4" />
                  <span className="hidden lg:inline">Sign In</span>
                </Link>
              )}

              {/* Wishlist Button */}
              <Link
                href="/account/wishlist"
                className="text-gray-300 hover:text-val-accent transition-colors relative"
                aria-label="Wishlist"
              >
                <Heart className="h-5 w-5" />
                <span
                  className={`absolute -top-2 -right-2 bg-val-accent text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center ${wishlistCount > 0 ? "" : "hidden"}`}
                  suppressHydrationWarning
                >
                  {wishlistCount > 99 ? "99+" : wishlistCount}
                </span>
              </Link>

              {/* Notifications */}
              <UserNotificationsBell />

              {/* Cart Button */}
              <button
                onClick={openCart}
                className="text-gray-300 hover:text-val-accent transition-colors relative"
                aria-label="Open cart"
              >
                <ShoppingCart className="h-5 w-5" />
                <span
                  className={`absolute -top-2 -right-2 bg-val-accent text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center ${itemCount > 0 ? "" : "hidden"}`}
                  suppressHydrationWarning
                >
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              </button>

              {/* Admin Button */}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 text-xs font-semibold uppercase"
                >
                  <Shield className="h-4 w-4" />
                  <span className="hidden xl:inline">Admin</span>
                </Link>
              )}
            </div>

            {/* Mobile: Cart + Menu */}
            <div className="flex md:hidden items-center gap-4">
              <button
                onClick={openCart}
                className="text-gray-300 hover:text-val-accent transition-colors relative"
                aria-label="Open cart"
              >
                <ShoppingCart className="h-5 w-5" />
                <span
                  className={`absolute -top-2 -right-2 bg-val-accent text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center ${itemCount > 0 ? "" : "hidden"}`}
                  suppressHydrationWarning
                >
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              </button>
              <button
                className="text-gray-300 hover:text-val-accent transition-colors"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        isLoggedIn={isLoggedIn}
      />

      <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  );
}
