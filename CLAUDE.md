# CLAUDE.md — pazka/WordWave

Word visualisation for the artwork "Sonus Microform" (Alessia Sanna). Production:
https://wordwave.hosh.it/data.html (owner's hosh.it box). Owner: Alexandre (pazka).

One image (`Dockerfile`): two Node build stages (`WordWaveWeb/` three.js client, `Speech2TextWeb/` CRA
admin) copied into `static/` of a Python Flask + Socket.IO server (`COMServer/`, entry `app.py`).
`WordWave/` (Unity) and `Speech2Text/` are not part of the image. Read **TESTING.md** before any change.

**Deployment** (DEPLOY.md): the box still runs the legacy compose (`docker-compose.yml`, port 9898, root,
logs in `/`) until the one-time cutover to **hosh-deploy** (`docker-compose.example.yml`, `deploy/`,
`127.0.0.1:9140`, uid 10001, read-only, logs in volume `wordwave-data`). Every image must keep passing BOTH
(`scripts/compat-smoke.sh legacy|template`). After the cutover a release tag `vX.Y.Z` deploys itself
(`release.yml` → `deploy.yml`; a no-op while `HOSH_DEPLOY_KEY` is unset) — so a tag is a deploy.

## Maintenance (autonomous agent)
Goal: keep base images, dependencies and Actions current **without changing behaviour**.
- **Gate = `ci` green**: `server tests (python 3.11|3.14)`, `front builds (node 26)`, `container smoke` (incl. the Node
  version guardrail `scripts/check-node-version.sh` on the build stages and both compat modes).
- **Branches**: work on `agent/<topic>` (CI runs without a PR). Never push to `main`: `build-scan-push.yml` and
  `release.yml` publish images from `main`/tags (`deploy.yml` deploys releases). Never tag. **The owner merges.**
- **Dependabot PRs**: green → summarise the risk in a PR comment. Red → reproduce per TESTING.md, fix with
  the smallest change on an `agent/` branch. Never weaken or delete a test; if behaviour must change, ask.
- When a base image major is merged, move the CI matrix to `[new, next]` and update TESTING.md.
- Known bugs listed in TESTING.md are pinned on purpose; fixing one is a separate, owner-approved change.

## Rules
- Never commit `.env` (git-ignored; `.env.example` lists the keys), `*.words` logs or secrets; tests use fake credentials only.
- No new dependency without the owner's yes (name it, say why). Tests use the standard library.
- Run dependency installs and tests in containers (TESTING.md), not on the owner's machine.
- Conventional, small commits.
