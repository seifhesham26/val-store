"use client";

/**
 * Product Reviews Component
 *
 * Displays reviews for a product and allows authenticated users to submit reviews.
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
            star <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground"
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
                : "text-muted-foreground hover:text-yellow-300"
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
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-32 bg-muted rounded" />
        <div className="h-24 bg-muted rounded" />
      </div>
    );
  }

  const { reviews = [], average = 0, count = 0 } = data ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Customer Reviews</h2>
          {count > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <StarRating rating={Math.round(average)} size="md" />
              <span className="text-sm text-muted-foreground">
                {average.toFixed(1)} out of 5 ({count} review
                {count !== 1 ? "s" : ""})
              </span>
            </div>
          )}
        </div>
        {session?.user && !hasReviewed && !showForm && (
          <Button onClick={() => setShowForm(true)}>Write a Review</Button>
        )}
      </div>

      {/* Review Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="border rounded-lg p-4 space-y-4 bg-muted/30"
        >
          <div className="space-y-2">
            <Label>Your Rating</Label>
            <InteractiveStarRating rating={rating} onChange={setRating} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sum up your review"
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comment">Review (optional)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts about this product"
              rows={4}
              maxLength={2000}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Submitting..." : "Submit Review"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 border rounded-xl bg-muted/10 text-center space-y-3">
          <div className="h-14 w-14 rounded-full bg-muted/30 flex items-center justify-center mb-2">
            <Star className="h-7 w-7 text-muted-foreground stroke-[1.5]" />
          </div>
          <h3 className="font-medium text-lg text-white">No reviews yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            Be the first to review this product and share your thoughts with
            other customers!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <StarRating rating={review.rating} size="sm" />
                    {review.isVerifiedPurchase && (
                      <span className="text-xs text-green-600 font-medium">
                        Verified Purchase
                      </span>
                    )}
                  </div>
                  {review.title && (
                    <h3 className="font-medium mt-1">{review.title}</h3>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(review.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              {review.comment && (
                <p className="text-sm text-muted-foreground mt-2">
                  {review.comment}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                — {review.userName ?? "Anonymous"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
