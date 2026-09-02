import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CareersOpenRoles() {
  return (
    <div className="prose-val max-w-none">
      <h2>Open Positions</h2>
      <p>
        There are no open positions at Valkyrie right now. We&apos;re a lean
        team and we hire when the work genuinely needs it.
      </p>
      <p>
        If that changes, we&apos;ll list roles here. In the meantime, if you
        think you&apos;d be a good fit for where we&apos;re headed, we&apos;re
        happy to hear from you.
      </p>
      <div className="not-prose">
        <Button
          asChild
          className="bg-val-accent hover:bg-val-accent/90 text-black font-medium"
        >
          <Link href="/contact">Get in touch</Link>
        </Button>
      </div>
    </div>
  );
}
