/**
 * Slack notification utility for job failures and autopilot errors.
 */
export async function notifySlack(
  message: string,
  context?: Record<string, unknown>,
) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: message,
      blocks: context
        ? [
            { type: "section", text: { type: "mrkdwn", text: message } },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "```" + JSON.stringify(context, null, 2) + "```",
              },
            },
          ]
        : undefined,
    }),
  }).catch(() => {}); // 알림 실패가 본 로직을 막으면 안 됨
}
