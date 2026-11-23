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
- **Gate = `ci` green**: `server tests (python 3.11|3.14|3.15)`, `front builds (node 26)`, `container smoke` (incl. the Node
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

## Agent system: QA gate, journal, "what happened to X"
**Before any work in this repo, whatever the request:** read the hub `pazka/hosh-management`:
`AGENTS.md` (how the hosh.it agents and the owner work together), `README.md` (every app, site, repo and
journal), `roles/` (the full procedure of each agent: QA, Security, Developer, DevOps, dependency updates).
`gh api repos/pazka/hosh-management/contents/AGENTS.md -H "Accept: application/vnd.github.raw"`
(same for `README.md`, `roles/README.md`, `roles/qa.md`...). Those rules apply here; this file adds the
repo's own.

Canonical rules: `AGENTS.md` in the private hub `pazka/hosh-management`
(`gh api repos/pazka/hosh-management/contents/AGENTS.md -H "Accept: application/vnd.github.raw"`).
Summary, binding for every agent that works in this repo:
- **Nothing is merged without the independent QA agent.** Work on `agent/<topic>-<yyyymmdd>`, get CI
  green, write in the PR body what changed, which use cases it touches and how it was tested, then add
  the label `qa:requested`. Merge only when the PR has `qa:approved` AND a comment
  `QA-VERDICT: APPROVED sha=<current head sha>`. On `qa:changes-requested`: fix on the same branch,
  answer each finding, ask again; QA re-tests the whole PR. Never approve your own PR. After QA's
  approval the agent that opened the PR merges it: this replaces "the owner merges" and "merge when
  CI is green" wherever this file still says so.
- **Owner fast lane**: when the owner asks for a feature in a session he is in, do it end to end in
  that session (discuss, develop, QA by a fresh independent QA subagent or a QA routine run now, merge,
  release, deploy, show the live URL). Rules: AGENTS.md section 2b. The session that wrote the code never
  writes the verdict.
- **QA owns the tests and the visual regression**: every use case a user can reach (listed in
  `TESTING.md`), screenshots at 1400 / 1024 / 390 px, baselines in the repo. A wanted visual change
  must be announced in the PR. Never weaken a test or a gate to get green.
- A NEW third-party dependency always needs the owner: open an issue in `pazka/hosh-management`
  labelled `ready-for-human` (that label is the list of places where the owner is needed).
- Release = Actions → release with `version=vX.Y.Z` on the default branch. Never push a git tag.
- **Journal**: after each event (PR ready, QA verdict, merge, release, deploy, rollback, incident,
  blocker) add one comment to this project's journal, `pazka/hosh-management#16`.
- **When the owner asks "what happened to X"** (this app, another one, or the server): open the index
  in `pazka/hosh-management` `README.md`, read the last comments of X's journal issue
  (`gh issue view <n> -R pazka/hosh-management --comments`), then the open `ready-for-human` issues,
  then PRs / Actions runs if needed. Server facts you cannot see: ask the Box agent (mailbox from a
  laptop session, or an issue labelled `box-question`). Answer with: what happened (dated), the state
  now, where the owner is needed.
- Online checks use only the URLs in `pazka/hosh-management` `uptime/checks.json`.
