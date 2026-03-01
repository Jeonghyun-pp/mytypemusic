import { NextResponse } from "next/server";

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
  return NextResponse.json({ error: message }, { status: 500 });
}
