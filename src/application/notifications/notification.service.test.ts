import { describe, expect, it, vi } from "vitest";
import { NotificationService } from "./notification.service";
import type { NotificationsRepositoryInterface } from "@/domain/notifications/interfaces/repositories/notifications.repository.interface";
import type { UserNotificationsRepositoryInterface } from "@/domain/notifications/interfaces/repositories/user-notifications.repository.interface";
import type { InventoryRepositoryInterface } from "@/domain/inventory/interfaces/repositories/inventory.repository.interface";
import { notificationIcon } from "@/components/notifications/notification-visuals";
import { ClipboardCheck } from "lucide-react";

function setup(ids = ["admin", "super_admin"]) {
  const createMany = vi.fn();
  const findAdminUserIds = vi.fn().mockResolvedValue(ids);
  const service = new NotificationService(
    {
      createMany,
      findAdminUserIds,
    } as unknown as NotificationsRepositoryInterface,
    {} as UserNotificationsRepositoryInterface,
    {} as InventoryRepositoryInterface
  );
  return { service, createMany, findAdminUserIds };
}
const input = {
  requestId: "request",
  sku: "SHIRT-M",
  category: "damaged" as const,
  quantity: 3,
};
describe("inventory request notifications", () => {
  it("fans out the saved request to the repository's admin recipients", async () => {
    const { service, createMany } = setup();
    await service.inventoryAdjustmentRequested(input);
    expect(createMany).toHaveBeenCalledWith(
      ["admin", "super_admin"].map((adminUserId) => ({
        adminUserId,
        notificationType: "inventory_request",
        title: "Inventory request awaiting review",
        message: expect.stringMatching(/SHIRT-M.*damaged.*3/),
        relatedEntityId: "request",
      }))
    );
    expect(notificationIcon("inventory_request")).toBe(ClipboardCheck);
  });
  it("skips writes with no recipients", async () => {
    const { service, createMany } = setup([]);
    await service.inventoryAdjustmentRequested(input);
    expect(createMany).not.toHaveBeenCalled();
  });
  it.each(["lookup", "insert"])(
    "swallows and logs %s failures",
    async (phase) => {
      const { service, createMany, findAdminUserIds } = setup();
      const error = new Error("offline");
      (phase === "lookup" ? findAdminUserIds : createMany).mockRejectedValue(
        error
      );
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      await expect(
        service.inventoryAdjustmentRequested(input)
      ).resolves.toBeUndefined();
      expect(log).toHaveBeenCalledWith(
        "[Notifications] inventoryAdjustmentRequested failed:",
        error
      );
      log.mockRestore();
    }
  );
});
