# Deploying wordwave.hosh.it

Deployment on the hosh.it box (box standard: hosh-migration `11-BOX-STANDARD.md`, app contract
`docs/BOX-CONTRACT.md` of the template). Two ways to run the same image:

| | legacy (live until the cutover, §0) | hosh-deploy (target, §1) |
|---|---|---|
| Compose | `/root/hosh-deploy/wordwave/docker-compose.yml` + `.env` (= `docker-compose.yml` here) | `/srv/wordwave/docker-compose.yml` (= `docker-compose.example.yml`) + `wordwave.env` |
| User / rootfs | image default (root), writable | `10001:10001`, `read_only`, tmpfs `/tmp` |
| Port | `127.0.0.1:9898` → 80 | `127.0.0.1:9140` → 8000 (`PORT=8000`) |
| Word logs (`*.words`) | `/` of the container (lost when the container is removed) | volume `wordwave-data` at `/data` (`DATA_DIR=/data`) |
| Route | router in `/root/hosh-deploy/edge/traefik/dynamic/routes.yml` | `/root/hosh-deploy/edge/traefik/dynamic/wordwave.yml` (written by hosh-deploy) |
| Deploy | by hand on the box | every release, from GitHub Actions (§1) |

Every image is tested in CI against **both** composes (`scripts/compat-smoke.sh legacy|template`,
TESTING.md), and `release.yml` runs both before pushing anything. Public URLs do not change: the
installation loads `https://wordwave.hosh.it/data.html`, the Unity client (`WordWave/Assets/Server.cs`)
and the WordWaveWeb front connect by Socket.IO to `https://wordwave.hosh.it`.

## 0. Cutover from legacy (once; on-box coordinator in an owner-opened sudo window)

Box rules: `ACTIONS-LOG.md` intent BEFORE, result + revert AFTER; `scripts/smoke.sh` BEFORE and AFTER.
Prerequisites: a release `vX.Y.Z` ≥ **v1.4.0** built by `release.yml` (first one with `/healthz`, below:
`$V`), and the box can pull it: the `wordwave` GHCR package is **private** today (X.28) → the owner makes it
public, or use the X.28d export fallback (`11-BOX-STANDARD.md` §6). Port 9140 is reserved for it (§4).

