import { StorefrontTheme } from "@/components/providers/storefront-theme";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-12">
      <StorefrontTheme />
      {children}
    </div>
  );
}
