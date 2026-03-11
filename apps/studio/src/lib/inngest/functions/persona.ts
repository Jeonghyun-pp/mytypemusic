import { inngest } from "../client";
import { personaLearnHandler } from "@/lib/jobs/handlers/personaLearn";

/** Persona learning: triggered after analytics collection. */
export const personaLearn = inngest.createFunction(
  { id: "persona-learn", retries: 2 },
  { event: "persona/learn" },
  async ({ step }) => {
    return step.run("learn", () => personaLearnHandler.handle({}));
  },
);