```sh
V=v1.4.0   # the release to install
# 1 — BEFORE: smoke + inventory of the live word logs (they live INSIDE the legacy container, in /)
sudo docker exec wordwave sh -c 'cd / && ls -ln *.words && wc -c *.words | tail -n1'
# 2 — release checkout (provides docker-compose.example.yml, .env.example, deploy/*)
sudo mkdir -p /srv/wordwave && sudo chmod 750 /srv/wordwave && cd /srv/wordwave
[ -d .git ] || { sudo git init -q && sudo git remote add origin https://github.com/pazka/WordWave; }
sudo git fetch -q --depth 1 origin tag "$V" && sudo git checkout -q "$V"
```
**3 — owner: env file.** Same secret names and values as the legacy `.env`: `LOGIN`, `MDP`, `SECRET`
(nothing else moves; `WORDWAVE_IMAGE` / `WORDWAVE_BIND` come from `.env.example`). Without printing them:
```sh
sudo bash -c 'cd /srv/wordwave && umask 077 && grep -vE "^(LOGIN|MDP|SECRET)=" .env.example > wordwave.env \
  && grep -E "^(LOGIN|MDP|SECRET)=" /root/hosh-deploy/wordwave/.env >> wordwave.env && chmod 600 wordwave.env'
```
After this line the agent never reads `wordwave.env` again.
```sh
# 4 — register (validates the compose hardening; NO deploy from the box)
sudo hosh-deploy register wordwave
# 5 — GitHub deployer key (if the agent is blocked here, the owner runs these lines with `!`)
ssh-keygen -q -t ed25519 -N '' -C hosh-deploy:wordwave -f /tmp/wordwave-deploy
sudo /home/pazka/MIGRATION/scripts/setup-hosh-deploy.sh key wordwave /tmp/wordwave-deploy.pub
gh secret set HOSH_DEPLOY_KEY -R pazka/WordWave < /tmp/wordwave-deploy && shred -u /tmp/wordwave-deploy /tmp/wordwave-deploy.pub
# ---- downtime starts (announce it if the installation is running) ----
# 6 — copy the word logs out of the legacy container, then stop it. `down`, not `stop`: the legacy
#     project is also called "wordwave" with container "wordwave", like the new one.
T=/root/wordwave-legacy-words-$(date +%F).tar
sudo bash -c "docker exec wordwave sh -c 'cd / && tar cf - *.words' > $T" && sudo tar tvf "$T" && sudo sha256sum "$T"
cd /root/hosh-deploy/wordwave && sudo docker compose down          # the tar is the only copy of the old logs now
# 7 — data move into the named volume, owned by the app uid (helper = the legacy image, already on the box)
sudo docker volume create wordwave-data
sudo bash -c "docker run --rm -i --pull never --network none -v wordwave-data:/data --entrypoint sh \
  ghcr.io/pazka/wordwave:v1.3.1 -c 'tar xf - -C /data && chown -R 10001:10001 /data && ls -ln /data' < $T"
# 8 — remove the legacy router for wordwave.hosh.it from routes.yml (coordinator). Do it BEFORE the first
#     deploy: two routers with the same Host rule make the HTTPS check of hosh-deploy hit the stopped
#     legacy upstream (127.0.0.1:9898) and roll back.
sudoedit /root/hosh-deploy/edge/traefik/dynamic/routes.yml
# 9 — first deploy = CI (writes the route wordwave.yml, runs POST_DEPLOY, rolls back by itself)
gh workflow run deploy -R pazka/WordWave -f version="$V"
```
**10 — AFTER:** §3 checks + `scripts/smoke.sh all` (add `svc_wordwave` → 127.0.0.1:9140, host in
`TLS_HOSTS`), `sudo docker run --rm -v wordwave-data:/data:ro --entrypoint ls ghcr.io/pazka/wordwave:$V -ln /data`
(the old logs + one new one), commit the route in `/root/hosh-deploy`, port registry 9140 → `live`,
9898 → free. Keep the tar until the owner says otherwise.

Compose may warn that volume `wordwave-data` "already exists but was not created by Docker Compose": expected
(step 7), harmless.

**Rollback (back to legacy):** `cd /srv/wordwave && sudo docker compose --env-file wordwave.env down`
(keeps the volume) → `sudo rm /root/hosh-deploy/edge/traefik/dynamic/wordwave.yml` → restore the legacy router
(`sudo git -C /root/hosh-deploy checkout -- edge/traefik/dynamic/routes.yml`) → `cd /root/hosh-deploy/wordwave &&
sudo docker compose up -d` (image tag of the legacy compose, unchanged). The legacy container starts with a new
empty log (as after any restart); the old logs stay in the tar and in `wordwave-data`, untouched. To unbind
GitHub: `sudo .../setup-hosh-deploy.sh unkey wordwave` + `/etc/hosh-deploy/apps/wordwave.conf`.

## 1. How releases go live (hosh-deploy, after the cutover)

Every final release (tag `vX.Y.Z` without `-`) ends with the **`deploy`** job (`deploy.yml`): GitHub connects
to the box as `deployer` with this repo's `HOSH_DEPLOY_KEY` (bound to wordwave only) and runs
`hosh-deploy deploy wordwave vX.Y.Z`. The box pulls the image, swaps the tag in `wordwave.env`, waits healthy,
checks `/healthz` on 127.0.0.1:9140 and through Traefik, runs `POST_DEPLOY` inside the container
(`python /selfcheck.py http://127.0.0.1:8000`: read-only, never posts words) and **rolls back by itself** if
any check fails. **Until `HOSH_DEPLOY_KEY` exists the job only prints a notice**: releases then just build and
push `:vX.Y.Z`, `:<sha>` and `:latest` as before (legacy box). Prerelease tags (`v1.4.0-rc.1`) never move
`:latest` and never deploy.

