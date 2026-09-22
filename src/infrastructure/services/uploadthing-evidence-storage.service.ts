import { UTApi } from "uploadthing/server";

import type { UserRole } from "@/domain/customers/value-objects/user-role";
import {
  assertReturnActionAllowed,
  type ReturnRequestStatus,
} from "@/domain/refunds/return-request";
import type {
  ReturnEvidenceKind,
  ReturnRequestRepositoryInterface,
} from "@/domain/refunds/interfaces/return-request.repository.interface";

type EvidenceActor = { id: string; role: UserRole };

type UploadAuthorization = {
  actor: EvidenceActor;
  requestId: string;
  kind:
    | "customer_product_photo"
    | "customer_package_photo"
    | "receiving_inspection_video";
};

type UploadedEvidenceFile = {
  key: string;
  name: string;
  type: string;
  size: number;
};

const customerEvidenceKinds = new Set<ReturnEvidenceKind>([
  "customer_product_photo",
  "customer_package_photo",
]);
const customerImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const receivingVideoMimeTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

function assertEvidenceAction(
  status: ReturnRequestStatus,
  kind: ReturnEvidenceKind
): void {
  assertReturnActionAllowed(
    status,
    customerEvidenceKinds.has(kind)
      ? "attach_customer_evidence"
      : "attach_staff_evidence"
  );
}

function assertAvailable(count: number, kind: ReturnEvidenceKind): void {
  if (count > 0) {
    throw new Error(`${kind} is already uploaded for this return request`);
  }
}

function assertFileMatchesKind(
  kind: UploadAuthorization["kind"],
  file: UploadedEvidenceFile
) {
  if (
    !file.key ||
    !file.name ||
    !Number.isInteger(file.size) ||
    file.size <= 0
  ) {
    throw new Error("Evidence upload metadata is invalid");
  }

  if (
    customerEvidenceKinds.has(kind) &&
    !customerImageMimeTypes.has(file.type)
  ) {
    throw new Error("Customer return evidence must be an image");
  }
  if (
    kind === "receiving_inspection_video" &&
    !receivingVideoMimeTypes.has(file.type)
  ) {
    throw new Error("Receiving inspection evidence must be a video");
  }
}

/**
 * Authorizes private return evidence uploads before UploadThing issues an
 * upload URL, then repeats the count validation before metadata is persisted.
 */
export class ReturnEvidenceUploadService {
  constructor(private readonly returns: ReturnRequestRepositoryInterface) {}

  async authorizeCustomerUpload(
    input: UploadAuthorization
  ): Promise<UploadAuthorization> {
    if (input.actor.role !== "customer") {
      throw new Error(
        "Only the customer who opened the return can upload customer evidence"
      );
    }
    if (!customerEvidenceKinds.has(input.kind)) {
      throw new Error("Customer evidence kind is invalid");
    }

    const request = await this.returns.findForCustomer(
      input.requestId,
      input.actor.id
    );
    if (!request) throw new Error("Return request not found");
    assertEvidenceAction(request.status, input.kind);
    assertAvailable(
      await this.returns.countEvidence({
        requestId: input.requestId,
        kind: input.kind,
      }),
      input.kind
    );
    return input;
  }

  async authorizeReceivingUpload(
    input: UploadAuthorization
  ): Promise<UploadAuthorization> {
    if (
      input.actor.role !== "worker" &&
      input.actor.role !== "admin" &&
      input.actor.role !== "super_admin"
    ) {
      throw new Error("Only staff can upload receiving inspection evidence");
    }
    if (input.kind !== "receiving_inspection_video") {
      throw new Error("Receiving evidence kind is invalid");
    }

    const request = await this.returns.findForStaff(input.requestId);
    if (!request) throw new Error("Return request not found");
    assertEvidenceAction(request.status, input.kind);
    assertAvailable(
      await this.returns.countEvidence({
        requestId: input.requestId,
        kind: input.kind,
      }),
      input.kind
    );
    return input;
  }

  async recordUpload(input: {
    authorization: UploadAuthorization;
    file: UploadedEvidenceFile;
  }): Promise<void> {
    assertFileMatchesKind(input.authorization.kind, input.file);
    const request = customerEvidenceKinds.has(input.authorization.kind)
      ? await this.returns.findForCustomer(
          input.authorization.requestId,
          input.authorization.actor.id
        )
      : await this.returns.findForStaff(input.authorization.requestId);
    if (!request) throw new Error("Return request not found");
    assertEvidenceAction(request.status, input.authorization.kind);
    assertAvailable(
      await this.returns.countEvidence({
        requestId: input.authorization.requestId,
        kind: input.authorization.kind,
      }),
      input.authorization.kind
    );
    await this.returns.attachEvidence({
      requestId: input.authorization.requestId,
      uploaderId: input.authorization.actor.id,
      uploaderRole: input.authorization.actor.role,
      kind: input.authorization.kind,
      storageKey: input.file.key,
      mimeType: input.file.type,
      sizeBytes: input.file.size,
      originalMetadata: { fileName: input.file.name },
    });
  }
}

/** Private UploadThing URLs are issued only after request-scoped authorization. */
export class UploadThingEvidenceStorage {
  constructor(
    private readonly api: Pick<UTApi, "generateSignedURL"> = new UTApi(),
    private readonly returns?: ReturnRequestRepositoryInterface
  ) {}

  async getSignedUrl(input: {
    actor: EvidenceActor;
    requestId: string;
    storageKey: string;
  }): Promise<string> {
    if (input.actor.role !== "super_admin") {
      throw new Error("Only a super admin can view private return evidence");
    }
    if (!this.returns) {
      throw new Error(
        "Private evidence access dependencies are not configured"
      );
    }

    const evidence = await this.returns.findEvidence({
      requestId: input.requestId,
      storageKey: input.storageKey,
    });
    if (!evidence) throw new Error("Return evidence not found");

    await this.returns.recordEvidenceAccess({
      actorId: input.actor.id,
      actorRole: input.actor.role,
      requestId: input.requestId,
      evidenceId: evidence.id,
    });
    const signed = await this.api.generateSignedURL(evidence.storageKey, {
      expiresIn: 300,
    });
    return signed.ufsUrl;
  }
}
