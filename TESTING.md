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
non-blocking); `front builds (node 26)`; `visual regression` (section "Visual use cases"); `container smoke` (builds the real Dockerfile, runs
`scripts/smoke.sh`). A Dependabot PR that bumps a base image builds that base in `container smoke`.

**Node guardrail** (pazka/hosh-management#5, CVE-2026-111497): `scripts/check-node-version.sh IMAGE`
fails if the image's Node is an EOL line or below the patched minimum of its line (minimums bumped by
the daily security routine). Node only exists in the two front build stages (the runtime is
`python:3.14-slim`), so `container smoke`, `release.yml` and `build-scan-push` build `--target
wordwave-web` / `--target admin-web` and check them, before anything is pushed. `container smoke` also
asserts that the runtime image has no `node` (if it ever does, check the runtime image too) and that
the guard rejects `node:24.21.0-alpine` (the test of the test). Node base images are pinned
`node:26.13.1-alpine@sha256:…` (Dependabot `docker` bumps tag and digest together).

## What is covered

`COMServer/tests/test_server.py` (19 tests):
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

## Logs (`COMServer/tests/test_log.py`, 12 tests; hosh-management AGENTS.md §11)

`COMServer/jsonlog.py` (standard library only) writes one JSON object per line on stdout: `ts` (UTC, ms), `level`,
`service` (`wordwave`), `version` (`APP_VERSION`, set from the release tag by `release.yml` through the Dockerfile
`ARG VERSION`; `dev` otherwise), `event`, `msg`, then the line's fields. `LOG_LEVEL` (else `APP_LOG_LEVEL`) sets
the level, default `info`. At info the server writes only:
- `startup`, BEFORE the blocking run (the old `print` came after it and never showed): port, `data_dir_writable`,
  `word_log`, `web_builds`, `log_level`, and the NAMES of the configuration that is set (never a value or a path);
- `shutdown` on SIGTERM (what `docker stop` sends) and SIGINT, then exit 0. The handler is installed before the run
  (it used to come after it, so it was never set). `docker stop` is now immediate instead of the 10 s kill;
- `request_failed` (error) for a status >= 500, with `err` when an exception caused it; `auth_failed` (warn) for a
  4xx on `/login`, `/words`, `/words/exclude`, `/reload`; `request_slow` (warn) above 1 s; every other request and
  `/healthz` only at debug. Request fields: `req_id` (`X-Request-Id` kept when it is a plain token of at most 64
  characters, generated otherwise, returned in the answer), `method`, `route` (the Flask rule, never the raw
  path or query), `status`, `dur_ms`;
- `route_error` (error) for an exception caught by `wrap_errors`: the client still gets the same error body as
  before (known quirk below), the log gets `req_id`, `method`, `route` and `err` (type, message, stack frames, no
  word "Traceback") with the credentials and the request body replaced by `<hidden>`. It replaces the ANSI
  coloured `print` of the traceback.

- `socket_refused` (warn) when engine.io refuses a Socket.IO client of another site (its Origin is not in
  `socket_cors`), without the Origin itself; other engine.io / Socket.IO / Werkzeug errors are `socket_error` /
  `server_error` lines with `err`, never the library's own text.

Werkzeug's access log (IP + raw path on stderr), engine.io's own stderr handler and Flask's banner and exception
print are off. Never logged: the
words people send, credentials, IPs, raw paths or query strings.

Tests: the line format, level filtering and `LOG_LEVEL`/`APP_LOG_LEVEL`, config names without values, `err`
(hidden words, frames), request ids; the request-line rules on a small Flask app (a 500 with `err` and no path,
query, body or secret; auth 4xx and slow at warn; healthz, 404 and the rest silent at info, by route at debug);
library records as JSON lines without their text; the real `app.py` with the production config shape in a
subprocess: the startup line (`assertEqual` on its keys and values), a wrong password (401, one `auth_failed`
line), a non-UTF-8 word post caught by `wrap_errors` (same error body for the client, one `route_error` line), a
Socket.IO handshake from another site's Origin (400 as before, one `socket_refused` line), a word post and the open data silent, `X-Request-Id` echoed or
generated, SIGTERM and SIGINT each writing one `shutdown` line and exiting 0, every stdout line a standard JSON
line, no credential, posted word, query, address, Origin, path or ANSI colour in stdout, stderr empty.
`scripts/smoke.sh` checks the built image the same way (stdout only JSON lines, one startup line with
`word_log`/`web_builds` true, no error line, nothing on stderr, no credential, posted word or address).

## Visual use cases (visual regression, hosh-management AGENTS.md §3)

`visual/run.sh IMAGE` (CI job `visual regression`): the built image runs as `docker-compose.example.yml` does
(uid 10001, read-only rootfs, tmpfs /tmp, cap_drop ALL, no-new-privileges, pids 128, mem 512m, `PORT=8000`,
`DATA_DIR=/data` on a fresh volume) with **throwaway** admin credentials (`visual-user` / `visual-pass-not-secret`).
Two headless Chromes of the runner (mouse for 1400 / 1024, touch + mobile viewport for 390) open the pages at
their **production URL** `https://wordwave.hosh.it/…`: both fronts choose their server from the page host
(`env.ts` / `env.js`: `localhost` → the DEV server, anything else → `https://wordwave.hosh.it/`) and the image
only accepts the production origins (Socket.IO + REST CORS), so the harness does not change either. Every request
to that origin is paused in Chrome (DevTools `Fetch` domain) and answered by the container (`visual/cdp.mjs`);
every other host resolves to nothing, so nothing leaves the runner (the Socket.IO websocket upgrade fails and the
client stays on long polling, through the same proxy). `visual/shoot.mjs` runs with Node of the Dockerfile's own
pinned `node:…@sha256` image (the runtime image has no Node), Node built-ins only. Before **every** shot the word
state is set through the REST API (`DELETE /words`, then `POST /words` with the fixed French text of
`visual/cases.mjs` `SEED`: 20 distinct words, counts 1 to 6), so the shots do not depend on their order.

