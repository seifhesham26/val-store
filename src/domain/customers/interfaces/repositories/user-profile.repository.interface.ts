/**
 * UserProfile Repository Interface
 *
 * Defines the contract for UserProfile data operations.
 * Implementation will be in the infrastructure layer.
 */

import {
  UserProfileEntity,
  UserRole,
} from "@/domain/customers/entities/user-profile.entity";

export interface UserProfileRepositoryInterface {
  /**
   * Find a user profile by ID
   */
  findById(profileId: string): Promise<UserProfileEntity | null>;

  /**
   * Find a user profile by Better Auth user ID
   */
  findByUserId(userId: string): Promise<UserProfileEntity | null>;

  /**
   * Find all user profiles
   */
  findAll(): Promise<UserProfileEntity[]>;

  /**
   * Find all profiles by role
   */
  findByRole(role: UserRole): Promise<UserProfileEntity[]>;

  /**
   * Create a new user profile
   */
  create(profile: UserProfileEntity): Promise<UserProfileEntity>;

  /**
   * Update an existing user profile
   */
  update(profile: UserProfileEntity): Promise<UserProfileEntity>;

  /**
   * Delete a user profile
   */
  delete(profileId: string): Promise<void>;

  /**
   * Check if a profile exists for a user ID
   */
  existsByUserId(userId: string): Promise<boolean>;
}
