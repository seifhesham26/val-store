import Link from "next/link";

export function PressKit() {
  return (
    <div className="prose-val max-w-none mb-12">
      <h2>About Valkyrie</h2>
      <p>
        Valkyrie is a premium streetwear store based in Egypt, offering clothing
        and accessories for men and women. More on our{" "}
        <Link href="/about">About page</Link>.
      </p>
      <h2>Coverage</h2>
      <p>
        We don&apos;t have press coverage to share yet. If you&apos;ve written
        about Valkyrie, we&apos;d love to see it — let us know.
      </p>
    </div>
  );
}
