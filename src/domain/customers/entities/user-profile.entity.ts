/**
 * UserProfile Entity
 *
 * Extends Better Auth's user table with role information.
 * Phone is stored in the `user` table (Better Auth) and `customers` table.
 * Addresses are stored in the `addresses` table.
 */

export type UserRole = "customer" | "worker" | "admin" | "super_admin";

export class UserProfileEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string, // FK to Better Auth user.id
    public readonly role: UserRole,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  /**
   * Check if user is an admin (admin or super_admin)
   */
  isAdmin(): boolean {
    return this.role === "admin" || this.role === "super_admin";
  }

  /**
   * Check if user is a super admin
   */
  isSuperAdmin(): boolean {
    return this.role === "super_admin";
  }

  /**
   * Check if user is a worker
   */
  isWorker(): boolean {
    return this.role === "worker";
  }

  /**
   * Check if user is a customer
   */
  isCustomer(): boolean {
    return this.role === "customer";
  }

  /**
   * Check if user can access admin panel (admin, super_admin, or worker)
   */
  canAccessAdminPanel(): boolean {
    return this.isAdmin() || this.isWorker();
  }

  /**
   * Check if user can manage products (admin or super_admin only)
   */
  canManageProducts(): boolean {
    return this.isAdmin();
  }

  /**
   * Check if user can manage users (super_admin only)
   */
  canManageUsers(): boolean {
    return this.isSuperAdmin();
  }
}
