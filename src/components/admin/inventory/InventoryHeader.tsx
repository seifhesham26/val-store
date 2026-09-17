import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface InventoryHeaderProps {
  lowStockCount: number;
  pendingWorkCount: number;
}

export function InventoryHeader({
  lowStockCount,
  pendingWorkCount,
}: InventoryHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-2xl font-bold">Inventory</h1>
      <div className="flex flex-wrap gap-2">
        {pendingWorkCount > 0 && (
          <Badge variant="destructive" className="text-sm">
            <AlertTriangle className="h-3 w-3" />
            {pendingWorkCount} pending work item
            {pendingWorkCount === 1 ? "" : "s"}
          </Badge>
        )}
        {lowStockCount > 0 && (
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-100 text-sm text-amber-900"
          >
            <AlertTriangle className="h-3 w-3" />
            {lowStockCount} low-stock variant{lowStockCount === 1 ? "" : "s"}
          </Badge>
        )}
      </div>
    </div>
  );
}
