"use client";

/**
 * Admin Inventory Page
 *
 * View stock levels, adjust quantities, and view history.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, AlertTriangle, History } from "lucide-react";
import { InventoryHeader } from "@/components/admin/inventory/InventoryHeader";
import {
  AllStockTab,
  type InventoryVariant,
} from "@/components/admin/inventory/AllStockTab";
import { LowStockTab } from "@/components/admin/inventory/LowStockTab";
import { HistoryTab } from "@/components/admin/inventory/HistoryTab";
import { AdjustStockDialog } from "@/components/admin/inventory/AdjustStockDialog";

export default function AdminInventoryPage() {
  const [adjustingVariant, setAdjustingVariant] =
    useState<InventoryVariant | null>(null);

  const { data: variantPage, isLoading } =
    trpc.admin.inventory.listVariants.useQuery();
  const allVariants = variantPage?.items ?? [];
  const { data: lowStock = [] } = trpc.admin.inventory.getLowStock.useQuery({
    threshold: 10,
  });
  const { data: logs = [] } = trpc.admin.inventory.getLogs.useQuery({
    limit: 50,
  });

  const utils = trpc.useUtils();

  const handleAdjustSuccess = () => {
    utils.admin.inventory.listVariants.invalidate();
    utils.admin.inventory.getLowStock.invalidate();
    utils.admin.inventory.getLogs.invalidate();
  };

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
      <InventoryHeader lowStockCount={lowStock.length} />

      <Tabs defaultValue="all">
        <TabsList className="mb-4">
          <TabsTrigger value="all">
            <Package className="h-4 w-4 mr-1" />
            All Stock ({allVariants.length})
          </TabsTrigger>
          <TabsTrigger value="low">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Low Stock ({lowStock.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-1" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <AllStockTab
            variants={allVariants}
            total={variantPage?.total ?? allVariants.length}
            onAdjust={setAdjustingVariant}
          />
        </TabsContent>

        <TabsContent value="low">
          <LowStockTab variants={lowStock} onAdjust={setAdjustingVariant} />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab logs={logs} />
        </TabsContent>
      </Tabs>

      <AdjustStockDialog
        variant={adjustingVariant}
        open={!!adjustingVariant}
        onOpenChange={(open) => !open && setAdjustingVariant(null)}
        onSuccess={handleAdjustSuccess}
      />
    </div>
  );
}
