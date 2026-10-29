import type { registry } from "@tokenmaxxing/server/registry";
import { createClient } from "rivetkit/client";
import { errorCode } from "../errors.ts";
import { storage } from "../storage.ts";

const TOKEN_KEY = "tokenmaxxing.admin";

// Over a connection, like the game (see net.ts): Chrome won't stream request bodies over plain HTTP/1.
const client = createClient<typeof registry>({ endpoint: `${location.origin}/api/rivet`, devtools: false });

export type AdminConn = ReturnType<ReturnType<typeof client.town.getOrCreate>["connect"]>;

/**
 * `/admin#token=…` saves the token for next time and takes it out of the URL and history; a
 * fragment never reaches the server, so it can't end up in a log. `?token=` works too, but it
 * does reach the server. Otherwise it's the one saved before, if any.
 */
export function savedToken(): string | null {
  const url = new URL(location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const token = fragment.get("token") ?? url.searchParams.get("token");
  if (token) {
    storage.setItem(TOKEN_KEY, token);
    url.searchParams.delete("token");
    history.replaceState(null, "", url.pathname + url.search);
  }
  return storage.getItem(TOKEN_KEY);
}

export const saveToken = (token: string) => storage.setItem(TOKEN_KEY, token);
export const forgetToken = () => storage.removeItem(TOKEN_KEY);

export const connectAdmin = (token: string): AdminConn =>
  client.town.getOrCreate(["main"], { params: { admin: token } }).connect();

export const isUnauthorized = (err: unknown) => {
  const code = errorCode(err);
  return code === "unauthorized" || code === "forbidden";
};
