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

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
            <Navbar />
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
