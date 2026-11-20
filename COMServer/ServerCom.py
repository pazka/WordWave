import os

import flask.cli
from flask import Flask, request
from flask_cors import CORS
from flask_httpauth import HTTPBasicAuth

from SocketCom import SocketCom
from WordProcessor import WordProcessor
from config import get_config
from error_wrapper import wrap_error
import jsonlog

users = {}

app = Flask(__name__,
            static_url_path='/',
            static_folder='static')

auth = HTTPBasicAuth()
cors: CORS
word_processor: WordProcessor
SocketCom: SocketCom

curr_path = os.path.dirname(os.path.abspath(__file__))


def init(_word_processor: WordProcessor):
    global word_processor
    global cors
    global SocketCom

    word_processor = _word_processor
    users[get_config('login')] = get_config('mdp')
    app.config['SECRET_KEY'] = get_config('secret')
    app.config['DEBUG'] = get_config('debug')
    app.config['PORT'] = get_config('port')
    app.config['ENV'] = 'development' if get_config('debug') else 'production'
    cors = CORS(app, resources=get_config('flask_cors'))
    jsonlog.install(app, hide=lambda: [str(get_config('login')), str(get_config('mdp')), str(get_config('secret'))])

    SocketCom = SocketCom(app)


def run():
    # One startup line BEFORE the blocking run (the old print came after it, so it never showed).
    jsonlog.LOG.info("startup", f"REST/SOCKET listening to port : {get_config('port')}", **startup_fields())
    # stdout holds only JSON lines: Flask's " * Serving Flask app" banner is not printed.
    flask.cli.show_server_banner = lambda *args, **kwargs: None
    if get_config('debug'):
        SocketCom.io.run(app=app, port=get_config('port'))
    else:
        # Same Werkzeug server as before; Flask-SocketIO >= 5.3 only requires the explicit opt-in.
        SocketCom.io.run(app=app, host="0.0.0.0", port=get_config('port'), allow_unsafe_werkzeug=True)


def capability():
    """The checks of /healthz: the word log is open in a writable directory, the web builds are there."""
    log = word_processor._log_file
    return {
        "word_log": not log.closed and os.access(os.path.dirname(os.path.abspath(log.name)), os.W_OK),
        "web_builds": all(os.path.isfile(os.path.join(app.static_folder, f)) for f in ("data.html", "admin.html")),
    }


def startup_fields():
    """Port, capability, level and the NAMES of the configuration that is set (never a value or a path)."""
    try:
        port = int(get_config('port'))
    except (TypeError, ValueError):
        port = None
    try:
        checks = capability()
    except Exception:
        checks = {"word_log": False, "web_builds": False}
    data_dir = os.environ.get("DATA_DIR") or curr_path
    return {"port": port, "data_dir_writable": os.access(data_dir, os.W_OK), **checks,
            "log_level": jsonlog.LOG.level, "config": jsonlog.config_names_set()}


@auth.verify_password
def verify_password(username, password):
    if username == get_config('login') and password == get_config('mdp'):
        return username


@app.route('/login', methods=['POST'])
@auth.login_required
@wrap_error()
def login():
    return 'OK'


@app.route('/healthz', methods=['GET'])
def healthz():
    """Capability, not liveness: the word log is open in a writable directory and the web builds
    are there. No secret, no path. 503 + status "error" otherwise (image/compose healthcheck)."""
    try:
        checks = capability()
        words = len(word_processor.current_words)
    except Exception:
        return {"status": "error"}, 503
    ok = all(checks.values())
    return {"status": "ok" if ok else "error", "checks": checks, "words": words}, 200 if ok else 503


@app.route('/words/current/recorded', methods=['GET'])
@wrap_error()
def get_recorded():
    return word_processor.safe_log_read()


@app.route('/words/current/registered', methods=['GET'])
@wrap_error()
def get_recording():
    return word_processor.current_registered


@app.route('/words/current/count', methods=['GET'])
@wrap_error()
def get_meta_state():
    return word_processor.current_words


@app.route('/words/current/csv_count', methods=['GET'])
@wrap_error()
def get_meta_state_in_csv():
    return word_processor.get_total_words_counted_in_csv_format()


@app.route('/words/current/meta', methods=['GET'])
@wrap_error()
def get_word_state():
    return word_processor.meta.__dict__


@app.route('/words/current/stop', methods=['GET'])
@wrap_error()
def get_excluded_words():
    return ' '.join(word_processor.excluded_words)


@app.route('/words/current', methods=['GET'])
@wrap_error()
def get_full_state():
    return {
        "words": word_processor.current_words,
        "meta": word_processor.meta.__dict__
    }


@app.route('/words', methods=['POST'])
@auth.login_required
@wrap_error()
def add_text():
    data = str(request.data.decode("utf-8"))
    [word_counted, registered_text] = word_processor.register_text(data)
    SocketCom.broadcast_new_text({
        "words": word_counted,
        "meta": word_processor.meta.__dict__
    })
    return registered_text


@app.route('/words/exclude', methods=['POST'])
@auth.login_required
@wrap_error()
def exclude_text():
    data = str(request.data.decode("utf-8"))
    word_processor.add_excluded_text(data)
    return 'OK'


@app.route('/words', methods=['DELETE'])
@auth.login_required
@wrap_error()
def reset():
    global word_processor
    word_processor.destroy()
    word_processor = WordProcessor()

    SocketCom.broadcast_reset()
    return 'OK'


@app.route('/reload', methods=['DELETE'])
@auth.login_required
@wrap_error()
def reload():
    SocketCom.broadcast_reload()
    return 'OK'


def get_app():
    return app


def destroy():
    word_processor.destroy()
    SocketCom.destroy()
