# Testing

Safety net for upgrades (Python and Node base images, Flask/Socket.IO, front build tooling, Actions):
it pins what WordWave does today so a Dependabot PR can be judged on its CI run.

## Layout

| part | runtime | what ships |
|---|---|---|
| `COMServer/` | Python 3.14 (`python:3.14-slim`) | Flask + Flask-SocketIO server, the whole image runtime |
| `WordWaveWeb/` | Node 26 build stage | three.js word cloud → `static/data.html` |
| `Speech2TextWeb/` | Node 26 build stage | CRA admin → `static/admin.html` and `static/index.html` |
| `WordWave/` (Unity), `Speech2Text/` (desktop) | — | not in the image, not tested |

## Run it

```bash
# server tests, in the image's runtime (stdlib unittest, no extra dependency)
docker build -t wordwave:smoke .
docker run --rm -v "$PWD/COMServer":/src:ro wordwave:smoke \
  sh -c "mkdir /w && cp -r /src/. /w/ && cd /w && python -m unittest discover -s tests -v"

# container smoke
bash scripts/smoke.sh wordwave:smoke
bash scripts/compat-smoke.sh legacy wordwave:smoke   # the box's legacy compose
bash scripts/compat-smoke.sh template wordwave:smoke # the hosh-deploy compose (docker-compose.example.yml)

# a base bump before Dependabot's PR lands
sed -E 's/^FROM node:[^ ]+ AS/FROM node:26-alpine AS/' Dockerfile | docker build -f - -t wordwave:next .
bash scripts/smoke.sh wordwave:next
```

(Windows Git Bash: prefix `docker run` with `MSYS_NO_PATHCONV=1`, mount `"$(cygpath -w "$PWD/COMServer")"`.)

## CI (`.github/workflows/ci.yml`)

PRs, `main`, `agent/**`. Jobs: `server tests (python 3.11)` (gate) and `(python 3.14)` (early warning,
non-blocking); `front builds (node 26)`; `container smoke` (builds the real Dockerfile, runs
`scripts/smoke.sh`). A Dependabot PR that bumps a base image builds that base in `container smoke`.

**Node guardrail** (pazka/hosh-management#5, CVE-2026-111497): `scripts/check-node-version.sh IMAGE`
fails if the image's Node is an EOL line or below the patched minimum of its line (minimums bumped by
the daily security routine). Node only exists in the two front build stages (the runtime is
`python:3.14-slim`), so `container smoke`, `release.yml` and `build-scan-push` build `--target
wordwave-web` / `--target admin-web` and check them, before anything is pushed. `container smoke` also
asserts that the runtime image has no `node` (if it ever does, check the runtime image too) and that
the guard rejects `node:24.21.0-alpine` (the test of the test). Node base images are pinned
`node:26.13.0-alpine@sha256:…` (Dependabot `docker` bumps tag and digest together).

## What is covered

`COMServer/tests/test_server.py` (15 tests):
- Basic auth on every write route (`/login`, `POST /words`, `/words/exclude`, `DELETE /words`, `/reload`).
- Word flow: normalisation, stop words, plural folding, counts, meta, `new_text` / `reset` / `reload`
  Socket.IO broadcasts, every open-data endpoint (`/words/current…`, `csv_count`, `stop`).
- `/info`, `/spec`, `/swagger/`; config `${ENV}` placeholders and the prod config reading secrets from env.
- Hosting (hosh-deploy migration): `DATA_DIR` moves the timestamped word log (unset/empty = next to the code,
  as before); `GET`/`HEAD /healthz` → 200 `{"status":"ok","checks":{"word_log","web_builds"},"words"}`, 503
  when the log is closed or the web builds are missing, no secret in the answer.

`scripts/smoke.sh`: both web builds served (`/data.html`, `/admin.html`, `/index.html`), engine.io
handshake, auth, a real word post (`text/plain`, as the admin UI sends it), open data, swagger, no
tracebacks, and the admin bundle check below on the JS the image serves.

`scripts/compat-smoke.sh legacy IMAGE` (CI `container smoke`, step "Compat - legacy box compose"): runs the
image with the box's legacy compose unchanged (`tests/compose/legacy.yml`: default user = root, port 80,
`cap_drop ALL` + `NET_BIND_SERVICE`, `LOGIN`/`MDP`/`secret` env) and proves capability with
`COMServer/selfcheck.py --write`: both web builds, open data, `/login`, and a stdlib Socket.IO client (engine.io
v4 polling, `Origin: https://wordwave.hosh.it`) that receives the `new_text` broadcast of a real word post. The
word log must be in `/*.words` and still be there after `docker compose restart`. Every image must pass it
until the box has moved to hosh-deploy (DEPLOY.md). `selfcheck.py` without `--write` changes no state; it is
also the box's POST_DEPLOY (`deploy/hosh-deploy.conf`).

