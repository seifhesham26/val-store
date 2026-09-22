export interface RefundActor {
  id: string;
  role: "worker" | "admin" | "super_admin";
}

export function requireRefundDecisionRole(actor: RefundActor): void {
  if (actor.role !== "admin" && actor.role !== "super_admin") {
    throw new Error("An admin or super admin must make this return decision");
  }
}
