import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  formatters: {
    level: (label) => ({ level: label }),
  },
});

/** Create a child logger with bound context fields. */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
