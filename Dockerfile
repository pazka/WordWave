# ---- build stage: WordWaveWeb (three.js word cloud, webpack.prod.js) ----
# Mirrors gulp buildFront + renameFrontIndex: dist/index.html is also
# published as data.html (the URL the installation loads on the live site).
FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS wordwave-web
WORKDIR /front
COPY WordWaveWeb/package.json WordWaveWeb/package-lock.json ./
RUN npm ci
COPY WordWaveWeb/ ./
RUN npm run build && cp dist/index.html dist/data.html

# ---- build stage: Speech2TextWeb (CRA admin UI) ----
# Mirrors gulp buildAdmin + renameAdminIndex: build/index.html is also
# published as admin.html. Until react-scripts 5.0.1 (2026-10) this reproduced the exact
# live bundles (main.4b672ae3.js / main.62b37043.css); the rendered admin UI is unchanged
# (see TESTING.md) and scripts/check-admin-bundle.sh guards its features.
FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS admin-web
WORKDIR /admin
COPY Speech2TextWeb/package.json Speech2TextWeb/package-lock.json ./
RUN npm ci
COPY Speech2TextWeb/ ./
RUN npm run build && cp build/index.html build/admin.html

# ---- runtime ----
FROM python:3.14-slim

WORKDIR /

COPY COMServer/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Mirror the historical gulp buildBack layout: COMServer content at image root,
# with the PROD config shipped as config.json (it reads secret/LOGIN/MDP/PORT
# from the environment at startup).
COPY COMServer/ .
COPY COMServer/config.prod.json ./config.json

# Mirror gulp copyFront/copyAdmin: both web builds overlaid into static/
# (served by Flask at /), with the CRA admin index.html winning at /index.html,
# exactly like the live deployment.
COPY --from=wordwave-web /front/dist/ ./static/
COPY --from=admin-web /admin/build/ ./static/

# No default credentials: LOGIN, MDP and secret must come from the environment (compose .env).
# Without them config.prod.json fails to resolve and the server refuses to start.
# PORT and DATA_DIR are env-driven: the defaults (port 80, word log next to the code in /) are the
# legacy box compose; the hosh-deploy compose sets PORT=8000 and DATA_DIR=/data (docker-compose.example.yml).
# The image's default user stays root for that legacy compose; hosh-deploy runs it as 10001, read-only.
# /data owned by 10001: a new named volume mounted there inherits it (unused by the legacy compose).
RUN mkdir -p /data && chown 10001:10001 /data
ENV PORT=80

EXPOSE 80

# GET /healthz = word log writable + web builds present (no curl in the image: python).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["python", "-c", "import os, sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:%s/healthz' % os.environ.get('PORT', '80'), timeout=4).status == 200 else 1)"]

CMD [ "python", "app.py" ]
