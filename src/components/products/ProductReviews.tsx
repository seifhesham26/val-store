"use client";

/**
 * Product Reviews Component
 *
 * Displays reviews for a product and allows authenticated users to submit reviews.
 *
 * Styled with explicit storefront colours rather than theme tokens. `:root`
 * holds the *light* palette and the storefront overrides only `<body>`, so the
 * tokens this used to reach for resolved the wrong way round on a black page:
 * `bg-muted` skeletons and panels came out near-white, a bare `border` drew a
 * light grey line, and — worst of the set — the default Button variant is
 * `bg-primary text-primary-foreground`, which is near-black on near-white, so
 * "Write a Review" and "Submit Review" were all but invisible here.
 */

import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

/** Shared by both inputs so the form matches the rest of the storefront. */
const FIELD_CLASSES =
  "border-white/10 bg-white/[0.04] text-white placeholder:text-gray-500";

function StarRating({
  rating,
  size = "md",
}: {
  rating: number;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClasses[size]} ${
            star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-600"
          }`}
        />
      ))}
    </div>
  );
}

function InteractiveStarRating({
  rating,
  onChange,
}: {
  rating: number;
  onChange: (rating: number) => void;
}) {
  const [hoveredRating, setHoveredRating] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHoveredRating(star)}
          onMouseLeave={() => setHoveredRating(0)}
          className="focus:outline-none"
        >
          <Star
            className={`h-6 w-6 transition-colors ${
              star <= (hoveredRating || rating)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-600 hover:text-yellow-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function ProductReviews({ productId }: { productId: string }) {
  const { data: session } = useSession();
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");

  const { data, isLoading } = trpc.public.reviews.getByProduct.useQuery({
    productId,
  });
  const { data: hasReviewed } = trpc.public.reviews.hasReviewed.useQuery(
    { productId },
    { enabled: !!session?.user }
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.public.reviews.create.useMutation({
    onSuccess: () => {
      utils.public.reviews.getByProduct.invalidate({ productId });
      utils.public.reviews.hasReviewed.invalidate({ productId });
      setShowForm(false);
      setRating(5);
      setTitle("");
      setComment("");
      toast.success("Review submitted! It will appear after approval.");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      productId,
      rating,
      title: title.trim() || undefined,
      comment: comment.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="val-skeleton h-6 w-32 rounded" />
        <div className="val-skeleton h-24 rounded" />
      </div>
    );
  }

  const { reviews = [], average = 0, count = 0 } = data ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">
            Customer Reviews
          </h2>
          {count > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <StarRating rating={Math.round(average)} size="md" />
              <span className="text-sm text-gray-400">
                {average.toFixed(1)} out of 5 ({count} review
                {count !== 1 ? "s" : ""})
              </span>
            </div>
          )}
        </div>
        {session?.user && !hasReviewed && !showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="shrink-0 bg-val-accent text-black font-medium hover:bg-val-accent/90"
          >
            Write a Review
          </Button>
        )}
      </div>

      {/* Review Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-white/10 bg-zinc-900 p-5"
        >
          <div className="space-y-2">
            <Label className="text-white">Your Rating</Label>
            <InteractiveStarRating rating={rating} onChange={setRating} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="title" className="text-white">
              Title (optional)
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sum up your review"
              maxLength={255}
              className={FIELD_CLASSES}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comment" className="text-white">
              Review (optional)
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts about this product"
              rows={4}
              maxLength={2000}
              className={FIELD_CLASSES}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-val-accent text-black font-medium hover:bg-val-accent/90"
            >
              {createMutation.isPending ? "Submitting..." : "Submit Review"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
              className="border-white/10 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-12 text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06]">
            <Star className="h-7 w-7 text-gray-500 stroke-[1.5]" />
          </div>
          <h3 className="text-lg font-medium text-white">No reviews yet</h3>
          <p className="max-w-sm text-sm text-gray-400">
            Be the first to review this product and share your thoughts with
            other customers!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-lg border border-white/10 bg-zinc-900 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StarRating rating={review.rating} size="sm" />
                    {review.isVerifiedPurchase && (
                      <span className="text-xs font-medium text-green-400">
                        Verified Purchase
                      </span>
                    )}
                  </div>
                  {review.title && (
                    <h3 className="mt-1 font-medium text-white">
                      {review.title}
                    </h3>
                  )}
                </div>
                <span className="shrink-0 text-xs text-gray-500">
                  {formatDistanceToNow(new Date(review.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              {review.comment && (
                <p className="mt-2 text-sm text-gray-300">{review.comment}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                — {review.userName ?? "Anonymous"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
