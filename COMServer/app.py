import os
import signal
import sys

import ServerCom
from config import init_config, get_config
from WordProcessor import WordProcessor

init_config(os.path.dirname(os.path.abspath(__file__))+'/config.json')
word_processor = WordProcessor(get_config('word_file'))
ServerCom.init(word_processor)
ServerCom.run()


def signal_handler(sig, frame):
    print('You pressed Ctrl+C!')
    ServerCom.destroy()
    sys.exit(0)


signal.signal(signal.SIGINT, signal_handler)
