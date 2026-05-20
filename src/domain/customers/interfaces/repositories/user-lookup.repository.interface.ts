/**
 * User Lookup Repository Interface
 *
 * Read-only interface for querying Better Auth's user table.
 * This is intentionally thin — Better Auth manages writes,
 * we only need lookups for auth-related features.
 */

export interface UserLookupRepositoryInterface {
  /**
   * Find a user's email by their phone number.
   * Used for phone-based login (look up email, then sign in with email/password).
   */
  findEmailByPhone(phone: string): Promise<string | null>;
}