Determinism: the visualisation is **not** a WebGL canvas (three.js never reaches `bundle.js`; `#three-canvas`
stays empty). Every word is a `<p>` placed on every frame from `Math.random()` and `Date.now()`. A script run
before the page's own (`FREEZE_JS`) fixes `Date.now()` (2026-01-01) and replaces `Math.random()` by a seeded PRNG,
re-seeded each time a word payload is parsed (`/words/current`, Socket.IO `new_text`), so each word gets the same
place on every run; the 1 s `transition` of the words and all animations are switched off before the shot.
Checked: two full runs on the same Chrome are pixel-identical, and a font change of the words fails the shots.
Each case is compared with `visual/baseline/<id>-<width>.png` (tolerance: channel 24, 0.1 % of the pixels; any
page exception, `alert()`/`confirm()` or server traceback fails the run). Shots, diffs, `report.json` (with the
proxied requests of every shot) and the server log are the artifact `visual-<sha>`.

| id | page / state | steps |
|---|---|---|
| V1-cloud-empty | `/data.html`, no word yet: black page, no word | `DELETE /words`, open |
| V2-cloud-words | `/data.html`, the 20 seeded words, size and grey by count (`voix` 6 = biggest, white) | seed, open |
| V3-cloud-light | `/data.html?light`: white background, black words | seed, open |
| V4-cloud-min3 | `/data.html?min=3`: only the 5 words said 3 times or more | seed, open |
| V5-cloud-live-update | `/data.html` open while the admin posts `LIVE` ("Un oiseau passe au-dessus de la mer, un oiseau blanc."): `oiseau`, `passe`, `blanc` arrive by Socket.IO `new_text` (23 words) | seed, open, wait for the Socket.IO connect, `POST /words` |
| V6-cloud-after-reset | `/data.html` open while the admin resets (`DELETE /words` = "Reset visual"): Socket.IO `reset`, the page reloads `/words/current` and hides every word | seed, open, wait for the Socket.IO connect, `DELETE /words` |
| A1-admin-logged-out | `/admin.html`: server info (`WordWave COM Server V… on env production`), login form, "Words Download" buttons | open |
| A2-admin-wrong-password | `/admin.html`, login with a wrong password: `/login` answers 401, the form stays filled (no message) | type login + wrong password, click Login |
| A3-admin-logged-in | `/admin.html` logged in: "Logged in !", Client visuals, Speech Recognition Control (switches, slider, language), Manual Text Input, Additional Exclude Word, Speech/Server Result | type login + password, click Login |
| A4-admin-text-sent | A3, then `LIVE` typed in Manual Text Input and "Submit Manuel Text": the box is emptied, "Server Result" shows ` oiseau passe mer oiseau blanc` | A3 + type, click Submit |
| A5-admin-language-menu | A3, then the language select opened: France / United Kingdom / United States (default from the browser language, en-US) | A3 + open the select |
| A6-index-logged-out | `/index.html`: the same admin app (CRA index wins at `/index.html`) | open |
| X1-root-404 | `/` (the bare host): Flask's "404 Not Found" page | open |

All 13 cases at 1400, 1024 and 390 px = 39 shots. On the phone width the visualisation is shot as a phone shows
it: its viewport meta (`width=device-width*2, initial-scale=0.1`) zooms the page out, so the 390 px shot is the
whole zoomed-out layout (1560 x 3600), not a 390 px column.

Not covered: the speech recognition itself (microphone; "Start Listening" turns the panel red), the six
downloads (files, not pages), "Reload visualizer in all clients" (a page reload of the visualisations),
the confirm dialog of "Reset visual" (the harness fails on any dialog; V6 does the reset through the API), the
"Additional Exclude Word" result (no visible change in the admin), `/swagger/` (third-party UI), the Unity client.

Current behaviour pinned by the shots, not changed (a fix is a separate, owner-approved change): a wrong password gives no message (A2); in `?light` the most said words are almost invisible (V3: the inline grey-to-white colour of `app.ts` wins over `body.light p { color: black }`, so `voix`/`mer` are white on white);
the admin calls `https://wordwave.hosh.it//login` (double slash, accepted by Werkzeug); `/` is a bare 404 (X1).

New baselines (only in a PR that says the visual change is wanted): CI prints every failing shot in the job log
(`VISUAL-PNG` lines); `node visual/from-log.mjs <log> visual/baseline --chrome` writes them back (sha256
checked), or take them from the artifact; look at every picture before committing. A new runner Chrome may move
anti-aliasing: `report.json` and the log say when the baselines were made with another Chrome
(`visual/baseline/chrome.txt`).

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
