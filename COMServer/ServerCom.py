import os

from flask import Flask, request
from flask_cors import CORS
from flask_httpauth import HTTPBasicAuth

from SocketCom import SocketCom
from WordProcessor import WordProcessor
from config import get_config
from error_wrapper import wrap_error

users = {}

app = Flask(__name__,
            static_url_path='/public',
            static_folder='public')

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

    SocketCom = SocketCom(app)


def run():
    if get_config('debug'):
        SocketCom.io.run(app=app, port=get_config('port'))
    else:
        SocketCom.io.run(app=app, host="0.0.0.0", port=get_config('port'))

    print(f'REST/SOCKET listening to port : {get_config("port")}')


@auth.verify_password
def verify_password(username, password):
    if username == get_config('login') and password == get_config('mdp'):
        return username


@app.route('/words/current/words', methods=['GET'])
@wrap_error()
def get_meta_state():
    return word_processor.current_words


@app.route('/words/current/meta', methods=['GET'])
@wrap_error()
def get_word_state():
    return word_processor.meta.__dict__


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
    [word_counted, normalized_text] = word_processor.register_text(data)
    SocketCom.broadcast_new_text({
        "words": word_counted,
        "meta": word_processor.meta.__dict__
    })
    return normalized_text


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
