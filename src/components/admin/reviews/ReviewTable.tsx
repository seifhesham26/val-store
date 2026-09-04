import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Check, X, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { StarRating } from "./StarRating";
import { TruncationNotice } from "@/components/admin/TruncationNotice";

export interface ReviewItem {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isVerifiedPurchase: boolean;
  isApproved: boolean;
  createdAt: Date | string;
  userName: string | null;
}

interface ReviewTableProps {
  reviews: ReviewItem[];
  /** Reviews that match, which may exceed the query's ceiling. */
  total: number;
  showApproved: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ReviewTable({
  reviews,
  total,
  showApproved,
  onApprove,
  onReject,
  onDelete,
}: ReviewTableProps) {
  return (
    <div className="space-y-3">
      <TruncationNotice shown={reviews.length} total={total} noun="reviews" />
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rating</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Date</TableHead>
              {showApproved && <TableHead>Status</TableHead>}
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={showApproved ? 6 : 5}
                  className="text-center py-8 text-muted-foreground"
                >
                  No reviews found
                </TableCell>
              </TableRow>
            )}
            {reviews.map((review) => (
              <TableRow key={review.id}>
                <TableCell>
                  <StarRating rating={review.rating} />
                </TableCell>
                <TableCell>
                  <div className="max-w-md">
                    {review.title && (
                      <p className="font-medium text-sm">{review.title}</p>
                    )}
                    {review.comment && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {review.comment}
                      </p>
                    )}
                    {review.isVerifiedPurchase && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        Verified Purchase
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {review.userName ?? "Anonymous"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(review.createdAt), "MMM d, yyyy")}
                </TableCell>
                {showApproved && (
                  <TableCell>
                    <Badge
                      variant={review.isApproved ? "default" : "secondary"}
                    >
                      {review.isApproved ? "Approved" : "Pending"}
                    </Badge>
                  </TableCell>
                )}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!review.isApproved && (
                        <DropdownMenuItem onClick={() => onApprove(review.id)}>
                          <Check className="h-4 w-4 mr-2" />
                          Approve
                        </DropdownMenuItem>
                      )}
                      {review.isApproved && (
                        <DropdownMenuItem onClick={() => onReject(review.id)}>
                          <X className="h-4 w-4 mr-2" />
                          Unapprove
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onDelete(review.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
