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
import { Edit, FilePlus2, Loader2 } from "lucide-react";
import { TruncationNotice } from "@/components/admin/TruncationNotice";
import type { UserRole } from "@/domain/customers/value-objects/user-role";
import type { InventoryAvailabilityState } from "@/domain/inventory/inventory-policy";
import { InventoryAvailabilityBadge } from "./InventoryAvailabilityBadge";

export interface InventoryVariant {
  variantId: string;
  sku: string;
  productName: string;
  size: string | null;
  color: string | null;
  stockQuantity: number;
  availabilityState?: InventoryAvailabilityState;
}

interface AllStockTabProps {
  variants: InventoryVariant[];
  /** Variants that exist, which may exceed the query's ceiling. */
  total: number;
  onAdjust: (variant: InventoryVariant) => void;
  onRequest: (variant: InventoryVariant) => void;
  role: UserRole | null;
  isRolePending: boolean;
}

export function AllStockTab({
  variants,
  total,
  onAdjust,
  onRequest,
  role,
  isRolePending,
}: AllStockTabProps) {
  const isWorker = role === "worker";
  const canAdjust = role === "admin" || role === "super_admin";

  return (
    <div className="space-y-3">
      <TruncationNotice shown={variants.length} total={total} noun="variants" />
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="w-[150px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.map((v) => (
              <TableRow key={v.variantId}>
                <TableCell className="font-medium">{v.productName}</TableCell>
                <TableCell className="font-mono text-sm">{v.sku}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {[v.size, v.color].filter(Boolean).join(" / ") || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant={
                        v.stockQuantity <= 0 ? "destructive" : "secondary"
                      }
                    >
                      {v.stockQuantity}
                    </Badge>
                    {v.availabilityState && (
                      <InventoryAvailabilityBadge state={v.availabilityState} />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {canAdjust ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAdjust(v)}
                    >
                      <Edit />
                      Adjust stock
                    </Button>
                  ) : isWorker ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRequest(v)}
                    >
                      <FilePlus2 />
                      Request adjustment
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled>
                      {isRolePending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Edit />
                      )}
                      {isRolePending ? "Loading access" : "Unavailable"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
