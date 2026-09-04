"use client";

/**
 * Admin Reviews Page
 *
 * Moderate customer reviews - approve, reject, delete.
 */

import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ReviewsHeader } from "@/components/admin/reviews/ReviewsHeader";
import { ReviewTable } from "@/components/admin/reviews/ReviewTable";

export default function AdminReviewsPage() {
  const { data: allPage, isLoading } = trpc.admin.reviews.list.useQuery({});
  const { data: pendingPage } = trpc.admin.reviews.list.useQuery({
    onlyPending: true,
  });

  const allReviews = allPage?.items ?? [];
  const pendingReviews = pendingPage?.items ?? [];

  // The tab labels and the header badge count what *exists*, not what the
  // capped query returned — a "Pending (200)" that is really 340 is the same
  // silent truncation the table now calls out, one line higher up.
  const allTotal = allPage?.total ?? allReviews.length;
  const pendingTotal = pendingPage?.total ?? pendingReviews.length;

  const utils = trpc.useUtils();

  const approveMutation = trpc.admin.reviews.approve.useMutation({
    onSuccess: () => {
      utils.admin.reviews.list.invalidate();
      toast.success("Review approved");
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = trpc.admin.reviews.reject.useMutation({
    onSuccess: () => {
      utils.admin.reviews.list.invalidate();
      toast.success("Review rejected");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.admin.reviews.delete.useMutation({
    onSuccess: () => {
      utils.admin.reviews.list.invalidate();
      toast.success("Review deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleApprove = (id: string) => approveMutation.mutate({ id });
  const handleReject = (id: string) => rejectMutation.mutate({ id });
  const handleDelete = (id: string) => deleteMutation.mutate({ id });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <ReviewsHeader pendingCount={pendingTotal} />

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending">Pending ({pendingTotal})</TabsTrigger>
          <TabsTrigger value="all">All Reviews ({allTotal})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <ReviewTable
            reviews={pendingReviews}
            total={pendingTotal}
            showApproved={false}
            onApprove={handleApprove}
            onReject={handleReject}
            onDelete={handleDelete}
          />
        </TabsContent>
        <TabsContent value="all">
          <ReviewTable
            reviews={allReviews}
            total={allTotal}
            showApproved={true}
            onApprove={handleApprove}
            onReject={handleReject}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
