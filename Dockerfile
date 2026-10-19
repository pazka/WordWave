# ---- build stage: WordWaveWeb (three.js word cloud, webpack.prod.js) ----
# Mirrors gulp buildFront + renameFrontIndex: dist/index.html is also
# published as data.html (the URL the installation loads on the live site).
FROM node:26-alpine AS wordwave-web
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
FROM node:26-alpine AS admin-web
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
ENV PORT=80

EXPOSE 80

CMD [ "python", "app.py" ]
