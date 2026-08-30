import { GetOrderOutput } from "@/application/orders/use-cases/get-order.use-case";

/**
 * The client's view of an order.
 *
 * Every Date is a string here: there is no tRPC date transformer configured,
 * so dates arrive serialised.
 */
export type OrderData = Omit<
  GetOrderOutput,
  | "createdAt"
  | "updatedAt"
  | "paidAt"
  | "shippedAt"
  | "deliveredAt"
  | "paymentDeadline"
> & {
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  paymentDeadline: string | null;
};
