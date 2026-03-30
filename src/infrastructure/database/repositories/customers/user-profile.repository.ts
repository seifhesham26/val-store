/**
 * UserProfile Repository Implementation
 *
 * Implements UserProfileRepositoryInterface using Drizzle ORM.
 */

import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { UserProfileRepositoryInterface } from "@/domain/customers/interfaces/repositories/user-profile.repository.interface";
import {
  UserProfileEntity,
  UserRole,
} from "@/domain/customers/entities/user-profile.entity";

export class DrizzleUserProfileRepository implements UserProfileRepositoryInterface {
  /**
   * Find profile by ID
   */
  async findById(profileId: string): Promise<UserProfileEntity | null> {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, profileId),
    });

    if (!profile) {
      return null;
    }

    return this.mapToEntity(profile);
  }

  /**
   * Find profile by Better Auth user ID
   */
  async findByUserId(userId: string): Promise<UserProfileEntity | null> {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    });

    if (!profile) {
      return null;
    }

    return this.mapToEntity(profile);
  }

  /**
   * Find all profiles
   */
  async findAll(): Promise<UserProfileEntity[]> {
    const profiles = await db.query.userProfiles.findMany();
    return profiles.map((p) => this.mapToEntity(p));
  }

  /**
   * Find profiles by role
   */
  async findByRole(role: UserRole): Promise<UserProfileEntity[]> {
    const profiles = await db.query.userProfiles.findMany({
      where: eq(userProfiles.role, role),
    });
    return profiles.map((p) => this.mapToEntity(p));
  }

  /**
   * Create new profile
   */
  async create(profile: UserProfileEntity): Promise<UserProfileEntity> {
    const [newProfile] = await db
      .insert(userProfiles)
      .values({
        userId: profile.userId,
        role: profile.role,
      })
      .returning();

    return this.mapToEntity(newProfile);
  }

  /**
   * Update existing profile
   */
  async update(profile: UserProfileEntity): Promise<UserProfileEntity> {
    const [updated] = await db
      .update(userProfiles)
      .set({
        role: profile.role,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.id, profile.id))
      .returning();

    return this.mapToEntity(updated);
  }

  /**
   * Delete profile
   */
  async delete(profileId: string): Promise<void> {
    await db.delete(userProfiles).where(eq(userProfiles.id, profileId));
  }

  /**
   * Check if profile exists for user
   */
  async existsByUserId(userId: string): Promise<boolean> {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
      columns: { id: true },
    });
    return !!profile;
  }

  /**
   * Map database result to entity
   */
  private mapToEntity(dbProfile: {
    id: string;
    userId: string;
    role: "customer" | "worker" | "admin" | "super_admin";
    createdAt: Date;
    updatedAt: Date;
  }): UserProfileEntity {
    return new UserProfileEntity(
      dbProfile.id,
      dbProfile.userId,
      dbProfile.role as UserRole,
      new Date(dbProfile.createdAt),
      new Date(dbProfile.updatedAt)
    );
  }
}
