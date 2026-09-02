import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { getCachedSiteSettings } from "@/lib/cache";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Site metadata, read from settings rather than hardcoded.
 *
 * `defaultMetaTitle`, `defaultMetaDescription`, `storeName` and `faviconUrl`
 * have been settable in the admin all along and were read by nothing.
 *
 * `getCachedSiteSettings` goes through `unstable_cache`, so this does NOT make
 * the route tree dynamic — the build must still report the same static page
 * count. If that ever changes, revert this rather than trade the prerendering
 * for a settable title; the whole performance pass rests on those pages being
 * static. Falls back to the previous literals on any read failure.
 */
export async function generateMetadata(): Promise<Metadata> {
  let settings: Awaited<ReturnType<typeof getCachedSiteSettings>> = null;

  try {
    settings = await getCachedSiteSettings();
  } catch {
    settings = null;
  }

  const storeName = settings?.storeName || "Valkyrie";
  const title = settings?.defaultMetaTitle || `${storeName} - Premium Clothing`;
  const description =
    settings?.defaultMetaDescription ||
    "Your premier destination for quality clothing";

  return {
    title,
    description,
    ...(settings?.faviconUrl ? { icons: { icon: settings.faviconUrl } } : {}),
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `dark` is the storefront's palette, set on <html> rather than on a
    // wrapper because Radix portals attach under <body> and would escape any
    // wrapper. The admin tree's next-themes provider overrides this element
    // for /admin; StorefrontTheme re-asserts it on the way back out.
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
