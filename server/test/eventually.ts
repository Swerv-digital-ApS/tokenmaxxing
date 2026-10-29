/** Retries `check` (a function with `expect`s) until it passes, or rethrows its failure after `ms`. */
export async function eventually<T>(check: () => Promise<T> | T, ms = 5_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    try {
      return await check();
    } catch (err) {
      if (Date.now() > end) throw err;
      await Bun.sleep(20);
    }
  }
}
