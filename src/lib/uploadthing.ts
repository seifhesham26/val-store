/**
 * UploadThing Core Configuration
 *
 * Defines file routers for different upload contexts:
 * - Product images
 * - Category images
 * - User avatars
 */

import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { z } from "zod";
import { container } from "@/application/container";
import { ReturnEvidenceUploadService } from "@/infrastructure/services/uploadthing-evidence-storage.service";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  getUserRole,
  isAdminAreaRole,
  isAdminRole,
} from "@/server/utils/auth-helpers";

const f = createUploadthing();

/**
 * The signed-in user, or null. One reader for all three routes — there used to
 * be two, which is part of how the admin gate below drifted out of sync.
 */
async function currentUser() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session?.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve the uploader and require admin.
 *
 * The role comes from `user_profiles`, never from the session. The previous
 * implementation read `session.session.role`, but the `session` table has no
 * `role` column and none is declared in `additionalFields` — so that value was
 * always `undefined`, the inequality was always true, and this gate rejected
 * every uploader including super_admins. Product and category image uploads
 * had been failing for everyone.
 */
async function requireAdminUploader() {
  const user = await currentUser();
  if (!user) throw new UploadThingError("Unauthorized");

  const role = await getUserRole(user.id);
  if (!isAdminRole(role)) {
    throw new UploadThingError("Admin access required");
  }

  return { userId: user.id };
}

async function requireEvidenceUploader() {
  const user = await currentUser();
  if (!user) throw new UploadThingError("Unauthorized");

  return { id: user.id, role: await getUserRole(user.id) };
}

function evidenceUploads() {
  return new ReturnEvidenceUploadService(
    container.getReturnRequestRepository()
  );
}

/**
 * File router configuration
 */
export const uploadRouter = {
  /**
   * Product image uploader
   * - Max 10 images per upload
   * - Max 4MB per image
   * - Only admin/super_admin can upload
   */
  productImage: f({
    image: { maxFileSize: "4MB", maxFileCount: 10 },
  })
    .middleware(async () => requireAdminUploader())
    .onUploadComplete(async ({ file }) => {
      return { url: file.ufsUrl };
    }),

  /**
   * Category image uploader
   * - Single image per upload
   * - Max 2MB
   * - Only admin/super_admin can upload
   */
  categoryImage: f({
    image: { maxFileSize: "2MB", maxFileCount: 1 },
  })
    .middleware(async () => requireAdminUploader())
    .onUploadComplete(async ({ file }) => {
      return { url: file.ufsUrl };
    }),

  /**
   * User avatar uploader
   * - Single image
   * - Max 1MB
   * - Any authenticated user can upload
   */
  userAvatar: f({
    image: { maxFileSize: "1MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const user = await currentUser();
      if (!user) throw new UploadThingError("Unauthorized");
      return { userId: user.id };
    })
    .onUploadComplete(async ({ file }) => {
      return { url: file.ufsUrl };
    }),

  /**
   * The two pre-pickup photos are independently identified, so each kind can
   * be uploaded exactly once and cannot be substituted for the other.
   */
  returnCustomerEvidence: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .input(
      z.object({
        requestId: z.string().uuid(),
        kind: z.enum(["customer_product_photo", "customer_package_photo"]),
      })
    )
    .middleware(async ({ input }) => {
      const actor = await requireEvidenceUploader();
      try {
        const authorization = await evidenceUploads().authorizeCustomerUpload({
          actor,
          ...input,
        });
        return { authorization };
      } catch (error) {
        throw new UploadThingError(
          error instanceof Error
            ? error.message
            : "Return evidence is unavailable"
        );
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        await evidenceUploads().recordUpload({
          authorization: metadata.authorization,
          file,
        });
        return { key: file.key };
      } catch (error) {
        throw new UploadThingError(
          error instanceof Error
            ? error.message
            : "Return evidence could not be recorded"
        );
      }
    }),

  /** One private, continuous receiving/unboxing video per return request. */
  returnReceivingEvidence: f({
    video: { maxFileSize: "256MB", maxFileCount: 1 },
  })
    .input(
      z.object({
        requestId: z.string().uuid(),
        kind: z.literal("receiving_inspection_video"),
      })
    )
    .middleware(async ({ input }) => {
      const actor = await requireEvidenceUploader();
      if (!isAdminAreaRole(actor.role)) {
        throw new UploadThingError("Staff access required");
      }
      try {
        const authorization = await evidenceUploads().authorizeReceivingUpload({
          actor,
          ...input,
        });
        return { authorization };
      } catch (error) {
        throw new UploadThingError(
          error instanceof Error
            ? error.message
            : "Receiving evidence is unavailable"
        );
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        await evidenceUploads().recordUpload({
          authorization: metadata.authorization,
          file,
        });
        return { key: file.key };
      } catch (error) {
        throw new UploadThingError(
          error instanceof Error
            ? error.message
            : "Receiving evidence could not be recorded"
        );
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;
