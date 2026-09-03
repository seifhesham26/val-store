/**
 * Work that should happen because of a request, but that the caller of that
 * request must not wait for.
 *
 * Order confirmation emails and admin notifications are both this shape: the
 * order has already committed, the customer's response is complete without
 * them, and neither is allowed to fail the checkout. What they are *not* is
 * optional — an email nobody sends is a customer who never hears from us.
 *
 * That rules out the obvious `void promise`. On a serverless host the
 * instance can be frozen or torn down as soon as the response is returned,
 * with any still-pending promise simply never resumed. The work has to be
 * registered with the platform so the platform keeps the invocation alive
 * for it, which is what `after()` does and what the Next implementation of
 * this interface delegates to.
 *
 * It lives here, in the application layer, as an interface rather than an
 * import: `after` comes from `next/server`, and a use case reaching for that
 * directly would put the web framework inside the layer that is supposed to
 * be independent of it.
 */
export interface TaskSchedulerInterface {
  /**
   * Run `task` after the current response has been sent.
   *
   * Returns immediately. Implementations must absorb failures — a caller has
   * already returned by the time this runs, so there is nobody left to throw
   * to, and an escaping rejection would surface as an unhandled one.
   */
  runAfterResponse(label: string, task: () => Promise<void>): void;
}
