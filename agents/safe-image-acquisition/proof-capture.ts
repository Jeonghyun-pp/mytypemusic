import crypto from "node:crypto";
import axios from "axios";
import { InsufficientProofError } from "./errors.js";

export type ProofResult = {
  capturedAt: string;
  sourceHash: string;
  licenseHash?: string;
};

async function fetchAndHash(url: string, label: string): Promise<string> {
  let data: string;
  try {
    const response = await axios.get<string>(url, {
      responseType: "text",
      validateStatus: (status) => status === 200,
    });
    data = response.data;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";
    throw new InsufficientProofError(
      `Failed to fetch ${label}: ${message}`,
      { url }
    );
  }

  if (!data || data.length === 0) {
    throw new InsufficientProofError(
      `Empty response from ${label}`,
      { url }
    );
  }

  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function captureProof(
  sourceUrl: string,
  licenseUrl?: string
): Promise<ProofResult> {
  const sourceHash = await fetchAndHash(sourceUrl, "sourceUrl");

  let licenseHash: string | undefined;
  if (licenseUrl) {
    licenseHash = await fetchAndHash(licenseUrl, "licenseUrl");
  }

  return {
    capturedAt: new Date().toISOString(),
    sourceHash,
    licenseHash,
  };
}
