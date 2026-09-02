import Image from "next/image";
import { cn } from "@/lib/utils";

// The wordmark asset is a fixed 2040x528 (~3.9:1) metallic "COMING SOON"
// lockup. Passing its real intrinsic size to next/image keeps the layout
// stable while `w-full h-auto` lets it scale down inside `containerClassName`
// instead of rendering at native width on small screens.
const IMAGE_WIDTH = 2040;
const IMAGE_HEIGHT = 528;

export interface ComingSoonProps {
  /** Optional heading rendered below the wordmark. Omit to let the image stand alone. */
  heading?: string;
  /** Optional supporting copy rendered below the heading. */
  body?: string;
  /** Extra classes for the outer wrapper. */
  className?: string;
  /** Extra classes for the image itself, e.g. to change its max-width. */
  imageClassName?: string;
}

/**
 * Reusable "coming soon" placeholder built around the wordmark at
 * `public/brand/coming-soon.png`. Currently used by `/blog`, but written to
 * be dropped into any other route that isn't ready yet — hence the optional
 * heading/body rather than hardcoded blog copy.
 */
export function ComingSoon({
  heading,
  body,
  className,
  imageClassName,
}: ComingSoonProps) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center gap-6 py-16 text-center",
        className
      )}
    >
      <Image
        src="/brand/coming-soon.png"
        alt={heading ?? "Coming soon"}
        width={IMAGE_WIDTH}
        height={IMAGE_HEIGHT}
        sizes="(max-width: 640px) 85vw, 448px"
        className={cn("h-auto w-full", imageClassName)}
        priority
      />
      {heading && (
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          {heading}
        </h1>
      )}
      {body && <p className="max-w-md text-muted-foreground">{body}</p>}
    </div>
  );
}
