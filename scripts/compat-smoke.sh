#!/usr/bin/env bash
# compat-smoke.sh MODE IMAGE — run the BUILT image the way a deployment runs it and prove capability
# (not just a 200). See TESTING.md.
#
#   legacy    exactly the hosh.it box's legacy compose (tests/compose/legacy.yml): image default user
#             (root), port 80, word log in / of the container, cap_drop ALL + NET_BIND_SERVICE.
#   template  exactly the hosh-deploy compose (docker-compose.example.yml + wordwave.env from .env.example,
#             as on the box in /srv/wordwave): uid 10001, read-only rootfs, tmpfs /tmp, PORT=8000,
#             word log in the named volume wordwave-data at /data. Also: the box's `hosh-deploy register`
#             checks (required secrets, compose hardening, deploy/hosh-deploy.conf values) and POST_DEPLOY
#             run inside the container as a plain argv, like hosh-deploy does.
#
# Checks: COMServer/selfcheck.py --write (/healthz, web builds, open data, login, Socket.IO client receives
# the broadcast of a real word post), docker health = healthy, the word log is written where the mode
# says, survives a restart (template: the container is recreated) and is read back, no tracebacks.
# Fake credentials only.
set -euo pipefail

MODE="${1:?usage: compat-smoke.sh legacy|template IMAGE}"
IMAGE="${2:?usage: compat-smoke.sh legacy|template IMAGE}"
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
  template)
    conf() { sed -n "s/^$1=//p" "$ROOT/deploy/hosh-deploy.conf"; }
    BIND="$(conf BIND)"; PORT="${TEMPLATE_PORT:-19140}"
    # /srv/wordwave on the box: docker-compose.yml (from the example) + wordwave.env (from .env.example).
    cp "$ROOT/docker-compose.example.yml" "$TMP/docker-compose.yml"
    sed -e "s|^LOGIN=.*|LOGIN=$LOGIN|; s|^MDP=.*|MDP=$MDP|; s|^SECRET=.*|SECRET='compat-secret-not-real'|" \
        "$ROOT/.env.example" > "$TMP/wordwave.env"
    DC=(docker compose -p "$PROJECT" --project-directory "$TMP" --env-file "$TMP/wordwave.env" -f "$TMP/docker-compose.yml")
    step "hosh-deploy register checks (deploy/hosh-deploy.conf, .env.example, compose hardening)"
    [ "$(conf SERVICE)" = wordwave ] && [ "$BIND" = 127.0.0.1:9140 ] && [ "$(conf HOST)" = wordwave.hosh.it ] \
      && [ "$(conf HEALTH)" = /healthz ] && [ "$(conf IMAGE_REPO)" = ghcr.io/pazka/wordwave ] \
      && [ "$(conf ENV_FILE)" = wordwave.env ] && [ "$(conf IMAGE_VAR)" = WORDWAVE_IMAGE ] || fail "hosh-deploy.conf"
    grep -q "^$(conf IMAGE_VAR)='$(conf IMAGE_REPO):v[0-9.]*'$" "$ROOT/.env.example" || fail ".env.example has no $(conf IMAGE_VAR) tag line"
    grep -q 'Host(`@@HOST@@`)' "$ROOT/deploy/traefik-route.yml.tmpl" || fail "route template has no Host(@@HOST@@)"
    for k in $(sed -n 's/^# required:[[:space:]]*//p' "$ROOT/.env.example" | head -n1); do
      [ -n "$(sed -n "s/^$k=//p" "$TMP/wordwave.env" | tail -n1 | tr -d "'\"")" ] || fail "required $k empty"
    done
    "${DC[@]}" config --format json | python3 "$ROOT/scripts/check-compose-hardening.py" "$(conf SERVICE)" "$BIND" \
      || fail "the box would refuse docker-compose.example.yml"
    # CI publishes on another loopback port (the box's BIND may be taken locally); the rest is unchanged.
    sed -i "s|^WORDWAVE_IMAGE=.*|WORDWAVE_IMAGE='$IMAGE'|; s|^WORDWAVE_BIND=.*|WORDWAVE_BIND='127.0.0.1:$PORT'|" "$TMP/wordwave.env"
    LOGDIR=/data WANT_UID=10001 ;;
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
if [ "$MODE" = template ]; then
  step "read-only rootfs: nothing writable outside /data and /tmp"
  in_ctr "
import os
for d in ('/', '/static', '/tmp', '/data'):
    try:
        open(os.path.join(d, '.w'), 'w').close(); os.remove(os.path.join(d, '.w')); print(d, 'writable')
    except OSError:
        print(d, 'read-only')" > "$TMP/rw"
  cat "$TMP/rw"
  [ "$(cat "$TMP/rw")" = "$(printf '/ read-only\n/static read-only\n/tmp writable\n/data writable')" ] || fail "writable paths"
fi

step "capability: web builds, open data, login, word post -> Socket.IO broadcast"
python3 "$ROOT/COMServer/selfcheck.py" "$BASE" --write

step "the word log is written in $LOGDIR"
read_logs | grep -qF "$SENTENCE" || fail "posted text not found in $LOGDIR/*.words"

step "docker health becomes healthy (image / compose HEALTHCHECK on /healthz)"
for _ in $(seq 1 45); do
  h="$(docker inspect -f '{{.State.Health.Status}}' "$(cid)")"; [ "$h" = healthy ] && break; sleep 2
done
[ "$h" = healthy ] || fail "health: $h"

if [ "$MODE" = template ]; then
  step "POST_DEPLOY inside the container, plain argv like hosh-deploy"
  read -r -a pd <<< "$(conf POST_DEPLOY)"
  docker exec "$(cid)" "${pd[@]}"
  step "recreate the container (compose down + up, volume kept): the word log survives and is read back"
  "${DC[@]}" down -t 3 >/dev/null
  "${DC[@]}" up -d --pull never >/dev/null
else
  step "restart the container: the word log survives and is read back"
  "${DC[@]}" restart -t 3 >/dev/null
fi
wait_up
read_logs | grep -qF "$SENTENCE" || fail "word log lost after restart"
python3 "$ROOT/COMServer/selfcheck.py" "$BASE"

step "no tracebacks in the logs"
if "${DC[@]}" logs 2>&1 | grep -E 'Traceback|Error:'; then fail "errors in container log"; fi

COMPAT_OK=1
echo "COMPAT OK ($MODE, $IMAGE)"
