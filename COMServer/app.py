from flask import Flask
from flask import Response
from flask_cors import CORS
from flask import request
from flask_httpauth import HTTPBasicAuth
from config import init_config, get_config
import socketCOM
from flask_socketio import SocketIO
from flask_socketio import send, emit
from datetime import datetime
import sys
import time
import json
import threading
import signal
import sys

init_config('config.json')

### REST CONFIG  ##############################
app = Flask(__name__)
app.config['SECRET_KEY'] = get_config('secret')
cors = CORS(app, resources={r"*": {"origins": "*"}})
auth = HTTPBasicAuth()

users = {}
users[get_config('login')] = get_config('mdp')


@auth.verify_password
def verify_password(username, password):
    if username == get_config('login') and password == get_config('mdp'):
        return username



### TCP CONFIG   ##############################
socketio = SocketIO(app,cors_allowed_origins=['http://localhost:9999'])


def init(app):
    global sio
    sio = SocketIO(app)
    return sio


### STORAGE CONFIG  ##############################
mutex = threading.Lock()

word_file_path = get_config('word_file') if get_config(
    'word_file') != '' else f'words_{datetime.now().strftime("%m%d%Y_%H%M%S")}'
word_file = open(word_file_path, 'a+', encoding="utf-8")

all_words = word_file.readlines()


def safe_write_file(text):
    global mutex
    global word_file
    mutex.acquire()
    word_file.write(text)
    word_file.flush()
    mutex.release()

### REST CONFIG   ##############################

@app.route('/words/current', methods=['GET'])
def get_all():
    all_words_raw = ' '.join(all_words).replace('\n',' ')
    return Response(all_words_raw)


@app.route('/words/add', methods=['POST'])
def add_words():
    data = str(request.data.decode("utf-8"))
    print('Got Data : ')
    print(data)

    data.replace('\n', '')
    safe_write_file(data+'\n')
    all_words.append(data)

    socketio.emit('new_text', data, broadcast=True)
    return Response(data)

### START   ##############################


print(f'REST/SOCKET listening to port : {get_config("port")}')

def signal_handler(sig, frame):
    print('You pressed Ctrl+C!')
    word_file.close()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

if __name__ == '__main__':
    socketio.run(app=app, port=get_config('port'))
