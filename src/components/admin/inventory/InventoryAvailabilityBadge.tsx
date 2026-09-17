import { Badge } from "@/components/ui/badge";
import type { InventoryInspectionStatus } from "@/domain/inventory/inventory-operations";
import type { InventoryAvailabilityState } from "@/domain/inventory/inventory-policy";
import { getInventoryInspectionLabel } from "./inventory-work-ui";

type InventoryStatus = InventoryAvailabilityState | InventoryInspectionStatus;

interface InventoryAvailabilityBadgeProps {
  state: InventoryStatus;
  className?: string;
}

const labels: Record<InventoryAvailabilityState, string> = {
  available: "Available",
  out_of_stock: "Out of stock",
  manually_unavailable: "Manually unavailable",
  inspection_pending: "Inspection pending",
  quarantined: "Quarantined",
};

const styles: Record<InventoryStatus, string> = {
  available: "border-slate-300 bg-slate-100 text-slate-700",
  out_of_stock: "border-slate-300 bg-slate-100 text-slate-700",
  manually_unavailable: "border-slate-300 bg-slate-100 text-slate-700",
  inspection_pending: "border-amber-300 bg-amber-100 text-amber-900",
  pending: "border-amber-300 bg-amber-100 text-amber-900",
  quarantined: "border-red-300 bg-red-100 text-red-800",
  flaw_reported: "border-red-300 bg-red-100 text-red-800",
  all_fine: "border-emerald-300 bg-emerald-100 text-emerald-800",
};

export function InventoryAvailabilityBadge({
  state,
  className,
}: InventoryAvailabilityBadgeProps) {
  const label =
    state in labels
      ? labels[state as InventoryAvailabilityState]
      : getInventoryInspectionLabel(state as InventoryInspectionStatus);

  return (
    <Badge variant="outline" className={`${styles[state]} ${className ?? ""}`}>
      {label}
    </Badge>
  );
}
