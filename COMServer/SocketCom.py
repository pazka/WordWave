from flask import Flask
from flask_socketio import SocketIO

from config import get_config


class SocketCom:
    io: SocketIO
    app: Flask

    def __init__(self, app):
        self.io = SocketIO(app, cors_allowed_origins=get_config('socket_cors'))
        self.app = app

    def broadcast_new_text(self, data):
        # A server-level emit goes to every client (python-socketio 5 dropped broadcast=).
        self.io.emit('new_text', data)

    def broadcast_reset(self):
        self.io.emit('reset', None)

    def broadcast_reload(self):
        self.io.emit('reload', None)

    def destroy(self):
        self.io.emit('close', None)
