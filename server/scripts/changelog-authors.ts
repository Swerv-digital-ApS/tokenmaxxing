#!/usr/bin/env bun
/**
 * Credit each CHANGELOG.md entry to who made it.
 *
 * release-please links every change to its commit but leaves out the author. This looks each
 * commit up on GitHub and appends "by [@login](https://github.com/login)" to the lines that have
 * none yet, so the changelog (and "What's new" in the game) names them. The release workflow
 * runs it on the release PR.
 *
 * Usage:
 *   GH_TOKEN=… bun server/scripts/changelog-authors.ts
 */

const CHANGELOG = new URL("../../CHANGELOG.md", import.meta.url).pathname;
/** An entry still uncredited: it ends with its commit link. */
const UNCREDITED =
  /^\* .*\(\[[0-9a-f]+\]\(https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/commit\/([0-9a-f]{40})\)\)$/;

const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;

const api = async <T>(path: string): Promise<T | null> => {
  const res = await fetch(`https://api.github.com/repos/${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 404 || res.status === 422) return null;
  if (!res.ok) throw new Error(`changelog-authors: ${path}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
};

/**
 * Who made a commit: whoever opened its pull request (a merge commit's author is only who
 * merged it), else the commit's own GitHub account. Null when its email isn't tied to one.
 */
async function author(repo: string, sha: string): Promise<string | null> {
  const pr = (await api<{ user: { login: string } }[]>(`${repo}/commits/${sha}/pulls`))?.[0];
  if (pr) return pr.user.login;
  const commit = await api<{ author: { login: string } | null }>(`${repo}/commits/${sha}`);
  return commit?.author?.login ?? null;
}

const lines = (await Bun.file(CHANGELOG).text()).split("\n");
let credited = 0;
for (const [i, line] of lines.entries()) {
  const match = UNCREDITED.exec(line);
  if (!match) continue;
  const [, repo = "", sha = ""] = match;
  const login = await author(repo, sha);
  if (!login) {
    console.warn(`changelog-authors: no GitHub account for ${sha}, left as is`);
    continue;
  }
  lines[i] = `${line} by [@${login}](https://github.com/${login})`;
  credited++;
}
await Bun.write(CHANGELOG, lines.join("\n"));
console.log(`changelog-authors: credited ${credited} entries`);
