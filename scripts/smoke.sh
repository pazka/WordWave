#!/usr/bin/env bash
# Container smoke test (upgrade safety net, see TESTING.md).
# Runs the BUILT image, checks both web builds are served, the authenticated word flow, the Socket.IO
# handshake and the open-data endpoints, and fails on Python tracebacks in the logs.
#
#   docker build -t wordwave:smoke . && bash scripts/smoke.sh wordwave:smoke
#
# Hardening: cap_drop ALL + no-new-privileges. Not --read-only and not non-root: the server writes its
# word log next to its code in / (see TESTING.md, "Known gaps"). Uses throwaway credentials only.
set -euo pipefail

IMAGE="${1:-wordwave:smoke}"
NAME="wordwave-smoke-$$"
PORT="${SMOKE_PORT:-18090}"
BASE="http://127.0.0.1:${PORT}"
USERPASS="smoke-user:smoke-pass-not-secret"
TMP="$(mktemp -d)"

# Git Bash on Windows rewrites /paths in args; harmless elsewhere.
dk() { MSYS_NO_PATHCONV=1 docker "$@"; }

cleanup() {
  cd /
  if [ "${SMOKE_OK:-0}" != 1 ]; then echo "---- container log ----"; dk logs "$NAME" 2>&1 | tail -n 50 || true; fi
  dk rm -f "$NAME" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT
fail() { echo "SMOKE FAIL: $*" >&2; exit 1; }
step() { echo "== $*"; }

code() { # code <expected> <curl args...>   body saved to $TMP/body
  local want="$1"; shift
  local got
  got="$(curl -sS -o "$TMP/body" -w '%{http_code}' "$@")"
  [ "$got" = "$want" ] || { head -c 500 "$TMP/body" >&2; fail "expected $want got $got for: $*"; }
}

step "start $IMAGE (cap_drop ALL, no-new-privileges)"
dk run -d --name "$NAME" --cap-drop ALL --security-opt no-new-privileges:true \
  -e LOGIN=smoke-user -e MDP=smoke-pass-not-secret -e secret=smoke-secret-not-real -e PORT=80 \
  -p "127.0.0.1:${PORT}:80" "$IMAGE" >/dev/null

step "wait for /info"
for _ in $(seq 1 60); do
  curl -fsS -o /dev/null "$BASE/info" 2>/dev/null && break
  [ "$(dk inspect --format '{{.State.Running}}' "$NAME")" = true ] || fail "container exited"
  sleep 1
done
code 200 "$BASE/info"
grep -q '^WordWave COM Server V.* on env production$' "$TMP/body" || fail "/info: $(cat "$TMP/body")"

step "both web builds are served"
code 200 "$BASE/data.html"     # WordWaveWeb (three.js visualisation) — the URL the installation loads
grep -qi '<script' "$TMP/body" || fail "data.html has no script"
code 200 "$BASE/admin.html"    # Speech2TextWeb (CRA admin)
grep -q 'id="root"' "$TMP/body" || fail "admin.html is not the CRA build"
code 200 "$BASE/index.html"    # CRA admin index wins at /index.html (historical layout)
grep -q 'id="root"' "$TMP/body" || fail "index.html is not the admin build"

step "Socket.IO handshake (engine.io v4 polling)"
code 200 "$BASE/socket.io/?EIO=4&transport=polling"
grep -q '"sid"' "$TMP/body" || fail "no engine.io sid"

step "auth + word flow (text/plain, like Speech2TextWeb/src/services/rest.js)"
code 401 -X POST "$BASE/login"
code 200 -X POST -u "$USERPASS" "$BASE/login"
code 401 -X POST -H 'content-type: text/plain' --data-binary 'x' "$BASE/words"
code 200 -X POST -u "$USERPASS" -H 'content-type: text/plain' --data-binary 'Bonjour les chats, le chat et la maison! Maisons 42' "$BASE/words"
[ "$(cat "$TMP/body")" = " bonjour chats chats maison maison" ] || fail "registered text: $(cat "$TMP/body")"
code 200 "$BASE/words/current/count"
grep -q '"chats":2' "$TMP/body" || fail "count"
code 200 "$BASE/words/current/csv_count"
head -n1 "$TMP/body" | grep -q '^Word,NbOccurrences' || fail "csv"
code 200 "$BASE/spec"
code 200 "$BASE/swagger/"
code 200 -X DELETE -u "$USERPASS" "$BASE/reload"

step "no tracebacks in logs"
if dk logs "$NAME" 2>&1 | grep -E 'Traceback|Error:'; then fail "errors in container log"; fi

SMOKE_OK=1
echo "SMOKE OK ($IMAGE)"
