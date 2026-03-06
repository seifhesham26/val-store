import { GetOrderOutput } from "@/application/orders/use-cases/get-order.use-case";

export type OrderData = Omit<
  GetOrderOutput,
  "createdAt" | "updatedAt" | "paidAt" | "shippedAt" | "deliveredAt"
> & {
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
};
