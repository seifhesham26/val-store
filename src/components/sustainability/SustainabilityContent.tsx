import Link from "next/link";

export function SustainabilityContent() {
  return (
    <div className="prose-val max-w-none">
      <h2>Where We Are</h2>
      <p>
        We don&apos;t have formal certifications or published environmental
        reporting yet. This page reflects where we currently stand, and
        we&apos;d rather say that plainly than overstate it.
      </p>
      <h2>Questions</h2>
      <p>
        If you have a question about how a specific piece is made or shipped,{" "}
        <Link href="/contact">contact us</Link> and we&apos;ll answer directly.
      </p>
    </div>
  );
}
