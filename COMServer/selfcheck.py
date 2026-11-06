"""Capability check of a running WordWave COM server (standard library only).

    python selfcheck.py BASE_URL            read-only: what the live installation needs
    python selfcheck.py BASE_URL --write    + a real word post received as a Socket.IO broadcast
                                            (CI only: it adds text to the live word cloud)

Read-only checks: /info answers, both web builds are served (data.html = the URL the installation
loads, admin.html = the admin UI), the open-data JSON answers, and a Socket.IO client (engine.io v4,
polling, Origin https://wordwave.hosh.it like the WordWaveWeb front) gets a session and joins the
default namespace. If LOGIN and MDP are in the environment, POST /login with them must answer 200
(no state change). /healthz is checked when it exists (404 before it was added).

--write also needs LOGIN/MDP: POST /words, then the Socket.IO client must receive the `new_text`
broadcast carrying the counted words. Prints one line per check; exit 1 on the first failure.
Secrets are never printed. It ships in the image (/selfcheck.py) so the box can run it inside the
container after a deploy (deploy/hosh-deploy.conf POST_DEPLOY).
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

ORIGIN = "https://wordwave.hosh.it"
SENTENCE = "Bonjour les chats, le chat et la maison! Maisons 42"


def fail(msg):
    print(f"FAIL {msg}")
    sys.exit(1)


def ok(msg):
    print(f"ok   {msg}")


def http(method, url, body=None, headers=None, timeout=10):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def auth_header():
    login, mdp = os.environ.get("LOGIN"), os.environ.get("MDP")
    if not login or not mdp:
        return None
    return {"Authorization": "Basic " + base64.b64encode(f"{login}:{mdp}".encode()).decode()}


class SocketIO:
    """Minimal Socket.IO v5 / engine.io v4 client over HTTP long-polling."""

    def __init__(self, base):
        self.url = base + "/socket.io/?EIO=4&transport=polling"
        status, body = http("GET", self.url, headers={"Origin": ORIGIN})
        if status != 200 or not body.startswith("0"):
            fail(f"engine.io handshake: {status} {body[:200]}")
        self.sid = json.loads(body[1:])["sid"]
        self.url += "&sid=" + self.sid
        self.send("40")  # join the default namespace
        for pkt in self.poll():
            if pkt.startswith("40"):
                return
        fail("Socket.IO namespace connect not acknowledged")

    def send(self, pkt):
        status, body = http("POST", self.url, pkt.encode(), {"Origin": ORIGIN, "Content-Type": "text/plain"})
        if status != 200:
            fail(f"engine.io POST: {status} {body[:200]}")

    def poll(self):
        status, body = http("GET", self.url, headers={"Origin": ORIGIN}, timeout=40)
        if status != 200:
            fail(f"engine.io poll: {status} {body[:200]}")
        pkts = body.split("\x1e")
        if "2" in pkts:
            self.send("3")  # answer the server ping
        return pkts

    def wait_event(self, name, seconds=30):
        end = time.time() + seconds
        while time.time() < end:
            for pkt in self.poll():
                if pkt.startswith("42"):
                    ev = json.loads(pkt[2:])
                    if ev[0] == name:
                        return ev[1] if len(ev) > 1 else None
        fail(f"no Socket.IO '{name}' event within {seconds}s")

    def close(self):
        http("POST", self.url, b"1", {"Origin": ORIGIN, "Content-Type": "text/plain"})


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    write = "--write" in sys.argv
    if len(args) != 1:
        print(__doc__)
        sys.exit(2)
    base = args[0].rstrip("/")

    status, body = http("GET", base + "/healthz")
    if status == 200:
        h = json.loads(body)
        if h.get("status") != "ok":
            fail(f"/healthz: {body[:200]}")
        ok(f"/healthz {body.strip()}")
    elif status != 404:
        fail(f"/healthz: {status} {body[:200]}")

    status, body = http("GET", base + "/info")
    if status != 200 or not body.startswith("WordWave COM Server V"):
        fail(f"/info: {status} {body[:200]}")
    ok(f"/info {body.strip()}")

    status, body = http("GET", base + "/data.html")
    if status != 200 or "<script" not in body.lower():
        fail(f"/data.html (word cloud): {status}")
    ok("/data.html word cloud served")
    status, body = http("GET", base + "/admin.html")
    if status != 200 or 'id="root"' not in body:
        fail(f"/admin.html (admin UI): {status}")
    ok("/admin.html admin UI served")

    status, body = http("GET", base + "/words/current")
    state = json.loads(body) if status == 200 else None
    if not state or not isinstance(state.get("words"), dict) or not isinstance(state.get("meta"), dict):
        fail(f"/words/current: {status} {body[:200]}")
    ok(f"/words/current {len(state['words'])} words")

    auth = auth_header()
    if auth:
        status, body = http("POST", base + "/login", headers=auth)
        if (status, body) != (200, "OK"):
            fail(f"POST /login with LOGIN/MDP: {status}")
        ok("POST /login with the configured credentials")
    elif write:
        fail("--write needs LOGIN and MDP in the environment")

    sio = SocketIO(base)
    ok(f"Socket.IO session + namespace joined (Origin {ORIGIN})")
    if write:
        status, body = http("POST", base + "/words", SENTENCE.encode(), {**auth, "Content-Type": "text/plain"})
        if status != 200 or body != " bonjour chats chats maison maison":
            fail(f"POST /words: {status} {body[:200]}")
        data = sio.wait_event("new_text")
        if not data or data["words"].get("maison", 0) < 2 or "meta" not in data:
            fail(f"new_text broadcast: {data}")
        ok(f"POST /words broadcast to Socket.IO clients: {data['words']}")
    sio.close()
    print("SELFCHECK OK")


if __name__ == "__main__":
    main()
