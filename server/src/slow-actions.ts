/**
 * Actions that take this long are logged with their actor and key. RivetKit only logs `action_timed_out`
 * when one passes its 60 s limit, without saying which action it was; the line here comes when the
 * handler actually finishes, so a timed-out one still shows how long it really ran.
 */
export const SLOW_ACTION_MS = 5_000;

type Definition = { config: { actions?: Record<string, unknown> } };
type Ctx = { key?: unknown[] };

/** Times every action of `definition`, in place. */
export function logSlowActions(
  name: string,
  definition: Definition,
  slowMs = SLOW_ACTION_MS,
  log: (line: string) => void = console.warn,
): void {
  const actions = definition.config.actions ?? {};
  for (const [action, handler] of Object.entries(actions)) {
    if (typeof handler !== "function") continue;
    actions[action] = (c: Ctx, ...args: unknown[]) => {
      const start = performance.now();
      const done = (failed: boolean) => {
        const ms = Math.round(performance.now() - start);
        if (ms >= slowMs)
          log(`[slow] ${name}[${c?.key?.join("/") ?? ""}].${action} ${ms} ms${failed ? " (failed)" : ""}`);
      };
      let out: unknown;
      try {
        out = handler(c, ...args);
      } catch (err) {
        done(true);
        throw err;
      }
      if (out instanceof Promise)
        out.then(
          () => done(false),
          () => done(true),
        );
      else done(false);
      return out;
    };
  }
}
