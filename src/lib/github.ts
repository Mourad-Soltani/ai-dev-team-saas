/** Create a GitHub issue when a human approves an escalated step. */

export async function createGitHubIssue(opts: {
  token: string;
  owner: string;
  repo: string;
  title: string;
  body: string;
}): Promise<{ html_url: string; number: number } | null> {
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${opts.owner}/${opts.repo}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          title: opts.title,
          body: opts.body,
          labels: ["ai-dev-team", "approved"],
        }),
      }
    );
    if (!resp.ok) {
      const t = await resp.text();
      console.error("[github]", resp.status, t.slice(0, 300));
      return null;
    }
    const data = (await resp.json()) as { html_url: string; number: number };
    return { html_url: data.html_url, number: data.number };
  } catch (e) {
    console.error("[github]", e);
    return null;
  }
}
