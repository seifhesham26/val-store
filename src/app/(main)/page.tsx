import { ServerHeroSection } from "@/components/home/ServerHeroSection";
import { ServerFeaturedCategories } from "@/components/home/ServerFeaturedCategories";
import { ServerFeaturedProducts } from "@/components/home/ServerFeaturedProducts";
import { ServerNewArrivals } from "@/components/home/ServerNewArrivals";
import { ServerPromoBanner } from "@/components/home/ServerPromoBanner";
import { ServerBrandStory } from "@/components/home/ServerBrandStory";
import { NewsletterSection } from "@/components/home/NewsletterSection";
import { TrustIndicators } from "@/components/home/TrustIndicators";

export default function Home() {
  return (
    <>
      <ServerHeroSection />
      <ServerFeaturedCategories />
      <ServerBrandStory />
      <ServerFeaturedProducts />
      <ServerNewArrivals />
      <ServerPromoBanner />
      <NewsletterSection />
      <TrustIndicators />
    </>
  );
}
