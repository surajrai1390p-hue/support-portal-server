/**
 * @file S3 storage helpers.
 *
 * Uploads complaint attachments to a private S3 bucket and issues
 * short-lived presigned GET URLs so authenticated clients can download
 * them without making the objects public.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";

/** Pre-configured S3 client scoped to the project's AWS region. */
const s3 = new S3Client({ region: env.AWS_REGION });

/** Lifetime of a presigned URL in seconds (1 hour). */
const PRESIGN_EXPIRY_SECONDS = 60 * 60;

/**
 * Upload a buffer to S3 under the given key.
 *
 * @param key - S3 object key (path within the bucket).
 * @param body - File content as a `Buffer`.
 * @param contentType - MIME type of the uploaded object.
 * @returns The S3 object key on success.
 */
export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

/**
 * Generate a temporary presigned download URL for an S3 object.
 *
 * Returns `undefined` if signing fails so one bad attachment does not break
 * the whole complaints list.
 *
 * @param key - S3 object key to generate a URL for.
 * @returns A presigned URL string, or `undefined` on failure.
 */
export async function getPresignedUrl(
  key: string
): Promise<string | undefined> {
  try {
    return await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: env.AWS_S3_BUCKET_NAME,
        Key: key,
      }),
      { expiresIn: PRESIGN_EXPIRY_SECONDS }
    );
  } catch (error) {
    console.error("Presign failed for key:", key, error);
    return undefined;
  }
}
