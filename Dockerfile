# ---- build stage: WordWaveWeb (three.js word cloud, webpack.prod.js) ----
# Mirrors gulp buildFront + renameFrontIndex: dist/index.html is also
# published as data.html (the URL the installation loads on the live site).
FROM node:20-alpine AS wordwave-web
WORKDIR /front
COPY WordWaveWeb/package.json WordWaveWeb/package-lock.json ./
RUN npm ci
COPY WordWaveWeb/ ./
RUN npm run build && cp dist/index.html dist/data.html

# ---- build stage: Speech2TextWeb (CRA admin UI) ----
# Mirrors gulp buildAdmin + renameAdminIndex: build/index.html is also
# published as admin.html. Reproduces the exact live bundles
# (static/js/main.4b672ae3.js, static/css/main.62b37043.css).
FROM node:20-alpine AS admin-web
WORKDIR /admin
COPY Speech2TextWeb/package.json Speech2TextWeb/package-lock.json ./
RUN npm ci
COPY Speech2TextWeb/ ./
RUN npm run build && cp build/index.html build/admin.html

# ---- runtime ----
FROM python:3.11-slim

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

ENV secret=WillBeChangedButNotCommited
ENV LOGIN=admin
ENV MDP=admin
ENV PORT=80

EXPOSE 80

CMD [ "python", "app.py" ]
