#!/usr/bin/env bash
# Keeps a local game server running: `bun server/src/main.ts`, restarted when it exits.
#
#   PORT=8787 RIVETKIT_STORAGE_PATH=$HOME/tokenmaxxing-data SUPERVISE_LOG=$HOME/tokenmaxxing.log \
#     scripts/supervise.sh
#
# The environment is passed through to the server (PORT, RIVETKIT_STORAGE_PATH, RIVET_RUN_ENGINE_PORT,
# HEALTH_*, ...). Restarts wait 1 s, doubling to 30 s; a run that lasted 60 s or more starts the
# backoff over. SIGINT/SIGTERM are forwarded to the server, and the supervisor exits after it does.
# Output goes to $SUPERVISE_LOG (appended) when set, else to this terminal.
set -u
cd "$(dirname "$0")/.."

delay=1
child=""
stopping=0

log() { printf '[supervise] %s %s\n' "$(date '+%F %T')" "$*"; }

if [ -n "${SUPERVISE_LOG:-}" ]; then
  mkdir -p "$(dirname "$SUPERVISE_LOG")"
  exec >>"$SUPERVISE_LOG" 2>&1
fi

stop() {
  stopping=1
  [ -n "$child" ] && kill -s "$1" "$child" 2>/dev/null
}
trap 'stop TERM' TERM
trap 'stop INT' INT

while [ "$stopping" = 0 ]; do
  started=$SECONDS
  bun server/src/main.ts &
  child=$!
  log "started server, pid $child"
  # `wait` returns early when a trapped signal arrives; wait again until the child is really gone.
  while kill -0 "$child" 2>/dev/null; do wait "$child"; code=$?; done
  code=${code:-0}
  child=""
  [ "$stopping" = 1 ] && break
  if [ $((SECONDS - started)) -ge 60 ]; then delay=1; fi
  log "server exited with $code after $((SECONDS - started)) s; restarting in ${delay} s"
  # Sleeping in the background keeps the signal traps responsive.
  sleep "$delay" &
  sleeper=$!
  wait "$sleeper" 2>/dev/null
  kill "$sleeper" 2>/dev/null
  delay=$((delay * 2 > 30 ? 30 : delay * 2))
done
log "stopped"
