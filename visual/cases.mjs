// Visual use cases covered by the harness (ids from TESTING.md "Visual use cases").
// Each: { id, path, words?, widths?, steps?, ready?, mask?, settle?, keepFocus? }.
// - path: opened in a NEW browser context (a fresh visitor) at https://wordwave.hosh.it<path>; every request
//   to that origin is answered by the container under test (visual/cdp.mjs).
// - words: the server state before the page opens: "empty" (DELETE /words) or "seeded" (DELETE /words, then
//   POST /words SEED, as the admin's manual text input does). Set again before EVERY shot, so the shots do not
//   depend on each other or on their order.
// - steps(page, ctx): what the visitor (or the admin, through the API) does before the shot.
//   ctx = { api, auth, expected }: api() calls the container directly (fetch), auth = the Basic auth header.
// - ready: a JS expression that must become true before the shot.
//
// Determinism. The visualisation (data.html, WordWaveWeb) is NOT a WebGL canvas: three.js never reaches its
// bundle; every word is an absolutely positioned <p> placed on every animation frame from Math.random() (per
// word: id, rndX, rndY) and Date.now() (the slow rotation). FREEZE_JS, injected before the page's own
// scripts, makes both fixed: Date.now() returns 2026-01-01T00:00:00Z, and Math.random() is a seeded PRNG that
// is re-seeded (seed = 1, 2, 3... per payload) each time a word payload is parsed (the /words/current answer,
// a Socket.IO new_text). The words of a payload are created synchronously right after it is parsed, so
// they draw the same numbers on every run, whatever Socket.IO drew before. The <p> transition (1 s) and
// every CSS animation are switched off before the shot, so the picture is the final layout, not a frame in
// between. The <canvas id="three-canvas"> stays empty (nothing draws on it).
export const WIDTHS = [1400, 1024, 390];

const js = (v) => JSON.stringify(v);

// ---------- seeded data ----------
// French on purpose (the installation listens in French): stop words (dictionnaries/excluded_words_fr) are
// dropped by the server, plural folding merges "voix"/"vague(s)". Counts go from 1 to 6, so sizes and greys
// of the cloud cover the whole range. 20 distinct words (5 said 3 times or more): under START_CULLING_AFTER (200), nothing is culled.
export const SEED = [
  "La mer murmure, la mer chante. Le vent porte la voix de la mer vers la ville.",
  "Silence, silence, encore le silence. Une voix, deux voix, mille voix dans la nuit.",
  "La lumière danse sur l'eau, la lumière tremble. Mémoire de la mer, mémoire du vent.",
  "Écoute le souffle, écoute le monde. Les mots reviennent comme les vagues, vague après vague.",
  "La mer encore. Le vent encore. La voix, toujours la voix.",
].join("\n");
// posted while the page is open (V5): one known word (mer) and new ones
export const LIVE = "Un oiseau passe au-dessus de la mer, un oiseau blanc.";

// Runs in every document before its own scripts (Page.addScriptToEvaluateOnNewDocument).
export const FREEZE_JS = `(() => {
  const FIXED = 1767225600000; // 2026-01-01T00:00:00Z
  let s = 0, n = 0;
  const state = { loads: 0, updates: 0 };
  window.__wwVisual = state;
  const reseed = () => { n++; s = n * 0x9e3779b9; };
  Math.random = () => { // mulberry32
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  reseed();
  Date.now = () => FIXED;
  const isWords = (v) => !!v && typeof v === "object" && "words" in v && "meta" in v;
  const json = Response.prototype.json;
  Response.prototype.json = function () {
    return json.call(this).then((v) => { if (isWords(v)) { reseed(); state.loads++; } return v; });
  };
  const parse = JSON.parse;
  JSON.parse = function (...a) {
    const v = parse.apply(this, a);
    if (Array.isArray(v) && v[0] === "new_text" && isWords(v[1])) { reseed(); state.updates++; }
    if (Array.isArray(v) && v[0] === "reset") state.resets = (state.resets || 0) + 1;
    return v;
  };
})();`;

