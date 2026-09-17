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
import { Check, Edit, FilePlus2, Loader2 } from "lucide-react";
import { type InventoryVariant } from "./AllStockTab";
import type { UserRole } from "@/domain/customers/value-objects/user-role";
import type { InventoryInspectionView } from "./inventory-work-ui";
import { InventoryAvailabilityBadge } from "./InventoryAvailabilityBadge";

interface LowStockTabProps {
  variants: InventoryVariant[];
  onAdjust: (variant: InventoryVariant) => void;
  onRequest: (variant: InventoryVariant, inspectionId?: string | null) => void;
  inspectionByVariant: ReadonlyMap<string, InventoryInspectionView>;
  onCompleteInspection: (inspection: InventoryInspectionView) => void;
  role: UserRole | null;
  isRolePending: boolean;
}

export function LowStockTab({
  variants,
  onAdjust,
  onRequest,
  inspectionByVariant,
  onCompleteInspection,
  role,
  isRolePending,
}: LowStockTabProps) {
  const isWorker = role === "worker";
  const canAdjust = role === "admin" || role === "super_admin";

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="w-[230px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center py-8 text-muted-foreground"
              >
                No low stock items
              </TableCell>
            </TableRow>
          )}
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
                    variant={v.stockQuantity <= 0 ? "destructive" : "secondary"}
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
                  <div className="flex flex-wrap justify-end gap-2">
                    {inspectionByVariant.has(v.variantId) && (
                      <Button
                        size="sm"
                        onClick={() =>
                          onCompleteInspection(
                            inspectionByVariant.get(v.variantId)!
                          )
                        }
                      >
                        <Check />
                        All fine
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onRequest(v, inspectionByVariant.get(v.variantId)?.id)
                      }
                    >
                      <FilePlus2 />
                      Request adjustment
                    </Button>
                  </div>
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
  );
}
