import { Footer } from "@/components/layout/Footer";
import { ServerAnnouncementBar } from "@/components/layout/ServerAnnouncementBar";
import { Navbar } from "@/components/layout/Navbar";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { CartProvider } from "@/components/providers/cart-provider";
import { CartStockProvider } from "@/components/providers/cart-stock-provider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartStockDialog } from "@/components/cart/CartStockDialog";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TRPCProvider>
      <CartProvider>
        <CartStockProvider>
          <ServerAnnouncementBar />
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Footer />
          <CartDrawer />
          <CartStockDialog />
        </CartStockProvider>
      </CartProvider>
    </TRPCProvider>
  );
}
