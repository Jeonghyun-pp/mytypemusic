import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function badRequest(message: string, details?: unknown): NextResponse {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message: string): NextResponse {
  // Strip stack traces and internal details — log full error server-side
  logger.error({ message }, "server error");
  Sentry.captureException(new Error(message));
  const safeMessage =
    process.env.NODE_ENV === "development"
      ? message
      : "Internal server error";
  return NextResponse.json({ error: safeMessage }, { status: 500 });
}
