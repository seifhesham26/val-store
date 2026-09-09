/**
 * UploadThing React Components
 *
 * Pre-configured components for file uploads.
 * Use these in your forms for product/category images.
 *
 * Components:
 * - UploadButton: Simple button that opens file picker
 * - UploadDropzone: Drag & drop area
 * - Uploader: Full-featured uploader
 */

import {
  generateReactHelpers,
  generateUploadButton,
  generateUploadDropzone,
  generateUploader,
} from "@uploadthing/react";

import type { OurFileRouter } from "@/lib/uploadthing";

export const UploadButton = generateUploadButton<OurFileRouter>();
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();
export const Uploader = generateUploader<OurFileRouter>();
export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
