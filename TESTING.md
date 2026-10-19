# Testing

Safety net for upgrades (Python and Node base images, Flask/Socket.IO, front build tooling, Actions):
it pins what WordWave does today so a Dependabot PR can be judged on its CI run.

## Layout

| part | runtime | what ships |
|---|---|---|
| `COMServer/` | Python 3.11 (`python:3.11-slim`) | Flask + Flask-SocketIO server, the whole image runtime |
| `WordWaveWeb/` | Node 20 build stage | three.js word cloud → `static/data.html` |
| `Speech2TextWeb/` | Node 20 build stage | CRA admin → `static/admin.html` and `static/index.html` |
| `WordWave/` (Unity), `Speech2Text/` (desktop) | — | not in the image, not tested |

## Run it

```bash
# server tests, in the image's runtime (stdlib unittest, no extra dependency)
docker build -t wordwave:smoke .
docker run --rm -v "$PWD/COMServer":/src:ro wordwave:smoke \
  sh -c "mkdir /w && cp -r /src/. /w/ && cd /w && python -m unittest discover -s tests -v"

# container smoke
bash scripts/smoke.sh wordwave:smoke

# a base bump before Dependabot's PR lands
sed 's/node:20-alpine/node:26-alpine/g' Dockerfile | docker build -f - -t wordwave:next .
bash scripts/smoke.sh wordwave:next
```

(Windows Git Bash: prefix `docker run` with `MSYS_NO_PATHCONV=1`, mount `"$(cygpath -w "$PWD/COMServer")"`.)

## CI (`.github/workflows/ci.yml`)

PRs, `main`, `agent/**`. Jobs: `server tests (python 3.11)` (gate) and `(python 3.14)` (early warning,
non-blocking); `front builds (node 20|26)`; `container smoke` (builds the real Dockerfile, runs
`scripts/smoke.sh`). A Dependabot PR that bumps a base image builds that base in `container smoke`.

## What is covered

`COMServer/tests/test_server.py` (15 tests):
- Basic auth on every write route (`/login`, `POST /words`, `/words/exclude`, `DELETE /words`, `/reload`).
- Word flow: normalisation, stop words, plural folding, counts, meta, `new_text` / `reset` / `reload`
  Socket.IO broadcasts, every open-data endpoint (`/words/current…`, `csv_count`, `stop`).
- `/info`, `/spec`, `/swagger/`; config `${ENV}` placeholders and the prod config reading secrets from env.

`scripts/smoke.sh`: both web builds served (`/data.html`, `/admin.html`, `/index.html`), engine.io
handshake, auth, a real word post (`text/plain`, as the admin UI sends it), open data, swagger, no
tracebacks.

## Upgrades checked (2026-10-19)

- **Node 20 → 26** (Dependabot #5): both fronts build, image smoke OK → **go**.
- **Python 3.11 → 3.14** (Dependabot #6): **no-go as is.** `pip install` fails: `cffi==1.15.1` has no
  3.14 wheel and the slim image has no compiler. Fix first (separate PR): refresh the pinned server
  requirements (at least `cffi`, `cryptography`, `pyOpenSSL`, `MarkupSafe`; they are transitive pins from
  an old `pip freeze`), make `server tests (python 3.14)` green, then merge #6.

## Known bugs and gaps (pinned, not changed)

- **Restart loses counts**: the word log is opened `a+` (cursor at the end), so the replay in
  `WordProcessor.__init__` reads nothing. The text is still on disk (`/words/current/recorded`).
- `get_possible_simplifications`: the `"es"` branch compares a 1-char slice and never fires.
- `DELETE /words` (and every boot with `word_file: ""` in prod) creates a timestamped `.words` file next
  to the code, i.e. in `/` of the image.
- The image runs as **root**, has no `HEALTHCHECK`, and cannot run with a read-only rootfs (log in `/`).
- `wrap_errors` returns Python tracebacks to the client in production.
- The Dockerfile sets default `LOGIN=admin`, `MDP=admin` and a placeholder `secret`; production must
  override them.
- A `.env` file is tracked in git (not read by this work). If it ever held a real secret, rotate it and
  remove it from the repo.
- `react-scripts build` fails with `CI=true` on existing lint warnings (BOMs, an unused variable); CI
  builds with `CI=false`, like the Docker build.
- Flask's development server serves production (`Werkzeug` warning in the logs).
