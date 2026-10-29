import { expect, test } from "bun:test";
import { join } from "node:path";
import { appStateDir } from "../src/helper.ts";

// The Rust launcher uses dirs::data_local_dir; keep the helper on the same OS locations.
// In particular Windows must use Local, not Roaming, and Mac upgrades must keep their old state.
test("desktop sync state follows each platform's local data directory", () => {
  const home = "/test-home";
  expect(appStateDir("darwin", {}, home)).toBe(join(home, "Library/Application Support/Tokenmaxxing"));
  expect(appStateDir("win32", { LOCALAPPDATA: "/local", APPDATA: "/roaming" }, home)).toBe(
    join("/local", "Tokenmaxxing"),
  );
  expect(appStateDir("win32", {}, home)).toBe(join(home, "AppData/Local/Tokenmaxxing"));
  expect(appStateDir("linux", { XDG_DATA_HOME: "/xdg-data", XDG_CONFIG_HOME: "/config" }, home)).toBe(
    join("/xdg-data", "Tokenmaxxing"),
  );
  expect(appStateDir("linux", {}, home)).toBe(join(home, ".local/share/Tokenmaxxing"));
});
