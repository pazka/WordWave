import os
import signal
import sys

import server
from config import init_config, get_config
from words_processing import WordProcessor

init_config(os.path.dirname(os.path.abspath(__file__))+'/config.json')
word_processor = WordProcessor(get_config('word_file'))
server.init(word_processor)
server.run()


def signal_handler(sig, frame):
    print('You pressed Ctrl+C!')
    server.destroy()
    sys.exit(0)


signal.signal(signal.SIGINT, signal_handler)
