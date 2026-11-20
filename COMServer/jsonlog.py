"""Logging standard of the hosh.it services (pazka/hosh-management AGENTS.md section 11). Standard library only.

One JSON object per line on stdout: ts (UTC, ms), level, service, version (release tag, APP_VERSION), event, msg,
then the line's fields. LOG_LEVEL (else APP_LOG_LEVEL) sets the level, default info.

What the server writes at info: one `startup` line and one `shutdown` line. Requests are not logged one by one
(Traefik has them): a status >= 500 is one `request_failed` error line, a 4xx on an auth route one `auth_failed`
warn line, anything slower than 1 s one `request_slow` warn line, the rest (and /healthz) only at debug. An error
caught by `wrap_errors` (the client still gets its error body, as before) is one `route_error` error line.

Never logged: the words people send (request bodies), credentials, cookies, IPs, raw paths or query strings.
"""
import datetime
import json
import logging
import os
import re
import sys
import threading
import time
import traceback
import uuid

SERVICE = "wordwave"
LEVELS = {"debug": 10, "info": 20, "warn": 30, "error": 40}
SLOW_MS = 1000
AUTH_ROUTES = ("/login", "/words", "/words/exclude", "/reload")
# The configuration names the startup line may list (only when they are set, never their value).
CONFIG_NAMES = ("PORT", "DATA_DIR", "LOGIN", "MDP", "secret", "LOG_LEVEL", "APP_LOG_LEVEL", "APP_VERSION")
_REQ_ID = re.compile(r"^[A-Za-z0-9._:-]{1,64}$")


def level_from_env(env=None):
    env = os.environ if env is None else env
    value = (env.get("LOG_LEVEL") or env.get("APP_LOG_LEVEL") or "info").strip().lower()
    return value if value in LEVELS else "info"


def config_names_set(env=None):
    env = os.environ if env is None else env
    return [name for name in CONFIG_NAMES if env.get(name)]


def utc_ts(now=None):
    now = datetime.datetime.now(datetime.timezone.utc) if now is None else now
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (now.microsecond // 1000)


class Logger:
    def __init__(self, stream=None, level=None, version=None):
        self.stream = stream            # None = sys.stdout at write time
        self.level = level or level_from_env()
        self.version = version or os.environ.get("APP_VERSION") or "dev"
        self._lock = threading.Lock()

    def enabled(self, level):
        return LEVELS[level] >= LEVELS[self.level]

    def log(self, level, event, msg, **fields):
        if not self.enabled(level):
            return
        line = {"ts": utc_ts(), "level": level, "service": SERVICE, "version": self.version,
                "event": event, "msg": msg}
        line.update(fields)
        text = json.dumps(line, ensure_ascii=False, default=str)
        with self._lock:
            out = self.stream or sys.stdout
            out.write(text + "\n")
            out.flush()

    def debug(self, event, msg, **fields):
        self.log("debug", event, msg, **fields)

    def info(self, event, msg, **fields):
        self.log("info", event, msg, **fields)

    def warn(self, event, msg, **fields):
        self.log("warn", event, msg, **fields)

    def error(self, event, msg, **fields):
        self.log("error", event, msg, **fields)


LOG = Logger()


def err_field(e, hide=()):
    """The `err` field of an error line: type, message, stack. Every string of `hide` (credentials, the request
    body...) is replaced by <hidden> in the message and the stack."""
    secrets = sorted({h for h in hide if isinstance(h, str) and len(h) > 1}, key=len, reverse=True)

    def clean(text):
        for h in secrets:
            text = text.replace(h, "<hidden>")
        return text

    kind = type(e).__name__
    message = clean(str(e))
    frames = [clean(f.rstrip("\n")) for f in traceback.format_tb(e.__traceback__)] if e.__traceback__ else []
    return {"type": kind, "message": message, "stack": "\n".join([f"{kind}: {message}"] + frames)}


def request_id(incoming):
    """X-Request-Id kept when it is a plain token of at most 64 characters, generated otherwise."""
    return incoming if incoming and _REQ_ID.match(incoming) else uuid.uuid4().hex


class _JsonHandler(logging.Handler):
    """Werkzeug's own errors (its server, outside a request of the app) as standard error lines, without the
    message text (it can hold a raw path or an address)."""

    def __init__(self, logger):
        super().__init__(level=logging.ERROR)
        self.logger = logger

    def emit(self, record):
        fields = {}
        if record.exc_info and record.exc_info[1] is not None:
            fields["err"] = err_field(record.exc_info[1])
        self.logger.error("server_error", "web server error", **fields)


def install(app, logger=None, hide=lambda: ()):
    """Request ids and the request lines on a Flask app; silences Werkzeug's access log and Flask's own
    exception print (they are replaced by the request_failed line). `hide` gives the strings to hide in errors."""
    from flask import g, got_request_exception, request

    logger = logger or LOG
    werkzeug = logging.getLogger("werkzeug")
    werkzeug.setLevel(logging.ERROR)
    werkzeug.handlers = [_JsonHandler(logger)]
    werkzeug.propagate = False
    app.logger.handlers = [logging.NullHandler()]
    app.logger.propagate = False

    @app.before_request
    def _start():
        g.log_t0 = time.monotonic()
        g.log_req_id = request_id(request.headers.get("X-Request-Id"))

    def _remember(sender, exception, **extra):
        g.log_exc = exception

    got_request_exception.connect(_remember, app, weak=False)

    @app.after_request
    def _line(response):
        req_id = g.get("log_req_id") or request_id(None)
        response.headers["X-Request-Id"] = req_id
        t0 = g.get("log_t0")
        route = request.url_rule.rule if request.url_rule is not None else "<unmatched>"
        fields = {"req_id": req_id, "method": request.method, "route": route, "status": response.status_code,
                  "dur_ms": round((time.monotonic() - t0) * 1000, 1) if t0 is not None else 0}
        if response.status_code >= 500:
            exc = g.get("log_exc")
            if exc is not None:
                fields["err"] = err_field(exc, current_hide())
            logger.error("request_failed", "server error", **fields)
        elif 400 <= response.status_code < 500 and route in AUTH_ROUTES:
            logger.warn("auth_failed", "refused", **fields)
        elif fields["dur_ms"] > SLOW_MS:
            logger.warn("request_slow", "slow request", **fields)
        elif route == "/healthz":
            logger.debug("healthz", "health check", **fields)
        else:
            logger.debug("request", "request", **fields)
        return response

    def current_hide():
        words = list(hide())
        try:
            words.append(request.get_data(as_text=True))
        except Exception:  # an unreadable body: nothing more to hide
            pass
        return words

    app.extensions["hosh_log_hide"] = current_hide
    return logger


def request_fields():
    """req_id, method and route of the current request (for lines written inside a request)."""
    from flask import g, has_request_context, request
    if not has_request_context():
        return {}
    return {"req_id": g.get("log_req_id") or "", "method": request.method,
            "route": request.url_rule.rule if request.url_rule is not None else "<unmatched>"}
