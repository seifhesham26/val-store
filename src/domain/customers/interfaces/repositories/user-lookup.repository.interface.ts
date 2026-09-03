/**
 * User Lookup Repository Interface
 *
 * Read-only interface for querying Better Auth's user table.
 * This is intentionally thin — Better Auth manages writes,
 * we only need lookups for auth-related features.
 */

export interface UserLookupRepositoryInterface {
  /**
   * Every account registered against a phone number, oldest first.
   *
   * Deliberately plural. `user.phone` carries no unique constraint and is not
   * going to get one: one human may hold several accounts on one number, and
   * the phone-keyed `customers` table exists to model exactly that.
   *
   * This replaced `findEmailByPhone`, which returned a single row via
   * `limit(1)` with **no ordering**. Postgres is free to return either
   * matching row, so with two accounts on one number the account you signed
   * into was effectively arbitrary and could change between attempts — and
   * whichever account lost the toss could never sign in by phone at all.
   *
   * Bounded by the caller: sign-in verifies a password against each candidate
   * in turn, and password hashing is deliberately expensive.
   */
  findAccountsByPhone(
    phone: string,
    limit: number
  ): Promise<{ email: string }[]>;
}