- Redeploy / roll back: Actions → **deploy** → `vX.Y.Z`, `rollback` or `status`; on the box
  `sudo hosh-deploy deploy|rollback|status wordwave …` (no sudo window needed). Log: `/var/log/hosh-deploy.log`.
- Repo variable `HOSH_AUTODEPLOY=false` stops auto-deploy after releases.
- A compose change (docker-compose.example.yml) needs a checkout of the new tag in `/srv/wordwave` and a new
  `hosh-deploy register wordwave` in a sudo window.

## 2. Variables (`wordwave.env`, mode 600)

| Variable | Default | Who | Meaning |
|---|---|---|---|
| `WORDWAVE_IMAGE` | `ghcr.io/pazka/wordwave:v1.4.0` | hosh-deploy | image tag (the only line it rewrites) |
| `WORDWAVE_BIND` | `127.0.0.1:9140` | — | loopback publish (must equal `BIND` of `deploy/hosh-deploy.conf`) |
| `LOGIN`, `MDP` | — (required) | owner | admin Basic auth on the write routes (admin UI) |
| `SECRET` | — (required) | owner | Flask `SECRET_KEY`; compose passes it as `secret` |

Set by the compose file, not the env file: `PORT=8000`, `DATA_DIR=/data`. Image defaults (legacy compose):
`PORT=80`, `DATA_DIR` unset = word logs next to the code in `/`. Without `LOGIN`/`MDP`/`secret` the server
refuses to start.

## 3. Capability checks (what "works" means — not just a 200)

Read-only; never `POST /words` on the live site (it reaches the installation's word cloud).
- `GET https://wordwave.hosh.it/healthz` → 200 `{"status":"ok","checks":{"word_log":true,"web_builds":true},"words":N}`.
- `GET /data.html` → 200 HTML with `<script` (the installation); `GET /admin.html` → 200 with `id="root"`.
- `GET /info` → `WordWave COM Server V… on env production`.
- Socket.IO: `GET /socket.io/?EIO=4&transport=polling` with `Origin: https://wordwave.hosh.it` → 200 `0{"sid":…`;
  with `Origin: https://evil.example` → 400 `Not an accepted origin`; websocket upgrade
  (`/socket.io/?EIO=4&transport=websocket`, `Upgrade: websocket`) through Traefik → `101`.
- REST CORS: `GET /words/current` with `Origin: https://alessiasanna.fr` → `Access-Control-Allow-Origin` echoed.
- `POST /login` without credentials → 401 `Unauthorized Access`.
- In the container: `sudo docker exec wordwave python /selfcheck.py http://127.0.0.1:8000` → `SELFCHECK OK`
  (= POST_DEPLOY: also logs in with the configured credentials and joins the Socket.IO namespace).
- Data: the `*.words` files in `wordwave-data` are still there after a deploy (count/size never shrink).

## 4. What runs

| Item | Value |
|---|---|
| Image | `ghcr.io/pazka/wordwave:vX.Y.Z` (Python 3.14 / Flask 3 + Flask-SocketIO; Node only in build stages) |
| Upstream | container :8000 → `127.0.0.1:9140` |
| Edge | `/root/hosh-deploy/edge/traefik/dynamic/wordwave.yml` (router `wordwave@file`, resolver `le`, HSTS) |
| Volume | `wordwave-data` → `/data` (in the monthly restic golden backup) |
| Health | `GET /healthz`; image `HEALTHCHECK` uses `$PORT` |
| Outbound | none |

## 5. Decisions / known limits

- Backward compatible on purpose: the image's default user stays root and the defaults stay port 80 / logs
  in `/`, so the legacy compose keeps working until the cutover. The hosh-deploy compose sets everything
  through `user:`, `PORT`, `DATA_DIR`.
- Known bugs kept (TESTING.md): a restart starts a new empty word log and counts restart from zero (the old
  logs are kept, not replayed); Werkzeug serves production; `wrap_errors` returns tracebacks.
- Word logs are the artwork's record: never delete `wordwave-data` or the cutover tar.
