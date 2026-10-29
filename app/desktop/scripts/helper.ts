import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Tauri supplies the target for cross/universal builds. Native builds use Rust's host triple.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = resolve(root, "app/desktop/src-tauri/binaries");
const triple =
  process.env.TAURI_ENV_TARGET_TRIPLE || /host: (.+)/.exec(await run(["rustc", "-vV"], true))?.[1]?.trim();
if (!triple) throw new Error("Could not determine the Rust target triple");
await mkdir(out, { recursive: true });

async function run(args: string[], capture = false): Promise<string> {
  const child = Bun.spawn(args, {
    // Keep .env files at the repository root out of the compiled helper.
    cwd: resolve(root, "app/helper"),
    stdout: capture ? "pipe" : "inherit",
    stderr: "inherit",
  });
  const text = capture ? await new Response(child.stdout as ReadableStream).text() : "";
  if ((await child.exited) !== 0) throw new Error(`Command failed: ${args[0]}`);
  return text;
}

async function build(target: string, rustTriple: string, suffix = "") {
  await run([
    process.execPath,
    "build",
    "src/main.ts",
    "--compile",
    "--minify",
    `--target=${target}`,
    "--outfile",
    resolve(out, `tokenmaxxing-helper-${rustTriple}${suffix}`),
  ]);
}

switch (triple) {
  case "aarch64-apple-darwin":
    await build("bun-darwin-arm64", triple);
    break;
  case "x86_64-apple-darwin":
    await build("bun-darwin-x64", triple);
    break;
  case "universal-apple-darwin": {
    for (const [arch, rust] of [
      ["arm64", "aarch64"],
      ["x64", "x86_64"],
    ])
      await build(`bun-darwin-${arch}`, `${rust}-apple-darwin`);
    await run([
      "lipo",
      "-create",
      resolve(out, "tokenmaxxing-helper-aarch64-apple-darwin"),
      resolve(out, "tokenmaxxing-helper-x86_64-apple-darwin"),
      "-output",
      resolve(out, `tokenmaxxing-helper-${triple}`),
    ]);
    break;
  }
  case "x86_64-unknown-linux-gnu":
    await build("bun-linux-x64-baseline", triple);
    break;
  case "aarch64-unknown-linux-gnu":
    await build("bun-linux-arm64", triple);
    break;
  case "x86_64-pc-windows-msvc":
    await build("bun-windows-x64-baseline", triple, ".exe");
    break;
  default:
    throw new Error(`No helper build for ${triple}`);
}
