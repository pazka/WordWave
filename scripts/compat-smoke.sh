#!/usr/bin/env bash
# compat-smoke.sh MODE IMAGE — run the BUILT image the way a deployment runs it and prove capability
# (not just a 200). See TESTING.md.
#
#   legacy    exactly the hosh.it box's legacy compose (tests/compose/legacy.yml): image default user
#             (root), port 80, word log in / of the container, cap_drop ALL + NET_BIND_SERVICE.
#
# Checks: COMServer/selfcheck.py --write (web builds, open data, login, Socket.IO client receives the
# broadcast of a real word post), the word log is written where the mode says, survives a restart of
# the container and is read back, no tracebacks. Fake credentials only.
set -euo pipefail

MODE="${1:?usage: compat-smoke.sh legacy IMAGE}"
IMAGE="${2:?usage: compat-smoke.sh legacy IMAGE}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
PROJECT="wwcompat-$MODE-$$"
export LOGIN=compat-user MDP=compat-pass-not-secret SENTENCE='Bonjour les chats, le chat et la maison! Maisons 42'

fail() { echo "COMPAT FAIL ($MODE): $*" >&2; exit 1; }
step() { echo "== [$MODE] $*"; }

case "$MODE" in
  legacy)
    PORT="${LEGACY_PORT:-19898}"
    printf 'LOGIN=%s\nMDP=%s\nSECRET=compat-secret-not-real\n' "$LOGIN" "$MDP" > "$TMP/.env"
    export IMAGE LEGACY_PORT="$PORT" NAME="$PROJECT"
    DC=(docker compose -p "$PROJECT" --env-file "$TMP/.env" -f "$ROOT/tests/compose/legacy.yml")
    LOGDIR=/ WANT_UID=0 ;;
  *) fail "unknown mode" ;;
esac
BASE="http://127.0.0.1:$PORT"

cleanup() {
  if [ "${COMPAT_OK:-0}" != 1 ]; then echo "---- container log ----"; "${DC[@]}" logs 2>&1 | tail -n 60 || true; fi
  "${DC[@]}" down -v >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

cid() { "${DC[@]}" ps -q wordwave; }
wait_up() {
  for _ in $(seq 1 60); do
    curl -fsS -o /dev/null "$BASE/info" 2>/dev/null && return 0
    sleep 1
  done
  fail "server did not answer on $BASE"
}
in_ctr() { docker exec "$(cid)" python -c "$1"; }
# Prints the content of the *.words files in $LOGDIR (the word logs written by the server).
read_logs() { in_ctr "import glob; print(''.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob('$LOGDIR/*.words'))))"; }

step "compose up ($IMAGE)"
"${DC[@]}" up -d --pull never
wait_up

step "runs as uid $WANT_UID"
[ "$(in_ctr 'import os; print(os.getuid())')" = "$WANT_UID" ] || fail "uid is not $WANT_UID"

step "capability: web builds, open data, login, word post -> Socket.IO broadcast"
python3 "$ROOT/COMServer/selfcheck.py" "$BASE" --write

step "the word log is written in $LOGDIR"
read_logs | grep -qF "$SENTENCE" || fail "posted text not found in $LOGDIR/*.words"

step "restart the container: the word log survives and is read back"
"${DC[@]}" restart -t 3 >/dev/null
wait_up
read_logs | grep -qF "$SENTENCE" || fail "word log lost after restart"
python3 "$ROOT/COMServer/selfcheck.py" "$BASE"

step "no tracebacks in the logs"
if "${DC[@]}" logs 2>&1 | grep -E 'Traceback|Error:'; then fail "errors in container log"; fi

COMPAT_OK=1
echo "COMPAT OK ($MODE, $IMAGE)"
