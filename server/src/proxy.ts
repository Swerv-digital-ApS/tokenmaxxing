import type { Server, WebSocketHandler } from "bun";
import { isTruthy } from "hanzio";
import { RateLimiter } from "./rate-limit.ts";

/** Browsers and the menu bar app reach actors under this path, on our own origin. */
const RIVET_PATH = "/api/rivet";

/** Set by the proxy on everything it forwards (any copy from the client is dropped); `actors/shared.ts` reads it. */
export const CLIENT_IP_HEADER = "x-tokenmaxxing-ip";

const ACTORS = new Set(["town", "world", "arcade", "player", "match"]);
/** The only actors a client may create, and only as `["main"]`. */
const SINGLETONS = new Set(["town", "world", "arcade"]);

/** Bun's WebSocket takes headers too; the DOM typing it's declared with doesn't say so. */
const BunWebSocket = WebSocket as unknown as new (url: string, options: Bun.WebSocketOptions) => WebSocket;

interface Upstream {
  target: string;
  protocols: string[];
  ip: string;
  socket?: WebSocket;
  /** Messages from the client that arrived before the engine socket opened. */
  pending: (string | Uint8Array<ArrayBuffer>)[];
}

/**
 * What a client may ask the gateway for: an actor that exists (by id, or `get` by key), or one of
 * the singletons by `getOrCreate(["main"])` with no input. Anything else could create an actor: a
 * `player` for the next user id with the caller's own token, say, or endless `town`s on the volume.
 */
export function gatewayAllowed(path: string, params: URLSearchParams): boolean {
  if (path === "/metadata") return true;
  const m = /^\/gateway\/([^/?]+)/.exec(path);
  if (!m) return false;
  const methods = params.getAll("rvt-method");
  if (methods.length === 0) return !params.has("rvt-key") && !params.has("rvt-input"); // an actor id
  if (methods.length > 1) return false;
  const name = decodeURIComponent(m[1]!);
  if (!ACTORS.has(name)) return false;
  if (methods[0] === "get") return !params.has("rvt-input");
  const keys = params.getAll("rvt-key");
  return (
    methods[0] === "getOrCreate" &&
    SINGLETONS.has(name) &&
    keys.length === 1 &&
    keys[0] === "main" &&
    !params.has("rvt-input")
  );
}

/**
 * The client's IP: `ipHeader` when a proxy in front sets it (Railway's edge sets `x-real-ip`),
 * otherwise the socket's. Without a proxy in front, a client can spoof that header, which only
 * gets them a fresh rate-limit bucket.
 */
export function clientIp(req: Request, server: Pick<Server<unknown>, "requestIP">, ipHeader: string): string {
  return req.headers.get(ipHeader)?.split(",")[0]?.trim() || server.requestIP(req)?.address || "unknown";
}

/**
 * Forwards the client gateway of the local Rivet engine: HTTP and WebSockets
 * under `/api/rivet/gateway/*` plus `/api/rivet/metadata`, as `gatewayAllowed` says. Nothing else
 * of the engine's API is reachable from outside. Everything forwarded carries the engine's
 * `token`, which clients don't have, and the client's IP in `CLIENT_IP_HEADER`.
 */
export function rivetProxy(
  engine: string,
  token: string,
  limits: { ipHeader: string; requestsPerMin: number; socketsPerMin: number },
) {
  const { ipHeader } = limits;
  // Per client IP: an office behind one address fits (each tab opens a few sockets), a script doesn't.
  const requests = new RateLimiter(limits.requestsPerMin, 60_000);
  const sockets = new RateLimiter(limits.socketsPerMin, 60_000);
  const tooMany = () => new Response("Too many requests", { status: 429, headers: { "retry-after": "60" } });

  const fetch = async (req: Request, server: Server<Upstream>): Promise<Response | undefined> => {
    const url = new URL(req.url);
    const path = url.pathname.startsWith(`${RIVET_PATH}/`) ? url.pathname.slice(RIVET_PATH.length) : null;
    if (path === null || !gatewayAllowed(path, url.searchParams))
      return new Response("Not found", { status: 404 });
    const ip = clientIp(req, server, ipHeader);
    const now = Date.now();
    url.searchParams.set("rvt-token", token);
    if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      if (!sockets.take(ip, now)) return tooMany();
      const protocols = (req.headers.get("sec-websocket-protocol") ?? "")
        .split(",")
        .map((p) => p.trim())
        .filter(isTruthy);
      const upgraded = server.upgrade(req, {
        data: { target: `ws://${engine}${path}${url.search}`, protocols, ip, pending: [] },
        headers: protocols[0] ? { "Sec-WebSocket-Protocol": protocols[0] } : undefined,
      });
      return upgraded ? undefined : new Response("Upgrade failed", { status: 400 });
    }
    if (!requests.take(ip, now)) return tooMany();
    const headers = new Headers(req.headers);
    headers.delete("host");
    // A query in a header could create an actor, past `gatewayAllowed`.
    headers.delete("x-rivet-query");
    headers.set("x-rivet-token", token);
    headers.set(CLIENT_IP_HEADER, ip);
    return globalThis.fetch(`http://${engine}${path}${url.search}`, {
      method: req.method,
      headers,
      body: req.body,
      redirect: "manual",
    });
  };

  const websocket: WebSocketHandler<Upstream> = {
    open(ws) {
      const options: Bun.WebSocketOptions = {
        protocols: ws.data.protocols,
        headers: { [CLIENT_IP_HEADER]: ws.data.ip },
      };
      const up = new BunWebSocket(ws.data.target, options);
      up.binaryType = "arraybuffer";
      ws.data.socket = up;
      up.onopen = () => {
        for (const m of ws.data.pending) up.send(m);
        ws.data.pending = [];
      };
      up.onmessage = (e) =>
        ws.send(typeof e.data === "string" ? e.data : new Uint8Array(e.data as ArrayBuffer));
      up.onclose = (e) => close(ws, e.code, e.reason);
      up.onerror = () => close(ws, 1011, "engine unreachable");
    },
    message(ws, msg) {
      const up = ws.data.socket;
      if (up?.readyState === WebSocket.OPEN) up.send(msg);
      else ws.data.pending.push(msg);
    },
    close(ws, code, reason) {
      if (ws.data.socket) close(ws.data.socket, code, reason);
    },
  };

  return { fetch, websocket };
}

/**
 * Passes a close on to the other side. Some codes only ever arrive (1005 no code, 1006 dropped) and
 * throw if sent, which would take the whole server down, so they go on as a normal close.
 */
export function close(
  socket: { close(code?: number, reason?: string): void },
  code: number,
  reason: string,
): void {
  const sendable =
    (code >= 1000 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006) ||
    (code >= 3000 && code <= 4999);
  try {
    socket.close(sendable ? code : 1000, reason);
  } catch {
    socket.close(1000); // a reason over 123 bytes
  }
}
