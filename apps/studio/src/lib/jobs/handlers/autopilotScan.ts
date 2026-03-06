import { prisma } from "@/lib/db";
import { generateProposals, publishApprovedProposals } from "@/lib/autopilot/scanner";
import type { JobHandler } from "../types";

/**
 * Autopilot scan job: generates proposals for all active configs,
 * then publishes any approved proposals that are due.
 */
export const autopilotScanHandler: JobHandler = {
  type: "autopilot_scan",
  async handle() {
    const configs = await prisma.autopilotConfig.findMany({
      where: { isActive: true },
    });

    let totalProposals = 0;
    for (const config of configs) {
      const count = await generateProposals(config.id);
      totalProposals += count;
    }

    const published = await publishApprovedProposals();

    return {
      configsProcessed: configs.length,
      proposalsGenerated: totalProposals,
      proposalsPublished: published,
    };
  },
};
