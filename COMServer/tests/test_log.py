"""Logging standard (pazka/hosh-management AGENTS.md section 11), see TESTING.md "Logs". Standard library only.

Unit tests of jsonlog.py, the request lines on a Flask app, and the real server (app.py in a subprocess, the
production config shape): startup line, auth failure, an error caught by wrap_errors, request ids, and the
shutdown line on SIGTERM / SIGINT. Run from COMServer/:  python -m unittest discover -s tests -v
"""
import base64
import io
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request

SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SERVER_DIR)

import jsonlog  # noqa: E402

HEAD = ["ts", "level", "service", "version", "event", "msg"]
TS = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$")


def lines_of(text):
    return [json.loads(l) for l in text.splitlines() if l.strip()]


class LoggerTest(unittest.TestCase):
    def test_one_json_object_per_line_with_the_standard_fields_first(self):
        out = io.StringIO()
        log = jsonlog.Logger(stream=out, level="info", version="v1.2.3")
        log.info("startup", "hello", port=8000)
        log.error("thing_failed", "bad", status=500)
        rows = lines_of(out.getvalue())
        self.assertEqual(len(out.getvalue().splitlines()), 2)
        self.assertEqual(list(rows[0]), HEAD + ["port"])
        self.assertRegex(rows[0]["ts"], TS)
        self.assertEqual(rows[0], {"ts": rows[0]["ts"], "level": "info", "service": "wordwave", "version": "v1.2.3",
                                   "event": "startup", "msg": "hello", "port": 8000})
        self.assertEqual([rows[1]["level"], rows[1]["event"], rows[1]["status"]], ["error", "thing_failed", 500])

    def test_level_filter_and_env(self):
        out = io.StringIO()
        log = jsonlog.Logger(stream=out, level="warn", version="x")
        log.debug("a", "a")
        log.info("b", "b")
        log.warn("c", "c")
        log.error("d", "d")
        self.assertEqual([r["event"] for r in lines_of(out.getvalue())], ["c", "d"])
        self.assertEqual(jsonlog.level_from_env({}), "info")
        self.assertEqual(jsonlog.level_from_env({"LOG_LEVEL": "DEBUG"}), "debug")
        self.assertEqual(jsonlog.level_from_env({"APP_LOG_LEVEL": "error"}), "error")
        self.assertEqual(jsonlog.level_from_env({"LOG_LEVEL": "warn", "APP_LOG_LEVEL": "debug"}), "warn")
        self.assertEqual(jsonlog.level_from_env({"LOG_LEVEL": "loud"}), "info")
        self.assertEqual(jsonlog.Logger(stream=io.StringIO()).version, os.environ.get("APP_VERSION") or "dev")

    def test_config_names_never_values(self):
        env = {"PORT": "8000", "MDP": "pw-secret", "LOGIN": "", "secret": "s3", "OTHER": "x"}
        self.assertEqual(jsonlog.config_names_set(env), ["PORT", "MDP", "secret"])

    def test_err_field_hides_words_and_has_frames(self):
        def boom():
            raise ValueError("bad password pw-secret for body Bonjour les chats")
        try:
            boom()
        except ValueError as e:
            err = jsonlog.err_field(e, ["pw-secret", "Bonjour les chats", "", "x"])
        self.assertEqual(list(err), ["type", "message", "stack"])
        self.assertEqual(err["type"], "ValueError")
        self.assertEqual(err["message"], "bad password <hidden> for body <hidden>")
        self.assertTrue(err["stack"].startswith("ValueError: bad password <hidden> for body <hidden>\n"))
        self.assertIn("in boom", err["stack"])
        self.assertNotIn("Traceback", err["stack"])     # the smokes fail on a raw Python traceback
        self.assertNotIn("pw-secret", json.dumps(err))

    def test_request_id(self):
        self.assertEqual(jsonlog.request_id("abc-123_x.y"), "abc-123_x.y")
        for bad in (None, "", "a" * 65, "has space", "x\ny", "<script>"):
            rid = jsonlog.request_id(bad)
            self.assertRegex(rid, r"^[0-9a-f]{32}$", bad)