/** Sets the server state for a shot (see `words` above) and returns /words/current. */
export async function setWords(api, auth, words) {
  const ok = async (r, what) => { if (!r.ok) throw new Error(`seed: ${what} -> HTTP ${r.status} ${await r.text()}`); return r; };
  await ok(await fetch(`${api}/words`, { method: "DELETE", headers: { Authorization: auth } }), "DELETE /words");
  if (words === "seeded") {
    await ok(await fetch(`${api}/words`, { method: "POST", headers: { Authorization: auth, "Content-Type": "text/plain" }, body: SEED }), "POST /words");
  }
  const cur = await (await ok(await fetch(`${api}/words/current`), "GET /words/current")).json();
  const n = Object.keys(cur.words).length;
  if (words === "empty" && n !== 0) throw new Error(`seed: expected no word, got ${n}`);
  if (words === "seeded" && (n !== 20 || cur.meta.max_occ !== 6 || cur.meta.min_occ !== 1)) {
    throw new Error(`seed: unexpected state ${JSON.stringify(cur)}`);
  }
  return cur;
}

// ---------- steps ----------
async function must(p, expression, what, ms) {
  if (!(await p.waitFor(expression, ms))) throw new Error(`step failed: ${what}`);
}
async function click(p, sel, label = "") {
  await must(p, `(() => {
    const e = [...document.querySelectorAll(${js(sel)})].find((x) => x.textContent.includes(${js(label)}) && !x.disabled); // textContent: MUI upper-cases buttons in CSS
    if (!e) return false;
    e.click();
    return true;
  })()`, `click ${sel} "${label}"`);
}
/** Types into the first element matching sel (focus + Input.insertText = real key input for React). */
async function type(p, sel, text) {
  await must(p, `(() => { const e = document.querySelector(${js(sel)}); if (!e) return false; e.focus(); return true; })()`, `focus ${sel}`);
  await p.send("Input.insertText", { text });
  await must(p, `document.querySelector(${js(sel)}).value === ${js(text)}`, `typed into ${sel}`);
}
const waitRequest = (p, re, what, ms = 10000) => new Promise((res, rej) => {
  const end = Date.now() + ms;
  const tick = () => {
    if (p.requests.some((r) => re.test(r))) return res(true);
    if (Date.now() > end) return rej(new Error(`step failed: ${what} (requests: ${p.requests.join(", ")})`));
    setTimeout(tick, 50);
  };
  tick();
});
// the Socket.IO client joined the namespace (its CONNECT packet was posted): a broadcast now reaches it
const socketJoined = (p) => waitRequest(p, /^POST \/socket\.io\/ -> 200$/, "Socket.IO connected");

// the visualisation drew `n` visible words (and they have a size and a place)
const drawn = (n) => `(() => {
  const ps = [...document.querySelectorAll("body > p")].filter((e) => e.style.display !== "none");
  return ps.length === ${n} && ps.every((e) => e.style.fontSize && e.style.fontSize !== "5px" && e.offsetWidth > 0);
})()`;
const loaded = (k = 1) => `!!window.__wwVisual && window.__wwVisual.loads >= ${k}`;

// the admin page answered /info and rendered (React root filled)
const adminReady = `/^WordWave COM Server V\\S+ on env production$/.test(document.querySelector(".App .form-group p")?.innerText || "")
  && !!document.querySelector("input[name=login]") && document.body.innerText.includes("Words Download")`;
const loggedIn = `document.body.innerText.includes("Logged in !") && document.body.innerText.includes("Manual Text Input")`;
async function login(p, ctx, mdp = ctx.mdp) {
  await must(p, adminReady, "admin page");
  await type(p, "input[name=login]", ctx.login);
  await type(p, "input[name=mdp]", mdp);
  await click(p, "button", "Login");
}

