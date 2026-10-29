import { expect, test } from "bun:test";
import { parseChangelog, releases, unseenReleases } from "../src/changelog.ts";

const C = "https://github.com/HansKristoffer/tokenmaxxing/commit";
const MD = `# Changelog

## [1.5.0](https://github.com/HansKristoffer/tokenmaxxing/compare/v1.4.2...v1.5.0) (2026-10-16)


### Features

* **web:** XP bar on the player card ([2791fad](${C}/2791fad)) by [@c-johannesen](https://github.com/c-johannesen)
* **web:** XP bar on the player card ([251964b](${C}/251964b)) by [@ml-firtal](https://github.com/ml-firtal)


### Bug Fixes

* relaunch the updated app by path ([#44](https://github.com/HansKristoffer/tokenmaxxing/issues/44)) ([1a2a900](${C}/1a2a900))

## 1.0.0 (2026-09-24)


### ⚠ BREAKING CHANGES

* **app:** the menu bar app is just an Open world button
`;

test("reads releases, sections and who made each change", () => {
  expect(parseChangelog(MD)).toEqual([
    {
      version: "1.5.0",
      date: "2026-10-16",
      sections: [
        {
          title: "Features",
          changes: [
            { scope: "web", text: "XP bar on the player card", authors: ["c-johannesen", "ml-firtal"] },
          ],
        },
        {
          title: "Bug Fixes",
          changes: [{ scope: null, text: "relaunch the updated app by path", authors: [] }],
        },
      ],
    },
    {
      version: "1.0.0",
      date: "2026-09-24",
      sections: [
        {
          title: "⚠ BREAKING CHANGES",
          changes: [{ scope: "app", text: "the menu bar app is just an Open world button", authors: [] }],
        },
      ],
    },
  ]);
});

test("the repo's own changelog parses", () => {
  expect(releases.length).toBeGreaterThan(0);
  expect(releases[0]?.sections.length).toBeGreaterThan(0);
});

test("shows the releases since the last one seen", () => {
  const all = ["1.6.0", "1.5.0", "1.4.2"].map((version) => ({ version, date: "2026-10-26", sections: [] }));
  const versions = (seen: string | null, returning = true) =>
    unseenReleases(all, seen, returning).map((r) => r.version);
  expect(versions("1.6.0")).toEqual([]);
  expect(versions("1.4.2")).toEqual(["1.6.0", "1.5.0"]);
  expect(versions("0.9.0")).toEqual(["1.6.0"]);
  expect(versions(null)).toEqual(["1.6.0"]);
  expect(versions(null, false)).toEqual([]);
});
