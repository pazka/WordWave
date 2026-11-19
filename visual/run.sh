#!/usr/bin/env bash
# Visual regression of the built image (hosh-management AGENTS.md §3, use cases in TESTING.md
# "Visual use cases"). Pattern of pazka/DrawTogether visual/:
#   visual/run.sh [IMAGE]                (default wordwave:smoke)
# Starts the image as docker-compose.example.yml runs it (uid 10001, read-only rootfs, tmpfs /tmp, cap_drop ALL,
# no-new-privileges, pids/memory limits, PORT=8000, DATA_DIR=/data on a fresh volume) with THROWAWAY admin
# credentials, starts two headless Chromes on the runner (mouse / touch; every host name resolves to nothing),
# then runs visual/shoot.mjs with Node from the Dockerfile's own pinned node:…@sha256 build image (built-in
# fetch + WebSocket, no package installed; the runtime image has no Node): Chrome opens
# https://wordwave.hosh.it/… and every request to that origin is answered by the container (visual/cdp.mjs);
# every use case at 1400 / 1024 / 390 is compared with visual/baseline/. Shots, diffs and report.json: $OUT.
#   CHROME=/path/to/chrome (default google-chrome)   OUT=visual/out   VISUAL_PRINT_NEW=1 (CI: failing
#   shots printed in the log, visual/from-log.mjs writes them back as files).   ONLY=V2 (cases starting with V2)
#   Extra arguments go to shoot.mjs (--update: overwrite the baselines; QA only, in a PR that says why).
# New baselines (QA, in a PR that says the change is wanted): take them from the CI log of the runner's
# Chrome with visual/from-log.mjs (or the artifact), look at every picture, commit them.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
IMAGE="${1:-wordwave:smoke}"
[ $# -gt 0 ] && shift
OUT="${OUT:-visual/out}"
NAME="ww-visual-$$"
VOL="ww-visual-$$"
PORT=9878
CDP_DESKTOP=9371
CDP_PHONE=9372
VISUAL_LOGIN=visual-user
VISUAL_MDP=visual-pass-not-secret
# the Node of the front build stages (same tag + digest, bumped by Dependabot with the Dockerfile)
NODE_IMAGE="$(grep -m1 -oE 'node:[^ ]+@sha256:[0-9a-f]{64}' Dockerfile)"
P1="$(mktemp -d)"; P2="$(mktemp -d)"
LOGS="$(mktemp -d)"
PIDS=()
dk() { MSYS_NO_PATHCONV=1 docker "$@"; }
cleanup() {
  for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done
  dk rm -f "$NAME" >/dev/null 2>&1 || true
  dk volume rm -f "$VOL" >/dev/null 2>&1 || true
  rm -rf "$P1" "$P2" "$LOGS"
}
trap cleanup EXIT
fail() { echo "VISUAL FAIL: $*" >&2; exit 1; }
[ -n "$NODE_IMAGE" ] || fail "no pinned node:…@sha256 image in the Dockerfile"

# The app as docker-compose.example.yml runs it (values of that file, by hand: no env file, no secret).
dk volume create "$VOL" >/dev/null
dk run -d --name "$NAME" \
  --user 10001:10001 --read-only --tmpfs /tmp:size=16m,mode=1777 --cap-drop ALL \
  --security-opt no-new-privileges:true --pids-limit 128 --memory 512m \
  -e PORT=8000 -e DATA_DIR=/data -e LOGIN="$VISUAL_LOGIN" -e MDP="$VISUAL_MDP" -e secret=visual-secret-not-real \
  -v "$VOL:/data" -p "127.0.0.1:$PORT:8000" "$IMAGE" >/dev/null
for _ in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null || { dk logs "$NAME" >"$LOGS/app.log" 2>&1 || true; tail -40 "$LOGS/app.log" >&2; fail "app not healthy"; }
test "$(dk exec "$NAME" id -u)" = 10001 || fail "app does not run as 10001"

RULES="MAP * ~NOTFOUND"  # = visual/cdp.mjs RESOLVER_RULES
COMMON=(--headless=new --no-sandbox --disable-gpu --mute-audio --no-first-run --hide-scrollbars
  --force-color-profile=srgb --font-render-hinting=none --disable-features=Translate,MediaRouter
  --disable-background-networking --lang=en-US "--host-resolver-rules=$RULES")
LANG=en_US.UTF-8 "${CHROME:-google-chrome}" "${COMMON[@]}" \
  --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 \
  --remote-debugging-port=$CDP_DESKTOP --user-data-dir="$P1" about:blank >"$LOGS/chrome1.log" 2>&1 &
PIDS+=($!)
LANG=en_US.UTF-8 "${CHROME:-google-chrome}" "${COMMON[@]}" \
  --remote-debugging-port=$CDP_PHONE --user-data-dir="$P2" about:blank >"$LOGS/chrome2.log" 2>&1 &
PIDS+=($!)
for port in $CDP_DESKTOP $CDP_PHONE; do
  for _ in $(seq 1 120); do curl -fsS "http://127.0.0.1:$port/json/version" >/dev/null 2>&1 && break; sleep 0.5; done
  curl -fsS "http://127.0.0.1:$port/json/version" >/dev/null 2>&1 || {
    tail -30 "$LOGS/chrome1.log" "$LOGS/chrome2.log" >&2
    fail "Chrome (${CHROME:-google-chrome}) has no DevTools endpoint on 127.0.0.1:$port"; }
done

rm -rf "$OUT"; mkdir -p "$OUT"; chmod 777 "$OUT"
BASE_MOUNT=(-v "$ROOT/visual:/v:ro")
# --update writes the baselines: mount them writable for that run only
for a in "$@"; do
  if [ "$a" = --update ]; then BASE_MOUNT+=(-v "$ROOT/visual/baseline:/v/baseline"); chmod 777 visual/baseline; fi
done
set +e
dk run --rm --network host --user 10001:10001 --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  -e CDP_DESKTOP=$CDP_DESKTOP -e CDP_PHONE=$CDP_PHONE -e OUT=/out -e BASELINE=/v/baseline/ \
  -e VISUAL_LOGIN="$VISUAL_LOGIN" -e VISUAL_MDP="$VISUAL_MDP" \
  -e VISUAL_PRINT_NEW="${VISUAL_PRINT_NEW:-}" -e ONLY="${ONLY:-}" \
  "${BASE_MOUNT[@]}" -v "$ROOT/$OUT:/out" --entrypoint node "$NODE_IMAGE" \
  /v/shoot.mjs "http://127.0.0.1:$PORT" "$@"
rc=$?
set -e
# logs to a file first: under pipefail a pipe into grep -q can lose the match (SIGPIPE) and hide an error
dk logs "$NAME" >"$LOGS/app.log" 2>&1 || true
if grep -qE 'Traceback|Error' "$LOGS/app.log"; then
  echo "VISUAL FAIL: the server logged an error" >&2
  grep -E -B2 -A8 'Traceback|Error' "$LOGS/app.log" | head -60 >&2
  rc=1
fi
cp "$LOGS/app.log" "$OUT/server.log" 2>/dev/null || true
exit $rc
