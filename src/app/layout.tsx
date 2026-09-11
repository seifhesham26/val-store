import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { getCachedSiteSettings } from "@/lib/cache";
import { SITE_ORIGIN } from "@/lib/site-url";
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
    // Required for every relative URL in metadata below this point to resolve.
    // Without it, the `openGraph.images` on `/products/[slug]` resolve against
    // whatever origin Next infers — localhost in development, and a build
    // error if a relative field is used at all. See `site-url.ts` for why the
    // fallback is the production domain rather than localhost.
    metadataBase: SITE_ORIGIN,
    applicationName: storeName,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: storeName,
      title,
      description,
      url: "/",
      // Egypt, English. This is the store's locale, not the visitor's — the
      // site is not translated, so claiming otherwise would be a lie to a
      // crawler. It matches the `en-EG` that `currency.ts` formats prices in.
      locale: "en_EG",
    },
    twitter: {
      // The large card. `opengraph-image.png`/`twitter-image.png` are 1200x630
      // and wired automatically by Next's file convention, so no image needs
      // naming here — but the card type does, or X renders the small square.
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        // Uncapped rich results. The defaults truncate the snippet and forbid
        // large image previews, which for a clothing store means product
        // images do not appear in Google Images or Discover at usable size.
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    // A favicon set in the admin wins over the generated `favicon.ico` /
    // `icon.png` / `apple-icon.png` file conventions. Left last so it is
    // obvious that it is an override, and left optional so the generated set
    // is what ships when the field is empty — which it is by default.
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
    //
    // `<body>` carries NO colour literals, and that is the fix for the
    // white-on-white bug family rather than a tidy-up. `globals.css` already
    // has `@layer base { body { @apply bg-background text-foreground } }`, but
    // a utility class on this element outranks a base layer — so `bg-black
    // text-white` pinned the body under *both* palettes, and every Radix
    // portal (which attaches under <body>, outside any wrapper) inherited
    // white text even in the light-themed admin. Letting the base layer win is
    // what makes a portalled surface correct in both themes by default.
    // The storefront still renders pure black because `.dark` now defines it
    // as pure black — see the note on those tokens in globals.css.
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
