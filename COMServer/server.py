from flask import Flask, request
from flask_cors import CORS
from flask_httpauth import HTTPBasicAuth

from config import get_config
from error_wrapper import wrap_error
from socket_com import SocketCom
from words_processing import WordProcessor

users = {}

app = Flask(__name__)
auth = HTTPBasicAuth()
cors: CORS
word_processor: WordProcessor
socket_com: SocketCom


def init(_word_processor: WordProcessor):
    global word_processor
    global cors
    global socket_com

    word_processor = _word_processor
    users[get_config('login')] = get_config('mdp')
    app.config['SECRET_KEY'] = get_config('secret')
    cors = CORS(app, resources=get_config('flask_cors'))

    socket_com = SocketCom(app)


def run():
    socket_com.io.run(app=app, port=get_config('port'))
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
    return word_processor.meta


@app.route('/words/current', methods=['GET'])
@wrap_error()
def get_full_state():
    return {
        "words": word_processor.current_words,
        "meta": word_processor.meta
    }


@app.route('/words', methods=['POST'])
@auth.login_required
@wrap_error()
def add_text():
    data = str(request.data.decode("utf-8"))
    [word_counted, normalized_text] = word_processor.register_text(data)
    socket_com.broadcast_new_text({
        "new_words": word_counted,
        "meta": word_processor.meta
    })
    return normalized_text


@app.route('/words', methods=['DELETE'])
@auth.login_required
@wrap_error()
def reset():
    global word_processor
    word_processor.destroy()

    word_processor = WordProcessor()

    return 'OK'


def destroy():
    word_processor.destroy()
    socket_com.destroy()
