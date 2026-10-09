/** Fire-and-forget Slack incoming webhook helper */

export async function notifySlack(
  webhookUrl: string,
  text: string
): Promise<boolean> {
  if (!webhookUrl || !webhookUrl.startsWith("https://hooks.slack.com/")) {
    return false;
  }
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
