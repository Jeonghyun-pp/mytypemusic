import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/studio";
import { getAdapter } from "@/lib/sns/platforms";
import { saveAccount } from "@/lib/sns/tokenManager";
import { enqueueJob } from "@/lib/jobs";

/** GET /api/sns/callback/:platform — OAuth callback handler (redirect from SNS) */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const { platform } = await params;
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      return badRequest(`OAuth error: ${error} - ${url.searchParams.get("error_description") ?? ""}`);
    }
    if (!code) {
      return badRequest("Missing authorization code");
    }

    const baseUrl =
      process.env.OAUTH_CALLBACK_BASE_URL ?? "http://localhost:3100";
    const callbackUrl = `${baseUrl}/api/sns/callback/${platform}`;

    const adapter = getAdapter(platform);
    const result = await adapter.handleCallback(code, callbackUrl);
    const account = await saveAccount(result, platform);

    // Queue onboarding analysis job for auto-persona creation
    await enqueueJob({
      type: "onboard_analyze",
      payload: { accountId: account.id },
    }).catch(() => {/* non-critical */});

    // Redirect back to accounts page with success
    return NextResponse.redirect(
      new URL(`/studio/accounts?connected=${platform}`, baseUrl),
    );
  } catch (e) {
    return serverError(String(e));
  }
}
