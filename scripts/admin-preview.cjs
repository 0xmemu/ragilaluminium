#!/usr/bin/env node
/**
 * admin-preview.cjs — Preview / verify any page of the Ragil Aluminium admin panel
 * with a real (headless) browser: logs in with the dev test account, renders the
 * target page, and reports DOM text, console errors, and an optional screenshot.
 *
 * Zero dependencies: uses Node >= 22 global fetch + WebSocket + CDP over a local
 * headless Chrome/Edge instance. Run it from any machine that has Chrome/Edge.
 *
 * Usage:
 *   node admin-preview.cjs --url=/admin/banners --mode=dump
 *   node admin-preview.cjs --url=/admin/dashboard --mode=shot --out=dash.png
 *   node admin-preview.cjs --url=/admin/promotions --find="Kelola banner,Promo" --mode=dump
 *
 * Options:
 *   --url=<path>      Target admin path (default: /admin/dashboard)
 *   --mode=<mode>     dump | shot | both (default: dump)
 *   --out=<file>      Screenshot file name (default: admin-preview.png)
 *   --wait=<ms>       Extra settle time after page load (default: 3500)
 *   --find=<a,b>      Comma-separated strings to assert present in the page text
 *   --base=<url>      Site base URL (default: env BASE_URL or https://ra.333labs.tech)
 *
 * Env overrides:
 *   TEST_EMAIL, TEST_PASSWORD  — dev test account (defaults documented in AGENTS.md)
 *   CHROME_PATH                — explicit Chrome/Edge binary
 *
 * Exit code: 0 on success, 2 if login failed, 1 on other errors.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BASE = process.env.BASE_URL || "https://ra.333labs.tech";
const TEST_EMAIL = process.env.TEST_EMAIL || "dev.agent@ragilaluminium.test";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "OiDrA_7nbIXjgX2K";

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const hit = args.find((a) => a.startsWith(name + "="));
  return hit ? hit.slice(name.length + 1) : def;
};

// Git Bash (MSYS) may mangle a leading-slash arg into C:/Program Files/Git/... — self-heal.
let TARGET = getArg("--url", "/admin/dashboard");
if (!TARGET.startsWith("/")) {
  const idx = TARGET.indexOf("/admin");
  if (idx >= 0) TARGET = TARGET.slice(idx);
  else throw new Error("--url must start with / (got: " + TARGET + ")");
}
const MODE = getArg("--mode", "dump");
const OUT = getArg("--out", "admin-preview.png");
const WAIT_MS = Number(getArg("--wait", "3500")) || 3500;
const FIND = (getArg("--find", "") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const EVAL = getArg("--eval", "");

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    `admin-preview — render & verify an admin page with a real headless browser.\n` +
      `Usage: node admin-preview.cjs --url=/admin/banners [--mode=dump|shot|both] [--out=x.png] [--wait=3500] [--find="text to find,other"]\n` +
      `Env: TEST_EMAIL, TEST_PASSWORD, BASE_URL, CHROME_PATH`
  );
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function launchChrome(chromePath) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "admin-preview-"));
  const port = 9300 + Math.floor(Math.random() * 600);
  const proc = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userData}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--window-size=1440,1400",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  return { proc, port, userData };
}

async function waitForCdp(port, timeoutMs = 25000) {
  const t0 = Date.now();
  let lastErr = null;
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch (e) {
      lastErr = e;
    }
    await sleep(300);
  }
  throw new Error("CDP not ready: " + (lastErr ? lastErr.message : "timeout"));
}

async function getPageWsUrl(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const list = await res.json();
  const page = list.find((t) => t.type === "page" && !t.url.startsWith("devtools://"));
  if (!page) throw new Error("no page target found");
  return page.webSocketDebuggerUrl;
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error("CDP websocket error"));
    });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) reject(new Error(m.error.message));
        else resolve(m.result);
      } else {
        this.events.push(m);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

async function evaluate(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    const desc =
      r.exceptionDetails.exception?.description || r.exceptionDetails.text || "eval error";
    throw new Error(String(desc).slice(0, 400));
  }
  return r.result?.value;
}

async function waitForLoad(cdp, timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const state = await evaluate(cdp, "document.readyState");
    if (state === "complete") return;
    await sleep(300);
  }
  throw new Error("page load timeout");
}

async function waitForApp(cdp, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const ready = await evaluate(
      cdp,
      `(() => { const app = document.querySelector('#app'); return !!(app && app.children.length > 0) || (document.body.innerText || '').trim().length > 80; })()`
    );
    if (ready) return;
    await sleep(400);
  }
}

const trace = (m) => { if (process.env.DEBUG) console.error("[trace] " + m); };

async function main() {
  const chromePath = findChrome();
  trace("chrome: " + chromePath);
  if (!chromePath) {
    console.error("Chrome/Edge not found. Set CHROME_PATH.");
    process.exit(1);
  }

  const { proc, port, userData } = launchChrome(chromePath);
  const consoleErrors = [];
  let cdp = null;
  try {
    trace("waiting for CDP on port " + port);
    await waitForCdp(port);
    trace("CDP ready, connecting");
    cdp = new CDP(await getPageWsUrl(port));
    await cdp.open();
    trace("connected");

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");

    // Capture JS console errors.
    const origPush = cdp.events.push.bind(cdp.events);
    cdp.events.push = (m) => {
      if (m.method === "Log.entryAdded" && m.params?.entry?.level === "error") {
        consoleErrors.push(m.params.entry.text);
      }
      if (m.method === "Runtime.exceptionThrown") {
        const d = m.params?.exceptionDetails;
        consoleErrors.push(d?.exception?.description || d?.text || "exception");
      }
      if (
        m.method === "Runtime.consoleAPICalled" &&
        m.params?.type === "error"
      ) {
        const text = (m.params.args || [])
          .map((a) => a.value ?? a.description ?? "")
          .join(" ");
        consoleErrors.push(text);
      }
      return origPush(m);
    };

    // 1. Go to login.
    trace("navigating to login");
    await cdp.send("Page.navigate", { url: BASE + "/login" });
    await waitForLoad(cdp);
    await sleep(800);

    const loginPath = await evaluate(cdp, "location.pathname");
    trace("path after login page load: " + loginPath);
    let pathAfter = loginPath;
    if (loginPath === "/login" || loginPath === "/") {
      // 2. Fill the login form with the dev test account.
      const emailExpr = JSON.stringify(TEST_EMAIL);
      const passExpr = JSON.stringify(TEST_PASSWORD);
      const fillResult = await evaluate(
        cdp,
        `(() => {
          const inputs = [...document.querySelectorAll('input')];
          const email = inputs.find(i => i.type === 'text' || i.type === 'email' || /user|email/i.test(i.name)) || inputs[0];
          const pass = inputs.find(i => i.type === 'password');
          if (!email || !pass) return 'NO_INPUTS: ' + inputs.map(i => i.type + '/' + i.name).join(',');
          const setVal = (el, val) => {
            const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          };
          setVal(email, ${emailExpr});
          setVal(pass, ${passExpr});
          return 'FILLED';
        })()`
      );
      if (fillResult !== "FILLED") {
        throw new Error("Login form not fillable: " + fillResult);
      }

      await evaluate(
        cdp,
        `(() => { const f = document.querySelector('form'); if (f) f.requestSubmit(); return !!f; })()`
      );

      // 3. Wait for redirect away from /login (max 15s).
      const t0 = Date.now();
      pathAfter = "/login";
      while (Date.now() - t0 < 15000) {
        pathAfter = await evaluate(cdp, "location.pathname");
        if (!pathAfter.startsWith("/login")) break;
        await sleep(400);
      }
      if (pathAfter.startsWith("/login")) {
        const errText = await evaluate(
          cdp,
          `(document.body.innerText || '').slice(0, 500)`
        );
        throw new Error(
          "Login failed (still on /login). Page says: " + errText.slice(0, 300)
        );
      }
    }

    trace("login OK (" + pathAfter + "), navigating to " + TARGET);
    // 4. Navigate to the target admin page.
    await cdp.send("Page.navigate", { url: BASE + TARGET });
    await waitForLoad(cdp);
    const proto = await evaluate(cdp, "location.protocol");
    if (!proto.startsWith("http")) {
      throw new Error("navigation failed (protocol=" + proto + "): page did not load");
    }
    await waitForApp(cdp);
    await sleep(WAIT_MS);

    // 5. Collect results.
    const result = await evaluate(
      cdp,
      `(() => {
        const app = document.querySelector('#app');
        return {
          url: location.href,
          title: document.title,
          appChildren: app ? app.children.length : -1,
          bodyText: (document.body.innerText || '').replace(/\\n{3,}/g, '\\n\\n').trim(),
        };
      })()`
    );

    const output = {
      url: result.url,
      title: result.title,
      appChildren: result.appChildren,
      textLength: result.bodyText.length,
      consoleErrors,
      found: {},
      missing: {},
    };
    for (const needle of FIND) {
      const ok = result.bodyText.includes(needle);
      (ok ? output.found : output.missing)[needle] = ok;
    }

    if (EVAL) {
      const ev = await evaluate(cdp, EVAL);
      console.log("=== EVAL RESULT ===");
      console.log(typeof ev === "string" ? ev : JSON.stringify(ev, null, 2));
    }

    if (MODE === "dump" || MODE === "both") {
      console.log("=== URL: " + result.url);
      console.log("=== TITLE: " + result.title);
      console.log("=== APP CHILDREN: " + result.appChildren + "  TEXT LENGTH: " + result.bodyText.length);
      if (FIND.length) {
        console.log("=== FIND: found=" + JSON.stringify(output.found) + " missing=" + JSON.stringify(output.missing));
      }
      console.log("=== BODY TEXT (first 4000 chars) ===");
      console.log(result.bodyText.slice(0, 4000));
    }

    if (MODE === "shot" || MODE === "both") {
      const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(OUT, Buffer.from(shot.data, "base64"));
      console.log(`=== SCREENSHOT: ${OUT} (${shot.data.length} bytes base64)`);
    }

    if (consoleErrors.length) {
      console.log("=== CONSOLE ERRORS (" + consoleErrors.length + ") ===");
      for (const e of consoleErrors.slice(0, 10)) console.log("- " + e.slice(0, 300));
    }

    const hasErrors = consoleErrors.length > 0;
    const missingKeys = Object.keys(output.missing);
    if (missingKeys.length) {
      console.error("MISSING TEXT: " + missingKeys.join(", "));
      process.exitCode = 2;
    } else if (hasErrors) {
      process.exitCode = 3;
    }
  } catch (e) {
    console.error("ERROR: " + e.message);
    process.exitCode = 1;
  } finally {
    if (cdp) cdp.close();
    try {
      proc.kill();
    } catch {}
    await sleep(300);
    try {
      fs.rmSync(userData, { recursive: true, force: true });
    } catch {}
  }
}

main();
