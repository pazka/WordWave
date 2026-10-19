"""Upgrade safety net for the COM server (see TESTING.md at the repo root).

Characterization tests: they pin what the server does TODAY, quirks included, so a Python, Flask,
Flask-SocketIO or base-image bump that changes behaviour fails here. Standard library only.

Run from COMServer/:  python -m unittest discover -s tests -v
"""
import base64
import glob
import json
import os
import sys
import tempfile
import unittest

SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SERVER_DIR)

from config import get_config, init_config  # noqa: E402

TMP = tempfile.mkdtemp(prefix="wordwave-test-")
CONFIG = os.path.join(TMP, "config.json")
with open(CONFIG, "w", encoding="utf-8") as f:
    json.dump({"ENV": "TEST", "TEST": {
        "debug": False, "wrap_errors": True, "word_file": os.path.join(TMP, "boot.words"),
        "secret": "test-secret", "login": "test-user", "mdp": "test-password", "port": "0",
        "socket_cors": "*", "flask_cors": {"*": {"origins": "*"}},
    }}, f)
init_config(CONFIG)

import AdminSetup  # noqa: E402
import ServerCom  # noqa: E402
from WordProcessor import WordProcessor  # noqa: E402

ServerCom.init(WordProcessor(get_config("word_file")))
AdminSetup.init()
APP = ServerCom.get_app()
AUTH = {"Authorization": "Basic " + base64.b64encode(b"test-user:test-password").decode()}
BAD_AUTH = {"Authorization": "Basic " + base64.b64encode(b"test-user:wrong").decode()}
SENTENCE = "Bonjour les chats, le chat et la maison! Maisons 42"


class ServerTest(unittest.TestCase):
    def setUp(self):
        # Fresh word state per test (the routes read the module-level processor at call time).
        self.log = tempfile.mktemp(suffix=".words", dir=TMP)
        ServerCom.word_processor = WordProcessor(self.log)
        self.client = APP.test_client()
        self.sio = ServerCom.SocketCom.io.test_client(APP)
        self.files_before = set(glob.glob(os.path.join(SERVER_DIR, "*.words")))

    def tearDown(self):
        self.sio.disconnect()
        ServerCom.word_processor.destroy()
        # DELETE /words opens a new timestamped log next to the server code: clean it up.
        for f in set(glob.glob(os.path.join(SERVER_DIR, "*.words"))) - self.files_before:
            os.remove(f)

    def post_words(self, text=SENTENCE):
        return self.client.post("/words", data=text.encode("utf-8"), headers=AUTH)

    # ---------------------------------------------------------------- auth

    def test_write_routes_require_basic_auth(self):
        for method, path in [("POST", "/login"), ("POST", "/words"), ("POST", "/words/exclude"),
                             ("DELETE", "/words"), ("DELETE", "/reload")]:
            for headers in ({}, BAD_AUTH):
                r = self.client.open(path, method=method, data=b"x", headers=headers)
                self.assertEqual(r.status_code, 401, (method, path))
                self.assertEqual(r.get_data(as_text=True), "Unauthorized Access")

    def test_login(self):
        r = self.client.post("/login", headers=AUTH)
        self.assertEqual((r.status_code, r.get_data(as_text=True)), (200, "OK"))

    # ---------------------------------------------------------------- word flow

    def test_fresh_state(self):
        self.assertEqual(self.client.get("/words/current/count").get_json(), {})
        # Quirk: replaying the (empty) log file on start counts one registered "word".
        self.assertEqual(self.client.get("/words/current/meta").get_json(), {
            "max_len": 0, "max_occ": 0, "min_len": 99999, "min_occ": 99999,
            "total_word_counted": 0, "total_word_registered": 1})

    def test_post_words_normalises_folds_plurals_and_broadcasts(self):
        r = self.post_words()
        self.assertEqual(r.status_code, 200)
        # stop words, punctuation and digits dropped; "chat" folded into "chats", "Maisons" into "maison"
        self.assertEqual(r.get_data(as_text=True), " bonjour chats chats maison maison")
        meta = {"min_len": 5, "max_len": 7, "max_occ": 2, "min_occ": 1,
                "total_word_counted": 3, "total_word_registered": 7}
        self.assertEqual(self.sio.get_received(), [{"name": "new_text", "namespace": "/", "args": [
            {"words": {"bonjour": 1, "chats": 2, "maison": 2}, "meta": meta}]}])
        self.assertEqual(self.client.get("/words/current").get_json(),
                         {"words": {"bonjour": 1, "chats": 2, "maison": 2}, "meta": meta})
        self.assertEqual(self.client.get("/words/current/count").get_json(),
                         {"bonjour": 1, "chats": 2, "maison": 2})
        self.assertEqual(self.client.get("/words/current/meta").get_json(), meta)

    def test_open_data_text_endpoints(self):
        self.post_words()
        self.assertEqual(self.client.get("/words/current/registered").get_data(as_text=True),
                         "\n bonjour chats chats maison maison\n")
        self.assertEqual(self.client.get("/words/current/recorded").get_data(as_text=True),
                         "\n\n" + SENTENCE + "\n")
        self.assertEqual(self.client.get("/words/current/csv_count").get_data(as_text=True),
                         "Word,NbOccurrences\nchats,2\nmaison,2\nbonjour,1\n")
        stop = self.client.get("/words/current/stop").get_data(as_text=True).split(" ")
        self.assertTrue({"les", "le", "et", "la", "the", "and"} <= set(stop))

    def test_exclude_removes_existing_counts(self):
        self.post_words()
        r = self.client.post("/words/exclude", data="maison".encode(), headers=AUTH)
        self.assertEqual(r.get_data(as_text=True), "OK")
        self.assertEqual(self.client.get("/words/current/count").get_json(), {"bonjour": 1, "chats": 2})
        self.post_words("maison")
        self.assertEqual(self.client.get("/words/current/count").get_json(), {"bonjour": 1, "chats": 2})

    def test_reset_clears_and_broadcasts(self):
        self.post_words()
        self.sio.get_received()
        r = self.client.delete("/words", headers=AUTH)
        self.assertEqual(r.get_data(as_text=True), "OK")
        self.assertEqual(self.sio.get_received(), [{"name": "reset", "args": [], "namespace": "/"}])
        self.assertEqual(self.client.get("/words/current/count").get_json(), {})
        # Quirk kept as is: the new log file is created next to the server code.
        self.assertEqual(len(set(glob.glob(os.path.join(SERVER_DIR, "*.words"))) - self.files_before), 1)

    def test_reload_broadcasts(self):
        r = self.client.delete("/reload", headers=AUTH)
        self.assertEqual(r.get_data(as_text=True), "OK")
        self.assertEqual(self.sio.get_received(), [{"name": "reload", "args": [], "namespace": "/"}])

    def test_restart_does_not_replay_the_log_file(self):
        # Known bug kept as is (TESTING.md): the log is opened "a+" (cursor at the end), so the replay in
        # WordProcessor.__init__ reads nothing and counts are lost on restart. The text stays on disk.
        self.post_words()
        ServerCom.word_processor.destroy()
        ServerCom.word_processor = WordProcessor(self.log)
        self.assertEqual(self.client.get("/words/current/count").get_json(), {})
        self.assertIn(SENTENCE, self.client.get("/words/current/recorded").get_data(as_text=True))

    # ---------------------------------------------------------------- CORS

    def test_cors_headers(self):
        # Test config allows "*" (prod allows the three alessiasanna.fr / wordwave.hosh.it origins).
        # flask-cors echoes the request origin and varies on it.
        r = self.client.get("/words/current", headers={"Origin": "https://somewhere.example"})
        self.assertEqual(r.headers.get("Access-Control-Allow-Origin"), "https://somewhere.example")
        self.assertIn("Origin", r.headers.get("Vary"))
        pre = self.client.open("/words", method="OPTIONS", headers={
            "Origin": "https://somewhere.example", "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type"})
        self.assertEqual(pre.status_code, 200)
        self.assertEqual(pre.headers.get("Access-Control-Allow-Origin"), "https://somewhere.example")
        self.assertEqual(pre.headers.get("Access-Control-Allow-Methods"), "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT")
        self.assertEqual(pre.headers.get("Access-Control-Allow-Headers").lower(), "authorization, content-type")

    # ---------------------------------------------------------------- admin endpoints

    def test_info_spec_swagger(self):
        with open(os.path.join(SERVER_DIR, "version"), encoding="utf-8") as f:
            version = f.readline()
        self.assertEqual(self.client.get("/info").get_data(as_text=True),
                         f"WordWave COM Server V{version} on env production")
        spec = self.client.get("/spec")
        self.assertEqual(spec.status_code, 200)
        self.assertIn("info", spec.get_json())
        ui = self.client.get("/swagger/")
        self.assertEqual(ui.status_code, 200)
        self.assertIn("swagger-ui", ui.get_data(as_text=True))


