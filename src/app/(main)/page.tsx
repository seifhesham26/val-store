import { ServerHeroSection } from "@/components/home/ServerHeroSection";
import { ServerFeaturedCategories } from "@/components/home/ServerFeaturedCategories";
import { ServerFeaturedProducts } from "@/components/home/ServerFeaturedProducts";
import { ServerNewArrivals } from "@/components/home/ServerNewArrivals";
import { PromoBanner } from "@/components/home/PromoBanner";
import { BrandStory } from "@/components/home/BrandStory";
import { NewsletterSection } from "@/components/home/NewsletterSection";
import { TrustIndicators } from "@/components/home/TrustIndicators";

export default function Home() {
  return (
    <>
      <ServerHeroSection />
      <ServerFeaturedCategories />
      <BrandStory />
      <ServerFeaturedProducts />
      <ServerNewArrivals />
      <PromoBanner />
      <NewsletterSection />
      <TrustIndicators />
    </>
  );
}
