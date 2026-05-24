import { OrdersListHeader } from "@/components/admin/orders/list/OrdersListHeader";
import { OrdersTable } from "@/components/admin/orders/list/OrdersTable";

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <OrdersListHeader />
      <OrdersTable />
    </div>
  );
}
