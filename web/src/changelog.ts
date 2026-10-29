import changelog from "../../CHANGELOG.md" with { type: "text" };

/** One line of a release, credited to whoever made it (by server/scripts/changelog-authors.ts). */
export interface Change {
  scope: string | null;
  text: string;
  authors: string[];
}

export interface Release {
  version: string;
  /** YYYY-MM-DD. */
  date: string;
  /** "Features", "Bug Fixes", … as release-please heads them. */
  sections: { title: string; changes: Change[] }[];
}

const RELEASE = /^## \[?([^\]\s]+)\]?(?:\([^)]*\))? \((\d{4}-\d{2}-\d{2})\)/;
const SCOPE = /^\*\*(.+?):\*\* /;
const AUTHOR = /\[@([\w-]+)\]\(https:\/\/github\.com\/[\w-]+\)/g;
/** A trailing link to an issue or commit: "([#44](…))", "([7d5d1b2](…))". */
const REF = / \(\[[^\]]+\]\([^)]+\)\)$/;

/**
 * CHANGELOG.md as release-please writes it, newest release first. The same change merged twice
 * (its commit and its merge commit) is one line, with everyone who made it.
 */
export function parseChangelog(md: string): Release[] {
  const releases: Release[] = [];
  let section: Release["sections"][number] | undefined;
  for (const line of md.split("\n")) {
    const release = RELEASE.exec(line);
    if (release) {
      releases.push({ version: release[1] ?? "", date: release[2] ?? "", sections: [] });
      section = undefined;
    } else if (line.startsWith("### ")) {
      section = { title: line.slice(4).trim(), changes: [] };
      releases.at(-1)?.sections.push(section);
    } else if (line.startsWith("* ") && section) {
      let text = line.slice(2).replace(/ by \[@.*$/, "");
      while (REF.test(text)) text = text.replace(REF, "");
      const scope = SCOPE.exec(text)?.[1] ?? null;
      if (scope) text = text.replace(SCOPE, "");
      const authors = [...line.matchAll(AUTHOR)].map((m) => m[1] ?? "");
      const same = section.changes.find((c) => c.scope === scope && c.text === text);
      if (same) same.authors = [...new Set([...same.authors, ...authors])];
      else section.changes.push({ scope, text, authors });
    }
  }
  return releases;
}

export const releases = parseChangelog(changelog);

/**
 * The releases a player hasn't seen, newest first: those after `seen`, the last version this
 * browser was shown. Someone who has been in town before but never saw one gets the latest;
 * someone new gets none.
 */
export function unseenReleases(all: Release[], seen: string | null, returning: boolean): Release[] {
  if (seen === null) return returning ? all.slice(0, 1) : [];
  const at = all.findIndex((r) => r.version === seen);
  return all.slice(0, at === -1 ? 1 : Math.min(at, 5));
}
