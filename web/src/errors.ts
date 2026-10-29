/** Failed server calls, for the game and the admin page alike (no connection of its own). */

/** A readable message from a failed call. */
export const errorText = (err: unknown): string =>
  (err as { message?: string } | null)?.message?.replace(/^.*?: /, "") ?? "Something went wrong.";

/** What a failed call says went wrong: "unauthorized", "forbidden"… */
export const errorCode = (err: unknown): string | undefined => (err as { code?: string } | null)?.code;
