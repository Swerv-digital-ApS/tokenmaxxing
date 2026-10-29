/**
 * `localStorage` that never throws: private mode or blocked storage makes even touching the global
 * raise a SecurityError. Then values live in memory for the session.
 */
const memory = new Map<string, string>();

function backing(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export const storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
  getItem(key) {
    try {
      const v = backing()?.getItem(key);
      if (v !== undefined) return v;
    } catch {}
    return memory.get(key) ?? null;
  },
  setItem(key, value) {
    memory.set(key, value);
    try {
      backing()?.setItem(key, value);
    } catch {}
  },
  removeItem(key) {
    memory.delete(key);
    try {
      backing()?.removeItem(key);
    } catch {}
  },
};
