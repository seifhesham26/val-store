import type { OrderAddress } from "@/domain/orders/entities/order.entity";

/**
 * A resolved order address, as a customer would read it.
 *
 * The confirmation email used to print "Address will be confirmed separately"
 * because it was assembled from the Stripe session, which knows nothing about
 * the order. `OrderEntity.shippingAddress` is a resolved `OrderAddress` joined
 * by the repository on every read, so the real address was always available.
 *
 * Kept pure and separate from the send so it can be tested without a mail
 * provider.
 */
export function formatOrderAddress(address: OrderAddress | null): string {
  if (!address) return "No shipping address on file";

  // City, state and postal code share a line, and any of the three may be
  // blank — joining naively leaves "Cairo, " or a stray space.
  const cityLine = [
    [address.city, address.state].filter((part) => part?.trim()).join(", "),
    address.postalCode,
  ]
    .filter((part) => part?.trim())
    .join(" ");

  return [
    address.fullName,
    address.addressLine1,
    address.addressLine2,
    cityLine,
    address.country,
    address.phone,
  ]
    .filter((line): line is string => Boolean(line && line.trim()))
    .join("\n");
}
