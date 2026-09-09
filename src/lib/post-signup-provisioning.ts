/**
 * Side effects that follow account creation, run so that none of them can cost
 * the customer their signup.
 *
 * Better Auth 1.7 dispatches `databaseHooks.user.create.after` through
 * `queueAfterTransactionHook` (`db/with-hooks.mjs`), so by the time these run
 * the `user` row **and** the `account` row holding the password have both
 * committed. A throw here cannot undo either. What it does instead is escape
 * `/sign-up/email`, which is its own kind of bad:
 *
 *   - the endpoint answers with an error and never sets the session cookie,
 *     so the browser is told signup failed;
 *   - the account it says failed to create is real and fully working, so
 *     retrying reports the address is already taken;
 *   - and every step after the throwing one is skipped, so one failed write
 *     silently takes the rest of the provisioning with it.
 *
 * The customer is left on a form insisting their signup failed, holding
 * credentials that would sign them in perfectly well if anything told them to
 * try. Verified against this codebase: an over-long phone number overflows
 * `customers.phone` (`varchar(20)`, while `user.phone` is `text`), and before
 * this module that raised `22001` straight out of the hook.
 *
 * So none of it is allowed to abort signup. Every step runs, every failure is
 * logged and skipped, and the customer gets the session they just earned. What
 * is lost is recoverable and, in each case, degrades safely:
 *
 *   - no `user_profiles` row → `getUserRole` already defaults a missing
 *     profile to `"customer"` (`server/utils/auth-helpers.ts`), the
 *     least-privileged role, so a lost write can never elevate anyone.
 *   - no `customers` row → that table models "a real human" for loyalty and
 *     admin notes and is read by almost nothing today.
 *   - no admin notification → the service already swallows its own failures.
 *
 * The ordering above is Better Auth's and is not guaranteed across versions.
 * If a future release moves these hooks back inside the signup transaction, a
 * throw would once again leave a `user` row with no `account` — which is the
 * genuinely unrecoverable state, because it wedges the password path and
 * social login at once (see `src/db/auth-schema-parity.test.ts`, where a
 * missing column produced exactly that). Swallowing here is the right
 * behaviour under either ordering.
 */

export type ProvisioningStep = {
  /** Named in the log when this step fails. */
  label: string;
  run: () => Promise<void>;
};

/**
 * Run every step in order. Never rejects.
 *
 * @returns the labels of the steps that failed, so a caller can act on a
 * partial result. Signup itself ignores it — there is nothing useful to tell
 * the customer, whose account is fine either way.
 */
export async function runProvisioningSteps(
  steps: ProvisioningStep[]
): Promise<string[]> {
  const failed: string[] = [];

  for (const step of steps) {
    try {
      // Awaited inside the `try` rather than returned, so a synchronous throw
      // before the callback's first `await` is caught here too.
      await step.run();
    } catch (error) {
      failed.push(step.label);
      // The only trace this leaves. A half-provisioned signup is deliberately
      // invisible in the UI, so the server log is where it has to be
      // recoverable from.
      console.error(`[Signup] ${step.label} failed:`, error);
    }
  }

  return failed;
}
