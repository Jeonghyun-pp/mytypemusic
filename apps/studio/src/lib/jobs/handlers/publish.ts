import { publishNow } from "@/lib/sns/publish";
import type { JobHandler } from "../types";

export const publishHandler: JobHandler = {
  type: "publish",
  async handle(payload) {
    const publicationId = payload.publicationId as string;
    if (!publicationId) throw new Error("Missing publicationId in job payload");
    await publishNow(publicationId);
    return { publicationId, status: "published" };
  },
};