class RequestLinesTest(unittest.TestCase):
    """jsonlog.install on a small Flask app: the rules of the request lines, with a 500 that has an err."""

    def setUp(self):
        from flask import Flask
        self.out = io.StringIO()
        self.log = jsonlog.Logger(stream=self.out, level="info", version="v0")
        app = Flask("t")
        jsonlog.install(app, logger=self.log, hide=lambda: ["pw-secret"])

        @app.route("/boom/<name>")
        def boom(name):
            raise RuntimeError(f"cannot read {name} with pw-secret")

        @app.route("/login", methods=["POST"])
        def login():
            return "Unauthorized Access", 401

        @app.route("/slow")
        def slow():
            time.sleep(1.05)
            return "ok"

        @app.route("/healthz")
        def healthz():
            return {"status": "ok"}

        @app.route("/missing")
        def missing():
            return "no", 404

        self.client = app.test_client()

    def rows(self):
        return lines_of(self.out.getvalue())

    def test_500_is_one_request_failed_line_with_err_without_path_body_or_secret(self):
        r = self.client.get("/boom/private-name?q=secret-query", data="the body text", headers={"X-Request-Id": "rid-1"})
        self.assertEqual(r.status_code, 500)
        self.assertEqual(r.headers["X-Request-Id"], "rid-1")
        rows = self.rows()
        self.assertEqual(len(rows), 1, self.out.getvalue())
        e = rows[0]
        self.assertEqual(list(e), HEAD + ["req_id", "method", "route", "status", "dur_ms", "err"])
        self.assertEqual([e["level"], e["event"], e["req_id"], e["method"], e["route"], e["status"]],
                         ["error", "request_failed", "rid-1", "GET", "/boom/<name>", 500])
        self.assertIsInstance(e["dur_ms"], (int, float))
        self.assertEqual(e["err"]["type"], "RuntimeError")
        self.assertEqual(e["err"]["message"], "cannot read private-name with <hidden>")
        text = json.dumps(e)
        for s in ("pw-secret", "secret-query", "the body text", "127.0.0.1"):
            self.assertNotIn(s, text)

    def test_auth_4xx_warn_slow_warn_others_silent_at_info(self):
        self.client.post("/login", data="user:pass")
        self.client.get("/healthz")
        self.client.get("/missing")
        self.client.get("/nowhere")
        self.client.get("/slow")
        rows = self.rows()
        self.assertEqual([(r["level"], r["event"], r["route"], r["status"]) for r in rows],
                         [("warn", "auth_failed", "/login", 401), ("warn", "request_slow", "/slow", 200)])
        self.assertGreater(rows[1]["dur_ms"], 1000)
        self.assertNotIn("user:pass", self.out.getvalue())

    def test_debug_level_logs_every_request_by_route(self):
        self.log.level = "debug"
        self.client.get("/healthz")
        self.client.get("/nowhere?x=1")
        rows = self.rows()
        self.assertEqual([(r["level"], r["event"], r["route"]) for r in rows],
                         [("debug", "healthz", "/healthz"), ("debug", "request", "<unmatched>")])
        self.assertNotIn("x=1", self.out.getvalue())

    def test_request_id_generated_when_missing_or_unsafe(self):
        for headers in ({}, {"X-Request-Id": "bad id with spaces"}):
            r = self.client.get("/healthz", headers=headers)
            self.assertRegex(r.headers["X-Request-Id"], r"^[0-9a-f]{32}$")


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class RealServerTest(unittest.TestCase):
    """app.py with the production config shape (credentials from the environment, wrap_errors on)."""

    LOGIN, MDP, SECRET = "log-user", "log-password-not-secret", "log-session-secret"

    def start(self, extra_env=None):
        self.dir = tempfile.mkdtemp(prefix="wordwave-log-")
        for name in os.listdir(SERVER_DIR):
            src = os.path.join(SERVER_DIR, name)
            if name.endswith(".py") or name in ("version", "dictionnaries", "DTO"):
                (shutil.copytree if os.path.isdir(src) else shutil.copy)(src, os.path.join(self.dir, name))
        shutil.copy(os.path.join(SERVER_DIR, "config.prod.json"), os.path.join(self.dir, "config.json"))
        os.makedirs(os.path.join(self.dir, "static"))
        for page in ("data.html", "admin.html"):
            with open(os.path.join(self.dir, "static", page), "w") as f:
                f.write("<html></html>")
        self.data = os.path.join(self.dir, "data")
        os.makedirs(self.data)
        self.port = free_port()
        env = {k: v for k, v in os.environ.items() if k not in ("LOG_LEVEL", "APP_LOG_LEVEL", "APP_VERSION")}
        env.update({"PORT": str(self.port), "DATA_DIR": self.data, "LOGIN": self.LOGIN, "MDP": self.MDP,
                    "secret": self.SECRET, "APP_VERSION": "v9.8.7", "PYTHONUNBUFFERED": "1"})
        env.update(extra_env or {})
        self.out_path = os.path.join(self.dir, "stdout")
        self.err_path = os.path.join(self.dir, "stderr")
        self.out_f, self.err_f = open(self.out_path, "w"), open(self.err_path, "w")
        self.proc = subprocess.Popen([sys.executable, "app.py"], cwd=self.dir, env=env,
                                     stdout=self.out_f, stderr=self.err_f)
        self.base = f"http://127.0.0.1:{self.port}"
        until = time.time() + 20
        while True:
            try:
                urllib.request.urlopen(self.base + "/healthz", timeout=2).read()
                break
            except Exception:
                if time.time() > until or self.proc.poll() is not None:
                    self.fail("server did not start:\n" + self.stdout() + self.stderr())
                time.sleep(0.1)

    def tearDown(self):
        if getattr(self, "proc", None) and self.proc.poll() is None:
            self.proc.kill()
            self.proc.wait()
        for f in ("out_f", "err_f"):
            if getattr(self, f, None):
                getattr(self, f).close()
        if getattr(self, "dir", None):
            shutil.rmtree(self.dir, ignore_errors=True)

    def stdout(self):
        with open(self.out_path) as f:
            return f.read()

    def stderr(self):
        with open(self.err_path) as f:
            return f.read()

    def rows(self):
        return lines_of(self.stdout())

    def call(self, method, path, body=None, headers=None, auth=None):
        h = dict(headers or {})
        if auth:
            h["Authorization"] = "Basic " + base64.b64encode(auth.encode()).decode()
        req = urllib.request.Request(self.base + path, data=body, method=method, headers=h)
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                return r.status, r.headers, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.headers, e.read()

    def test_startup_auth_route_error_request_id_and_shutdown(self):
        self.start()
        good = f"{self.LOGIN}:{self.MDP}"

        starts = [r for r in self.rows() if r["event"] == "startup"]
        self.assertEqual(len(starts), 1, self.stdout())
        s = starts[0]
        self.assertEqual(list(s), HEAD + ["port", "data_dir_writable", "word_log", "web_builds", "log_level", "config"])
        self.assertRegex(s["ts"], TS)
        self.assertEqual(s, {"ts": s["ts"], "level": "info", "service": "wordwave", "version": "v9.8.7",
                             "event": "startup", "msg": f"REST/SOCKET listening to port : {self.port}",
                             "port": self.port, "data_dir_writable": True, "word_log": True, "web_builds": True,
                             "log_level": "info", "config": ["PORT", "DATA_DIR", "LOGIN", "MDP", "secret", "APP_VERSION"]})

        # a wrong password: 401 as before, one auth_failed warn line without the credentials
        status, headers, body = self.call("POST", "/login", auth=f"{self.LOGIN}:wrong-pass", headers={"X-Request-Id": "rid-auth"})
        self.assertEqual((status, body), (401, b"Unauthorized Access"))
        self.assertEqual(headers["X-Request-Id"], "rid-auth")

        # an error caught by wrap_errors (a body that is not UTF-8): the client gets the same error body as before
        # (200 + error/trace keys), the log gets one route_error line with err and without the body
        status, headers, body = self.call("POST", "/words", body=b"\xffBonjour-private-words", auth=good,
                                          headers={"X-Request-Id": "rid-err", "Content-Type": "text/plain"})
        self.assertEqual(status, 200)
        self.assertEqual(set(json.loads(body)), {"error", "trace", "server_message"})
        self.assertIn("UnicodeDecodeError", json.loads(body)["error"])

        # an ordinary word post and the open data: nothing at info
        status, headers, body = self.call("POST", "/words", body="Bonjour les chats".encode(), auth=good)
        self.assertEqual(status, 200)
        status, headers, _ = self.call("GET", "/words/current?x=private-query")
        self.assertEqual(status, 200)
        self.assertRegex(headers["X-Request-Id"], r"^[0-9a-f]{32}$")
        time.sleep(0.2)

        rows = self.rows()
        self.assertEqual([r["event"] for r in rows], ["startup", "auth_failed", "route_error"], self.stdout())
        a = rows[1]
        self.assertEqual(list(a), HEAD + ["req_id", "method", "route", "status", "dur_ms"])
        self.assertEqual([a["level"], a["req_id"], a["method"], a["route"], a["status"]],
                         ["warn", "rid-auth", "POST", "/login", 401])
        e = rows[2]
        self.assertEqual(list(e), HEAD + ["req_id", "method", "route", "err"])
        self.assertEqual([e["level"], e["req_id"], e["method"], e["route"]], ["error", "rid-err", "POST", "/words"])
        self.assertEqual(list(e["err"]), ["type", "message", "stack"])
        self.assertEqual(e["err"]["type"], "UnicodeDecodeError")
        self.assertTrue(e["err"]["stack"].startswith("UnicodeDecodeError: "))

        self.proc.send_signal(signal.SIGTERM)
        self.assertEqual(self.proc.wait(timeout=5), 0)
        rows = self.rows()
        self.assertEqual(rows[-1]["event"], "shutdown")
        self.assertEqual([rows[-1]["level"], rows[-1]["signal"]], ["info", "SIGTERM"])

        out = self.stdout()
        for s in (self.MDP, self.SECRET, "wrong-pass", "Bonjour", "private-words", "private-query", "127.0.0.1",
                  self.data, "Traceback", "\033["):
            self.assertNotIn(s, out, s)
        for line in out.splitlines():
            self.assertEqual(list(json.loads(line))[:6], HEAD, line)
        self.assertNotIn("Traceback", self.stderr())
        self.assertNotIn("127.0.0.1", self.stderr())     # no Werkzeug access log
        self.assertNotIn("POST /", self.stderr())

    def test_sigint_and_debug_level(self):
        self.start({"APP_LOG_LEVEL": "debug"})
        self.call("GET", "/healthz")
        self.call("GET", "/words/current/count")
        time.sleep(0.2)
        self.proc.send_signal(signal.SIGINT)
        self.assertEqual(self.proc.wait(timeout=5), 0)
        rows = self.rows()
        self.assertEqual(rows[0]["log_level"], "debug")
        self.assertIn("APP_LOG_LEVEL", rows[0]["config"])
        self.assertIn(("debug", "healthz", "/healthz"), [(r["level"], r["event"], r.get("route")) for r in rows])
        self.assertIn(("debug", "request", "/words/current/count"), [(r["level"], r["event"], r.get("route")) for r in rows])
        self.assertEqual([rows[-1]["event"], rows[-1]["signal"]], ["shutdown", "SIGINT"])


if __name__ == "__main__":
    unittest.main()
