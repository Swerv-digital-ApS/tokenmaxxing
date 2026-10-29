import { matchingPids } from "./watchdog.ts";

/** Sends `signal` to `pid`; false if it's gone. Signal 0 only asks whether it's there. */
const send = (pid: number, signal: NodeJS.Signals | 0) => {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
};

/**
 * RivetKit starts the engine as a child in its own process group, so it doesn't die with this
 * process: it would be left running (and holding its port and data dir) after an exit. Only direct
 * children of this process whose command is the engine are touched.
 */
export function engineChildren(port?: number): number[] {
  const out = Bun.spawnSync(["ps", "-A", "-o", "pid=,ppid=,command="]).stdout.toString();
  const mine = out
    .split("\n")
    .map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
    .filter((m): m is RegExpMatchArray => !!m && Number(m[2]) === process.pid)
    .map((m) => `${m[1]} ${m[3]}`)
    .join("\n");
  const pids = matchingPids(mine, "rivet-engine");
  // An engine left by a server that was SIGKILLed is no child of ours, but a restart reuses it:
  // the one listening on our engine port.
  if (port) {
    const listening = Bun.spawnSync(["lsof", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"]).stdout.toString();
    for (const pid of listening.split("\n").map(Number))
      if (pid && !pids.includes(pid) && isEngine(pid)) pids.push(pid);
  }
  return pids;
}

const isEngine = (pid: number) =>
  Bun.spawnSync(["ps", "-p", String(pid), "-o", "command="])
    .stdout.toString()
    .includes("rivet-engine");

/** SIGTERM the engine, SIGKILL whatever is still there after `graceMs`. */
export async function stopEngine(port?: number, graceMs = 3_000) {
  const pids = engineChildren(port);
  for (const pid of pids) send(pid, "SIGTERM");
  for (const end = Date.now() + graceMs; Date.now() < end && pids.some((p) => send(p, 0));)
    await Bun.sleep(50);
  for (const pid of pids) if (send(pid, 0)) send(pid, "SIGKILL");
}
