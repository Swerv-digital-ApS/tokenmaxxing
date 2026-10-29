import { join } from "node:path";

/**
 * `/install.sh`: installs the CLI on a linked computer (ARCHITECTURE.md, "Linked computers"), pointing it at this server. The
 * app hands out `curl -fsSL <server>/install.sh | sh -s -- link <code>`.
 */
const TEMPLATE = await Bun.file(join(import.meta.dir, "install.sh")).text();

/** An origin that's safe to put inside a shell string. */
const ORIGIN = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/;

/** The origin the request came in on. Railway terminates TLS, so the scheme is in `x-forwarded-proto`. */
export function publicOrigin(req: Request): string | null {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.slice(0, -1);
  const origin = `${proto}://${url.host}`;
  return ORIGIN.test(origin) ? origin : null;
}

export function installScript(req: Request): Response {
  const origin = publicOrigin(req);
  if (!origin) return new Response("Bad host", { status: 400 });
  return new Response(TEMPLATE.replaceAll("__SERVER__", origin), {
    headers: { "content-type": "text/x-shellscript; charset=utf-8", "cache-control": "no-cache" },
  });
}
