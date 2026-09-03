/**
 * The customer-facing order number: `VLK-YYYYMMDD-XXXXXXXX`.
 *
 * It was `Math.random().toString(36).slice(2, 8).toUpperCase()`, which has two
 * problems and one non-problem worth recording so nobody re-investigates it.
 *
 * **The real defect was that a collision was fatal.** `orders.order_number`
 * carries a unique constraint, and the insert happens inside the transaction
 * that also writes the items, the payment row, the stock decrement and the
 * coupon redemption. A duplicate therefore aborted the entire checkout and
 * surfaced to the customer as a generic failure — for an order that was
 * otherwise perfectly valid and would have succeeded on a second attempt.
 * `generateOrderNumber` cannot fix that alone, however much entropy it has;
 * the repository retries, and this only makes the retry vanishingly rare.
 *
 * **`Math.random()` is predictable.** Not a live vulnerability — the order
 * endpoints authorise on `userId` and never on the number — but the number is
 * quoted in confirmation emails and to support, so it is exactly the kind of
 * value someone later builds a "track my order" lookup on. Crypto randomness
 * costs nothing here and removes that future footgun.
 *
 * **The non-problem:** `.toString(36).slice(2, 8)` looks like it could return
 * fewer than six characters for a value with a short base-36 representation.
 * Measured over five million samples on V8, it returned six characters every
 * single time. It was not a source of collisions and is not why this changed.
 */

/**
 * Thirty-two characters, and exactly thirty-two on purpose.
 *
 * A random byte is 0-255, and 256 divides evenly by 32, so `byte % 32` is
 * uniform over the alphabet with no rejection sampling and no modulo bias. An
 * alphabet of any other size would quietly skew toward its first few
 * characters.
 *
 * Crockford's base32 set: the digits and the uppercase letters minus I, L, O
 * and U. The first three are dropped because they are unreadable next to 1 and
 * 0 in a number people read down a phone line to support; U is dropped because
 * removing it makes accidental profanity essentially impossible.
 */
export const ORDER_NUMBER_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Characters of randomness. 32^8 ≈ 1.1 × 10^12 per day. */
export const ORDER_NUMBER_RANDOM_LENGTH = 8;

/** The unique constraint a duplicate number violates. */
export const ORDER_NUMBER_CONSTRAINT = "orders_order_number_unique";

export type RandomBytes = (length: number) => Uint8Array;

const cryptoRandomBytes: RandomBytes = (length) =>
  globalThis.crypto.getRandomValues(new Uint8Array(length));

/**
 * `VLK-YYYYMMDD-XXXXXXXX`.
 *
 * The date part is deliberately kept: it makes the number sortable by eye and
 * scopes collisions to a single day rather than to all time. `randomBytes` is
 * injectable so the format can be tested deterministically — nothing in
 * production should pass it.
 */
export function generateOrderNumber(
  now: Date,
  randomBytes: RandomBytes = cryptoRandomBytes
): string {
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");

  const bytes = randomBytes(ORDER_NUMBER_RANDOM_LENGTH);
  let randomPart = "";
  for (const byte of bytes) {
    randomPart += ORDER_NUMBER_ALPHABET[byte % ORDER_NUMBER_ALPHABET.length];
  }

  return `VLK-${datePart}-${randomPart}`;
}

/**
 * Is this error a duplicate order number, and nothing else?
 *
 * Narrow on purpose. The transaction this guards also enforces stock
 * availability and coupon redemption limits, and retrying either of those
 * would be wrong — a customer told "only 2 left" must see that, not have it
 * silently attempted four more times. Only a name clash is retryable, because
 * only a name clash is guaranteed to be different next time.
 *
 * Walks the `cause` chain: Drizzle wraps the driver's error, so the Postgres
 * code is not on the object that reaches the caller.
 */
export function isOrderNumberCollision(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; current && depth < 5; depth++) {
    const candidate = current as {
      code?: unknown;
      constraint_name?: unknown;
      cause?: unknown;
    };

    if (
      candidate.code === "23505" &&
      candidate.constraint_name === ORDER_NUMBER_CONSTRAINT
    ) {
      return true;
    }

    current = candidate.cause;
  }

  return false;
}
