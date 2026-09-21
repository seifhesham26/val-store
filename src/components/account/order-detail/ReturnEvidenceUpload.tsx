"use client";

import { useState } from "react";
import { useUploadThing } from "@/components/ui/upload";

export function ReturnEvidenceUpload({ requestId }: { requestId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const { startUpload, isUploading } = useUploadThing(
    "returnCustomerEvidence",
    {
      onClientUploadComplete: () =>
        setMessage("Photo saved. You can retry the other photo if needed."),
      onUploadError: (error) => setMessage(error.message),
    }
  );
  const upload = async (
    kind: "customer_product_photo" | "customer_package_photo",
    file: File | undefined
  ) => {
    if (!file) return;
    setMessage(null);
    await startUpload([file], { requestId, kind });
  };
  return (
    <div className="space-y-3 rounded-lg border border-white/10 p-4 text-sm text-gray-300">
      <p>
        Before pickup, upload exactly two photos within 48 hours: the product
        condition and the safely resealed package/label. Upload failures keep
        this return pending so you can retry.
      </p>
      <label className="block">
        Product condition photo
        <input
          className="mt-1 block w-full"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={isUploading}
          onChange={(e) =>
            upload("customer_product_photo", e.target.files?.[0])
          }
        />
      </label>
      <label className="block">
        Sealed package and label photo
        <input
          className="mt-1 block w-full"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={isUploading}
          onChange={(e) =>
            upload("customer_package_photo", e.target.files?.[0])
          }
        />
      </label>
      {isUploading && <p className="text-val-accent">Uploading securely…</p>}
      {message && <p>{message}</p>}
    </div>
  );
}