`scripts/compat-smoke.sh template IMAGE` (step "Compat - hosh-deploy compose"): `docker-compose.example.yml` +
`wordwave.env` made from `.env.example`, as in `/srv/wordwave` on the box. First the checks of `hosh-deploy
register` (`deploy/hosh-deploy.conf` values, `# required:` secrets, the route template, and the compose
hardening check copied from the box into `scripts/check-compose-hardening.py`), then: uid 10001, only `/data`
and `/tmp` writable, the same `selfcheck.py --write`, word log in the `wordwave-data` volume, docker health
`healthy`, POST_DEPLOY run with `docker exec` as a plain argv, then `compose down` + `up` (container recreated,
volume kept) and the log read back. Both modes also check `/healthz` and the image HEALTHCHECK, and
`release.yml` runs `smoke.sh` + both modes on the candidate before pushing anything.

`scripts/check-admin-bundle.sh <build dir>`: the built admin bundle still contains the admin features
(login form fields/route/Basic auth, manual text + exclude-word sending, reset/reload of the visuals,
speech-recognition controls, downloads, `/info`), by visible text, field names and REST routes. Runs in
the CI `front builds` job (on `Speech2TextWeb/build`) and in the smoke. Passes on the pre-upgrade bundle.

## Changes and upgrades (2026-10-19)

- **Images: Node 26 fronts + Python 3.14 server** (supersedes Dependabot #5 and #6).
- **Server dependencies refreshed for 3.14.** The pins were an old `pip freeze`: `cffi`, `cryptography`,
  `pyOpenSSL`, `requests` & co. were never imported and `cffi` 1.15.1 blocked 3.14; Werkzeug 2.0 uses
  `ast.Str` (removed in Python 3.12). Now: Flask 3.1, Werkzeug 3.1, Flask-SocketIO 5.7, python-socketio
  5.17, flask-cors 6, flask-swagger-ui 5, all pinned exactly (incl. transitives).
  Code adapted, behaviour unchanged: `/info` reads `app.config['ENV']` (Flask removed `app.env`),
  broadcasts use a server-level `emit` (python-socketio removed `broadcast=`), production `run` passes
  `allow_unsafe_werkzeug=True` (same Werkzeug server as before; Flask-SocketIO now asks for the opt-in).
  Before the upgrade the suite was extended and pinned on the OLD image: REST CORS (origin echoed, `Vary`,
  allowed methods/headers) in the tests; Socket.IO and REST origin allow-lists in the smoke. 16/16 on Python
  3.11 and 3.14; smoke OK on both images.
- **Fails closed**: the Dockerfile no longer bakes `LOGIN=admin MDP=admin`; without credentials the server
  refuses to start (asserted by the smoke).
- `docker-compose.yml` mirrors the box (ghcr image, `127.0.0.1:9898`, `no-new-privileges`, `cap_drop ALL`
  + `NET_BIND_SERVICE`); it used an invalid `env:` key, so its credentials were ignored. The tracked `.env`
  (placeholders only) became `.env.example`; `.env` is git-ignored. Checked on the box (read-only,
  2026-10-19): the real `.env` there differs from the repo one and is the one compose uses.
- **Front dependencies** (supersedes Dependabot #17, #18, #19). Admin feature check added first and green
  on the old bundle.
  - #17 minor/patch group as generated, plus `typescript` 4.9 → 5.9 (`@types/three` 0.186 needs TS ≥ 5.6;
    TS 7 is not usable with ts-loader). `three` never reaches `bundle.js` (type-only/unused imports), so the
    word cloud's shipped code only changes by `socket.io-client` 4.8; live `new_text` updates checked in a
    browser. `react-scripts` 5.0.1 drops a few obsolete CSS prefixes (`-webkit-fit-content`).
  - #18 + #19 together: `@mui/material` and `@mui/icons-material` 9.5, React/ReactDOM 18.3 (MUI 9's
    `react/jsx-runtime` import does not resolve with React 17 under CRA), `react-redux` 9.3 (v7 refuses
    React 18; it is not imported anywhere). Unused deep import `@mui/material/Select/SelectInput` removed
    (not exported by MUI 9). `index.js` still uses `ReactDOM.render` (React 18 legacy root).
  - Checked in Chrome against the old image: same layout/styles (computed styles + geometry of every
    element), login, word sending, reset, language menu, switches, slider (pointer and keyboard);
    screenshots identical except sub-pixel anti-aliasing on the two switch thumbs.
  - Not covered: `npm test` (CRA/jest, `App.test.js`) is not part of CI; `@testing-library/react` 12
    stays (unused by the build).

## Known bugs and gaps (pinned, not changed)

- **Restart loses counts**: the word log is opened `a+` (cursor at the end), so the replay in
  `WordProcessor.__init__` reads nothing. The text is still on disk (`/words/current/recorded`).
- `get_possible_simplifications`: the `"es"` branch compares a 1-char slice and never fires.
- `DELETE /words` (and every boot with `word_file: ""` in prod) creates a new timestamped `.words` file in
  `DATA_DIR` (default: next to the code, i.e. `/` of the image; `/data` under hosh-deploy).
- The image's default user is **root** and its defaults write in `/` (kept for the box's legacy compose);
  the hosh-deploy compose runs it as 10001 with a read-only rootfs (`PORT=8000`, `DATA_DIR=/data`).
- `wrap_errors` returns Python tracebacks to the client in production.
- `react-scripts build` fails with `CI=true` on existing lint warnings (BOMs, an unused variable); CI
  builds with `CI=false`, like the Docker build.
- Flask's development server (Werkzeug) serves production.
