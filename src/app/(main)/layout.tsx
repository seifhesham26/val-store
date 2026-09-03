import { Footer } from "@/components/layout/Footer";
import { ServerAnnouncementBar } from "@/components/layout/ServerAnnouncementBar";
import { Navbar } from "@/components/layout/Navbar";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { CartProvider } from "@/components/providers/cart-provider";
import { CartStockProvider } from "@/components/providers/cart-stock-provider";
import { VariantStockProvider } from "@/components/providers/variant-stock-provider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartStockDialog } from "@/components/cart/CartStockDialog";
import { StorefrontTheme } from "@/components/providers/storefront-theme";
import { getCachedNavCategories, type NavCategory } from "@/lib/cache";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolved here rather than inside the client Navbar, so the links are in the
  // first HTML rather than appearing a beat after hydration — and so a
  // navigation that is on every page costs no client request at all.
  //
  // Degrades like the Footer and the homepage sections: the nav must render
  // even when the database does not answer, falling back to the curated links
  // the menu keeps anyway.
  let categories: NavCategory[] = [];

  try {
    categories = await getCachedNavCategories();
  } catch (error) {
    console.error("[MainLayout] Failed to fetch nav categories:", error);
  }

  return (
    <TRPCProvider>
      <CartProvider>
        <CartStockProvider>
          {/* One live-stock query for every product card on the page, however
              many grids it holds. Mounted at the layout so the homepage's three
              separate grids share it too. */}
          <VariantStockProvider>
            <StorefrontTheme />
            <ServerAnnouncementBar />
            <Navbar categories={categories} />
            <main className="min-h-screen">{children}</main>
            <Footer />
            <CartDrawer />
            <CartStockDialog />
          </VariantStockProvider>
        </CartStockProvider>
      </CartProvider>
    </TRPCProvider>
  );
}
