import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/currency";

interface CustomerDetailDialogProps {
  customerId: string | null;
  onClose: () => void;
}

export function CustomerDetailDialog({
  customerId,
  onClose,
}: CustomerDetailDialogProps) {
  const { data: customerDetail, isLoading } =
    trpc.admin.customers.getById.useQuery(
      { id: customerId! },
      { enabled: !!customerId }
    );

  return (
    <Dialog open={!!customerId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customer Details</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-muted rounded" />
            <div className="h-32 bg-muted rounded" />
          </div>
        ) : customerDetail ? (
          <div className="space-y-6">
            {/* Customer Info */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={customerDetail.image ?? undefined} />
                <AvatarFallback className="text-xl">
                  {customerDetail.name?.charAt(0).toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">{customerDetail.name}</h3>
                <p className="text-muted-foreground">{customerDetail.email}</p>
                <p className="text-sm text-muted-foreground">
                  Joined{" "}
                  {format(new Date(customerDetail.createdAt), "MMMM d, yyyy")}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-xl p-5 flex items-center gap-4 bg-muted/20">
                <div className="p-3 bg-primary/10 rounded-full">
                  <ShoppingBag className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold tracking-tight">
                    {customerDetail.orderCount}
                  </p>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Total Orders
                  </p>
                </div>
              </div>
              <div className="border rounded-xl p-5 flex items-center gap-4 bg-muted/20">
                <div className="p-3 bg-green-500/10 rounded-full">
                  <DollarSign className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-3xl font-bold tracking-tight">
                    {formatCurrency(customerDetail.totalSpent)}
                  </p>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Total Spent
                  </p>
                </div>
              </div>
            </div>

            {/* Orders */}
            <div className="pt-2">
              <h4 className="font-semibold text-lg mb-4">Order History</h4>
              {customerDetail.orders.length === 0 ? (
                <div className="text-center py-8 border rounded-xl bg-muted/10">
                  <p className="text-muted-foreground">No orders placed yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customerDetail.orders.map((order) => (
                    <div
                      key={order.id}
                      className="border rounded-xl p-4 flex sm:flex-row flex-col sm:items-center justify-between gap-4 hover:bg-muted/10 transition-colors"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-medium">
                            #{order.id.slice(-8).toUpperCase()}
                          </p>
                          <span className="text-muted-foreground text-xs">
                            •
                          </span>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(order.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {order.items.length} item
                          {order.items.length !== 1 ? "s" : ""}
                        </p>
                      </div>

                      <div className="flex sm:flex-col flex-row items-center sm:items-end justify-between sm:justify-center gap-2">
                        <p className="font-semibold text-lg">
                          {formatCurrency(parseFloat(order.totalAmount))}
                        </p>
                        <Badge
                          variant={
                            order.status === "delivered"
                              ? "default"
                              : order.status === "cancelled"
                                ? "destructive"
                                : "secondary"
                          }
                          className="capitalize"
                        >
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
