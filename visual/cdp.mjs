// Minimal Chrome DevTools Protocol client: Node built-ins only (fetch, WebSocket, child_process).
// Same approach as pazka/hosh-hub tools/interact.mjs and pazka/DrawTogether visual/cdp.mjs: no package is
// installed for the visual harness.
//
// WordWave specifics: both fronts pick their server from the page URL (WordWaveWeb/src/app/env.ts,
// Speech2TextWeb/src/services/env.js): a host with "localhost" or "127.0.0" means the DEV server
// http://localhost:9123, anything else means https://wordwave.hosh.it/. And the image only accepts the origins
// of config.prod.json (Socket.IO and REST CORS). So the pages are opened at their real production URL,
// https://wordwave.hosh.it/..., and every request to that origin is answered by the container under test:
// the Fetch domain pauses it inside Chrome, this file replays it on http://<app> (same method, headers,
// body, Origin) and fulfils it with the container's answer. Nothing goes to the network: every host name
// resolves to nothing (RESOLVER_RULES), so the Socket.IO websocket upgrade fails and the client stays on
// long polling (which goes through the proxy).
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

export const ORIGIN = "https://wordwave.hosh.it";
export const RESOLVER_RULES = "MAP * ~NOTFOUND";

// request headers Chrome reports that must not be replayed as such (fetch computes them)
const DROP_REQ = new Set(["host", "content-length", "connection", "accept-encoding", "keep-alive", "transfer-encoding"]);
// response headers that no longer describe the body handed back to Chrome
const DROP_RES = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"]);

/**
 * Starts headless Chrome ($CHROME or google-chrome) and returns { page(), close(), version }.
 * cdpPort: use a Chrome already started with --remote-debugging-port=<cdpPort> (visual/run.sh).
 * mouse: the visitor has a mouse (hover: hover, pointer: fine); headless Chrome says "none" otherwise.
 */
export async function launch({ mouse = false, cdpPort = 0 } = {}) {
  if (cdpPort) return connect(cdpPort, null, null);
  const profile = mkdtempSync(join(tmpdir(), "ww-visual-"));
  const chrome = spawn(process.env.CHROME || "google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--mute-audio", "--no-first-run",
    "--hide-scrollbars", "--force-color-profile=srgb", "--font-render-hinting=none",
    "--disable-features=Translate,MediaRouter", "--disable-background-networking", "--lang=en-US",
    ...(mouse ? ["--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4"] : []),
    `--host-resolver-rules=${RESOLVER_RULES}`,
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  chrome.stderr.on("data", (d) => { stderr = (stderr + d).slice(-4000); });
  let port;
  for (let i = 0; i < 300 && !port; i++) {
    try { port = Number(readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]); }
    catch { await sleep(100); }
  }
  if (!port) {
    chrome.kill();
    throw new Error(`Chrome did not start in 30 s (set CHROME=/path/to/chrome)\n${stderr}`);
  }
  return connect(port, chrome, profile);
}

async function connect(port, chrome, profile) {
  let info;
  for (let i = 0; i < 300 && !info; i++) {
    try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); }
    catch { await sleep(100); }
  }
  if (!info) throw new Error(`no Chrome DevTools endpoint on 127.0.0.1:${port}`);
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const { res, rej } = pending.get(d.id);
      pending.delete(d.id);
      d.error ? rej(new Error(`${d.error.message}`)) : res(d.result);
    } else for (const l of listeners) l(d);
  };
  const raw = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  /**
   * A new tab in its own browser context (own cookies = a fresh visitor).
   * app: http://127.0.0.1:<port> of the container; every request to ORIGIN is answered by it.
   * init: a script run in every document before the page's own scripts (visual/cases.mjs FREEZE_JS).
   */
  async function page({ app, init } = {}) {
    const { browserContextId } = await raw("Target.createBrowserContext", { disposeOnDetach: true });
    const { targetId } = await raw("Target.createTarget", { url: "about:blank", browserContextId });
    const { sessionId } = await raw("Target.attachToTarget", { targetId, flatten: true });
    const send = (method, params) => raw(method, params, sessionId);
    const errors = [];
    const requests = []; // "<method> <path> -> <status>" of every proxied request (report.json, debugging)
    let closed = false;
    const proxy = async (p) => {
      const u = new URL(p.request.url);
      const headers = {};
      for (const [k, v] of Object.entries(p.request.headers || {})) if (!DROP_REQ.has(k.toLowerCase())) headers[k] = v;
      let body;
      if (p.request.postDataEntries?.length) {
        body = Buffer.concat(p.request.postDataEntries.map((e) => Buffer.from(e.bytes || "", "base64")));
      } else if (p.request.postData !== undefined) body = p.request.postData;
      try {
        const r = await fetch(app + u.pathname + u.search, { method: p.request.method, headers, body, redirect: "manual" });
        const buf = Buffer.from(await r.arrayBuffer());
        const responseHeaders = [];
        for (const [name, value] of r.headers) if (!DROP_RES.has(name)) responseHeaders.push({ name, value });
        requests.push(`${p.request.method} ${u.pathname} -> ${r.status}`);
        if (!closed) await send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: r.status, responseHeaders, body: buf.toString("base64") });
      } catch (e) {
        requests.push(`${p.request.method} ${u.pathname} -> proxy error ${e.message}`);
        if (!closed) await send("Fetch.failRequest", { requestId: p.requestId, errorReason: "ConnectionFailed" }).catch(() => {});
      }
    };
    listeners.add((d) => {
      if (d.sessionId !== sessionId) return;
      if (d.method === "Fetch.requestPaused") proxy(d.params).catch(() => {});
      if (d.method === "Runtime.exceptionThrown") {
        errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
      }
      // alert() / confirm() would block the page: the visualisation alerts on a Socket.IO "error", the admin
      // alerts when a download fails and confirms a reset. Dismissed and counted as a page error (the shot fails).
      if (d.method === "Page.javascriptDialogOpening") {
        errors.push(`dialog ${d.params.type}: ${d.params.message}`);
        raw("Page.handleJavaScriptDialog", { accept: false }, sessionId).catch(() => {});
      }
    });
    await send("Page.enable");
    await send("Runtime.enable");
    if (app) await send("Fetch.enable", { patterns: [{ urlPattern: `${ORIGIN}/*`, requestStage: "Request" }] });
    if (init) await send("Page.addScriptToEvaluateOnNewDocument", { source: init });
    const evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(`evaluate failed: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
      return r.result.value;
    };
    const waitFor = async (expression, ms = 10000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        try { if (await evaluate(expression)) return true; } catch { /* navigating */ }
        await sleep(50);
      }
      return false;
    };
    const goto = async (href) => {
      await send("Page.navigate", { url: href });
      await sleep(100);
      if (!(await waitFor("document.readyState === 'complete'"))) throw new Error(`page did not load: ${href}`);
      await evaluate("document.fonts ? document.fonts.ready.then(() => true) : true");
    };
    const close = async () => { closed = true; await raw("Target.closeTarget", { targetId }).catch(() => {}); };
    return { send, evaluate, waitFor, goto, close, errors, requests };
  }

  function close() {
    try { ws.close(); } catch { /* closed */ }
    if (chrome) chrome.kill();
    if (profile) try { rmSync(profile, { recursive: true, force: true }); } catch { /* busy */ }
  }
  return { page, close, version: info.Browser };
}