export const CASES = [
  // ---------- the visualisation the installation shows (data.html) ----------
  {
    id: "V1-cloud-empty", path: "/data.html", words: "empty",
    ready: `${loaded()} && document.querySelectorAll("body > p").length === 0 && !!document.querySelector("#three-canvas")`,
  },
  { id: "V2-cloud-words", path: "/data.html", words: "seeded", ready: `${loaded()} && ${drawn(20)}` },
  {
    // ?light: white background, black words (body.light)
    id: "V3-cloud-light", path: "/data.html?light", words: "seeded",
    ready: `${loaded()} && document.body.className === "light" && ${drawn(20)}`,
  },
  {
    // ?min=3: only the words said 3 times or more
    id: "V4-cloud-min3", path: "/data.html?min=3", words: "seeded",
    ready: `${loaded()} && ${drawn(5)}`,
  },
  {
    // the admin posts a sentence while the page is open: the new words arrive by Socket.IO (new_text)
    id: "V5-cloud-live-update", path: "/data.html", words: "seeded",
    steps: async (p, ctx) => {
      await must(p, `${loaded()} && ${drawn(20)}`, "cloud drawn");
      await socketJoined(p);
      await ctx.post(LIVE);
    },
    ready: `window.__wwVisual.updates >= 1 && ${drawn(23)}`,
    settle: 600,
  },
  {
    // the admin clicks "Reset visual" (DELETE /words): every open page reloads its words and empties
    id: "V6-cloud-after-reset", path: "/data.html", words: "seeded",
    steps: async (p, ctx) => {
      await must(p, `${loaded()} && ${drawn(20)}`, "cloud drawn");
      await socketJoined(p);
      await ctx.reset();
    },
    ready: `window.__wwVisual.resets >= 1 && ${loaded(2)} && ${drawn(0)} && document.querySelectorAll("body > p").length === 20`,
    settle: 600,
  },

  // ---------- the admin (Speech2TextWeb, admin.html) ----------
  { id: "A1-admin-logged-out", path: "/admin.html", words: "empty", ready: adminReady },
  {
    // wrong password: /login answers 401, the form stays (nothing else tells the admin)
    id: "A2-admin-wrong-password", path: "/admin.html", words: "empty",
    steps: async (p, ctx) => {
      await login(p, ctx, "not-the-password");
      await waitRequest(p, /^POST \/\/login -> 401$/, "POST /login refused");
    },
    ready: `!document.body.innerText.includes("Logged in !") && document.querySelector("input[name=mdp]")?.value === "not-the-password"`,
  },
  {
    // logged in: client visuals, speech recognition control, manual text, exclude words, results
    id: "A3-admin-logged-in", path: "/admin.html", words: "empty",
    steps: async (p, ctx) => login(p, ctx),
    ready: `${loggedIn} && document.body.innerText.includes("Speech Recognition Control")`,
  },
  {
    // manual text sent: the server's registered text (stop words dropped) appears under "Server Result"
    id: "A4-admin-text-sent", path: "/admin.html", words: "empty",
    steps: async (p, ctx) => {
      await login(p, ctx);
      await must(p, loggedIn, "logged in");
      await type(p, "textarea:not([readonly]):not([aria-hidden])", LIVE);
      await click(p, "button", "Submit Manuel Text");
      await waitRequest(p, /^POST \/\/words -> 200$/, "POST /words");
    },
    ready: `document.body.innerText.includes("oiseau passe mer oiseau blanc")
      && document.querySelector("textarea:not([readonly]):not([aria-hidden])").value === ""`,
  },
  {
    // the language menu of the speech recognition is open
    id: "A5-admin-language-menu", path: "/admin.html", words: "empty",
    steps: async (p, ctx) => {
      await login(p, ctx);
      await must(p, loggedIn, "logged in");
      await must(p, `(() => { const e = document.querySelector("[role=combobox]"); if (!e) return false;
        e.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return true; })()`, "open the language menu");
    },
    ready: `document.querySelectorAll("[role=listbox] [role=option]").length === 3`,
    keepFocus: true,
  },
  // the same admin app is also served at /index.html (CRA index, historical layout)
  { id: "A6-index-logged-out", path: "/index.html", words: "empty", ready: adminReady },
  // the bare host: Flask's 404 page (nothing is served at /)
  {
    id: "X1-root-404", path: "/", words: "empty",
    ready: `document.title === "404 Not Found" && document.body.innerText.includes("Not Found")`,
  },
];
// Not covered (TESTING.md): the speech recognition itself (microphone; "Start Listening" turns the panel red),
// the downloads (files, not pages), "Reload visualizer in all clients" (a page reload), "Reset visual"'s confirm
// dialog, /swagger/ (third-party UI).