class WordProcessorTest(unittest.TestCase):
    def setUp(self):
        self.wp = WordProcessor(tempfile.mktemp(suffix=".words", dir=TMP))

    def tearDown(self):
        self.wp.destroy()

    def test_normalize_text(self):
        self.assertEqual(self.wp.normalize_text("Été,\tça VA?\n\n42 l'arbre"), "été ça va l arbre")

    def test_simplifications(self):
        self.assertEqual(self.wp.get_possible_simplifications("chats"), ["chats", "chat", "chatses", "chatss"])
        # Quirk: the "es" branch compares a 1-char slice to "es" and never fires.
        self.assertEqual(self.wp.get_possible_simplifications("grandes"),
                         ["grandes", "grande", "grandeses", "grandess"])

    def test_csv_sorted_by_count(self):
        self.wp.register_text("pomme poire pomme")
        self.assertEqual(self.wp.get_total_words_counted_in_csv_format(), "Word,NbOccurrences\npomme,2\npoire,1\n")


class ConfigTest(unittest.TestCase):
    def test_env_placeholders_are_resolved_and_required(self):
        path = os.path.join(TMP, "envcfg.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"ENV": "PROD", "PROD": {"a": "${WW_TEST_A}", "n": {"b": "${WW_TEST_B}"}}}, f)
        os.environ["WW_TEST_A"], os.environ["WW_TEST_B"] = "1", "2"
        try:
            self.assertEqual(init_config(path), {"a": "1", "n": {"b": "2"}})
            del os.environ["WW_TEST_B"]
            with self.assertRaises(KeyError):
                init_config(path)
        finally:
            os.environ.pop("WW_TEST_A", None)
            os.environ.pop("WW_TEST_B", None)
            init_config(CONFIG)

    def test_prod_config_reads_secrets_from_env(self):
        with open(os.path.join(SERVER_DIR, "config.prod.json"), encoding="utf-8") as f:
            prod = json.load(f)["PROD"]
        self.assertEqual((prod["secret"], prod["login"], prod["mdp"], prod["port"]),
                         ("${secret}", "${LOGIN}", "${MDP}", "${PORT}"))
        self.assertFalse(prod["debug"])


if __name__ == "__main__":
    unittest.main()
