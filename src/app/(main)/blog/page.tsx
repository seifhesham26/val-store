import { ComingSoon } from "@/components/shared/ComingSoon";

export const metadata = {
  title: "Blog | Valkyrie",
  description: "The Valkyrie blog is on its way.",
};

export default function BlogPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <ComingSoon
        heading="The Blog Is On Its Way"
        body="We're putting together stories on the pieces we make and how we make them. Nothing published yet — check back soon."
      />
    </div>
  );
}
