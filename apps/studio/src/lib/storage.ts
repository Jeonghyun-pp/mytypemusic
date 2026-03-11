import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY ?? "",
    secretAccessKey: process.env.R2_SECRET_KEY ?? "",
  },
});

const BUCKET = process.env.R2_BUCKET ?? "web-magazine-studio";
const PUBLIC_URL = process.env.R2_PUBLIC_URL; // e.g. https://assets.yourdomain.com

/** Upload a file to R2 and return its public URL. */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  if (PUBLIC_URL) return `${PUBLIC_URL}/${key}`;
  return getFileSignedUrl(key);
}

/** Get a 1-hour signed URL for a file. */
export async function getFileSignedUrl(key: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 3600 },
  );
}

/** Delete a file from R2. */
export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
